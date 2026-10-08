// ══════════════════════════════════════════════════════════════════
// Login con Microsoft Entra ID (OpenID Connect, flujo authorization
// code + PKCE, cliente confidencial). Ver deploy/SSO_ENTRA_ID.md.
//
// - state + nonce + code_verifier viajan en una cookie HttpOnly firmada
//   y de 10 min, ligada al navegador que inició el login: evita el
//   login CSRF y la inyección de códigos de autorización.
// - Solo se acepta el tenant configurado (issuer validado por
//   openid-client + comprobación explícita de tid).
// - La identidad se fija por el objectId (oid) de Entra: el email solo
//   se usa la primera vez, para vincular la cuenta ya dada de alta.
// - No da de alta usuarios: deben existir y estar activos en la app.
// ══════════════════════════════════════════════════════════════════
const router  = require('express').Router()
const jwt     = require('jsonwebtoken')
const { Issuer, generators } = require('openid-client')
const pool    = require('../db')
const { registrarAuditoria } = require('../lib/auditoria')

const SECRET        = process.env.JWT_SECRET
const EXPIRY        = '8h'
const TENANT_ID     = (process.env.AZURE_AD_TENANT_ID || '').trim()
const CLIENT_ID     = (process.env.AZURE_AD_CLIENT_ID || '').trim()
const CLIENT_SECRET = process.env.AZURE_AD_CLIENT_SECRET
const APP_URL       = process.env.APP_URL || 'http://localhost:5173'
const REDIRECT_URI  = `${APP_URL}/api/auth/microsoft/callback`
const POST_LOGOUT_URI = `${APP_URL}/`
const SECURE_COOKIE = APP_URL.startsWith('https://')

// Dominios de email admitidos (coma-separados). Por defecto comsa.com.
const DOMINIOS = (process.env.AZURE_AD_ALLOWED_DOMAINS || 'comsa.com')
  .split(',').map(d => d.trim().toLowerCase().replace(/^@/, '')).filter(Boolean)

// Roles de aplicación de Entra → nivel en la app. Solo se aplican si
// AZURE_AD_ROLE_SYNC=true; entonces el rol de Entra manda sobre el
// nivel guardado y un usuario sin ninguno de estos roles no entra.
const ROLE_SYNC = process.env.AZURE_AD_ROLE_SYNC === 'true'
const ROLES = [            // de más a menos privilegios
  ['Biomasa.Superadmin', 'superadmin'],
  ['Biomasa.Usuario',    'usuario'],
  ['Biomasa.Basico',     'basico'],
]

// Cerrar también la sesión de Microsoft al salir de la app (afecta a
// Outlook web, Teams web... en ese navegador). Desactivado por defecto.
const SINGLE_LOGOUT = process.env.AZURE_AD_SINGLE_LOGOUT === 'true'

const enabled = !!(TENANT_ID && CLIENT_ID && CLIENT_SECRET)

const FLOW_COOKIE = 'ms_oidc_flow'
const FLOW_COOKIE_OPTS = { httpOnly: true, secure: SECURE_COOKIE, sameSite: 'lax', path: '/api/auth/microsoft' }

// ── Cliente OIDC (descubierto de forma perezosa, una sola vez) ────
let _clientPromise = null
function getClient() {
  if (!_clientPromise) {
    _clientPromise = (async () => {
      const issuer = await Issuer.discover(`https://login.microsoftonline.com/${TENANT_ID}/v2.0`)
      return new issuer.Client({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uris: [REDIRECT_URI],
        response_types: ['code'],
        id_token_signed_response_alg: 'RS256',
      })
    })().catch(e => { _clientPromise = null; throw e })   // reintenta en la próxima petición
  }
  return _clientPromise
}

function leerCookie(req, nombre) {
  const raw = req.headers.cookie || ''
  for (const parte of raw.split(';')) {
    const i = parte.indexOf('=')
    if (i > -1 && parte.slice(0, i).trim() === nombre) return decodeURIComponent(parte.slice(i + 1).trim())
  }
  return null
}

const esGuid = s => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)

function auditarFallo(req, motivo, email, user = null) {
  registrarAuditoria({
    usuario: user || { nombre: 'Anónimo' }, accion: 'login_fallido', entidad: 'sesion', entidadId: user?.id,
    detalle: `Microsoft · ${motivo}${email ? ` · ${email}` : ''} · IP ${req.ip}`,
  })
}

// ── GET /auth/microsoft/status ─────────────────────────────────────
router.get('/microsoft/status', (_req, res) => {
  res.json({
    enabled,
    obligatorio: enabled && process.env.AZURE_AD_ENFORCE === 'true',
    singleLogout: enabled && SINGLE_LOGOUT,
  })
})

// ── GET /auth/microsoft/login ───────────────────────────────────────
router.get('/microsoft/login', async (_req, res) => {
  if (!enabled) return res.status(503).json({ error: 'Login con Microsoft no configurado' })
  try {
    const client = await getClient()
    const state = generators.state()
    const nonce = generators.nonce()
    const codeVerifier = generators.codeVerifier()

    const flujo = jwt.sign({ state, nonce, cv: codeVerifier }, SECRET, { expiresIn: '10m' })
    res.cookie(FLOW_COOKIE, flujo, { ...FLOW_COOKIE_OPTS, maxAge: 10 * 60 * 1000 })

    res.redirect(client.authorizationUrl({
      scope: 'openid profile email',
      state,
      nonce,
      code_challenge: generators.codeChallenge(codeVerifier),
      code_challenge_method: 'S256',
      prompt: 'select_account',
    }))
  } catch (e) {
    console.error('Error iniciando login Microsoft:', e)
    res.status(500).json({ error: 'No se pudo iniciar el login con Microsoft' })
  }
})

// ── GET /auth/microsoft/callback ────────────────────────────────────
router.get('/microsoft/callback', async (req, res) => {
  if (!enabled) return res.status(503).send('Login con Microsoft no configurado')

  const irConError = (codigo) => res.redirect(`${APP_URL}/auth/callback#error=${codigo}`)

  // La cookie de flujo es de un solo uso
  const flujoRaw = leerCookie(req, FLOW_COOKIE)
  res.clearCookie(FLOW_COOKIE, FLOW_COOKIE_OPTS)

  // Error devuelto por Microsoft (usuario cancela, consentimiento...)
  if (req.query.error) {
    auditarFallo(req, `${req.query.error}: ${String(req.query.error_description || '').slice(0, 200)}`)
    return irConError(req.query.error === 'access_denied' ? 'acceso_denegado' : 'error_desconocido')
  }

  let flujo
  try {
    flujo = jwt.verify(flujoRaw || '', SECRET, { algorithms: ['HS256'] })
  } catch {
    auditarFallo(req, 'estado de login inválido o caducado')
    return irConError('estado_invalido')
  }

  try {
    const client = await getClient()
    const params = client.callbackParams(req)
    const tokenSet = await client.callback(REDIRECT_URI, params, {
      state: flujo.state,
      nonce: flujo.nonce,
      code_verifier: flujo.cv,
    })
    const claims = tokenSet.claims()

    if (esGuid(TENANT_ID) && String(claims.tid || '').toLowerCase() !== TENANT_ID.toLowerCase()) {
      auditarFallo(req, `tenant no permitido (${claims.tid})`)
      return irConError('tenant_no_permitido')
    }

    const oid   = claims.oid
    const email = String(claims.email || claims.preferred_username || claims.upn || '').toLowerCase()
    if (!oid) {
      auditarFallo(req, 'token sin oid', email)
      return irConError('error_desconocido')
    }
    if (!DOMINIOS.some(d => email.endsWith(`@${d}`))) {
      auditarFallo(req, 'dominio no permitido', email)
      return irConError('dominio_no_permitido')
    }

    // 1º por identidad de Entra ya vinculada; si no, por email (primer login)
    let { rows } = await pool.query('SELECT * FROM usuarios WHERE azure_oid = $1', [oid])
    let user = rows[0]
    if (!user) {
      ;({ rows } = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email]))
      user = rows[0]
      if (user?.azure_oid && user.azure_oid !== oid) {
        auditarFallo(req, 'el email ya está vinculado a otra identidad de Microsoft', email)
        return irConError('identidad_no_coincide')
      }
    }
    if (!user) {
      auditarFallo(req, 'usuario no dado de alta en la app', email)
      return irConError('usuario_no_registrado')
    }
    if (!user.activo) {
      auditarFallo(req, 'cuenta desactivada en la app', email, user)
      return irConError('cuenta_bloqueada')
    }

    if (!user.azure_oid) {
      await pool.query(
        `UPDATE usuarios SET azure_oid = $1, auth_provider = 'azure_ad' WHERE id = $2`,
        [oid, user.id]
      )
    }

    if (ROLE_SYNC) {
      const rolesToken = Array.isArray(claims.roles) ? claims.roles : []
      const nivel = ROLES.find(([rol]) => rolesToken.includes(rol))?.[1]
      if (!nivel) {
        auditarFallo(req, 'sin rol de aplicación asignado en Entra ID', email, user)
        return irConError('sin_rol')
      }
      if (nivel !== user.nivel) {
        await pool.query('UPDATE usuarios SET nivel = $1 WHERE id = $2', [nivel, user.id])
        registrarAuditoria({
          usuario: user, accion: 'editar', entidad: 'usuario', entidadId: user.id,
          detalle: `Nivel sincronizado desde Entra ID: ${user.nivel} → ${nivel}`,
        })
      }
    }

    registrarAuditoria({
      usuario: user, accion: 'login', entidad: 'sesion', entidadId: user.id,
      detalle: `Microsoft (Entra ID) · ${email} · IP ${req.ip}`,
    })

    const token = jwt.sign(
      { id: user.id, ver: user.token_version || 1, amr: 'azure_ad' },
      SECRET,
      { expiresIn: EXPIRY }
    )
    res.redirect(`${APP_URL}/auth/callback#token=${token}`)
  } catch (e) {
    console.error('Error en callback de Microsoft:', e)
    auditarFallo(req, `error validando la respuesta (${e.name || 'Error'})`)
    irConError('error_desconocido')
  }
})

// ── GET /auth/microsoft/logout ──────────────────────────────────────
// Solo se usa con AZURE_AD_SINGLE_LOGOUT=true: el frontend ya ha
// borrado su token y aquí se cierra también la sesión de Microsoft.
router.get('/microsoft/logout', async (_req, res) => {
  if (!enabled || !SINGLE_LOGOUT) return res.redirect(POST_LOGOUT_URI)
  try {
    const client = await getClient()
    res.redirect(client.endSessionUrl({ post_logout_redirect_uri: POST_LOGOUT_URI, client_id: CLIENT_ID }))
  } catch {
    res.redirect(POST_LOGOUT_URI)
  }
})

module.exports = router
module.exports.enabled = enabled
module.exports.DOMINIOS = DOMINIOS
