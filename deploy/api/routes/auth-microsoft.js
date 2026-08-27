const router  = require('express').Router()
const jwt     = require('jsonwebtoken')
const crypto  = require('crypto')
const { Issuer } = require('openid-client')
const pool    = require('../db')

const SECRET       = process.env.JWT_SECRET
const EXPIRY       = '8h'
const TENANT_ID    = process.env.AZURE_AD_TENANT_ID
const CLIENT_ID    = process.env.AZURE_AD_CLIENT_ID
const CLIENT_SECRET = process.env.AZURE_AD_CLIENT_SECRET
const APP_URL      = process.env.APP_URL || 'http://localhost:5173'
const REDIRECT_URI = `${APP_URL}/api/auth/microsoft/callback`
const DOMINIO_PERMITIDO = '@comsa.com'

const enabled = !!(TENANT_ID && CLIENT_ID && CLIENT_SECRET)

// ── Cliente OIDC (descubierto de forma perezosa, una sola vez) ────
let _clientPromise = null
async function getClient() {
  if (!_clientPromise) {
    _clientPromise = (async () => {
      const issuer = await Issuer.discover(`https://login.microsoftonline.com/${TENANT_ID}/v2.0`)
      return new issuer.Client({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uris: [REDIRECT_URI],
        response_types: ['code'],
      })
    })()
  }
  return _clientPromise
}

// ── GET /auth/microsoft/status ─────────────────────────────────────
router.get('/microsoft/status', (_req, res) => {
  res.json({ enabled })
})

// ── GET /auth/microsoft/login ───────────────────────────────────────
router.get('/microsoft/login', async (_req, res) => {
  if (!enabled) return res.status(503).json({ error: 'Login con Microsoft no configurado' })
  try {
    const client = await getClient()
    const state = jwt.sign({ nonce: crypto.randomUUID() }, SECRET, { expiresIn: '10m' })
    const url = client.authorizationUrl({
      scope: 'openid profile email',
      state,
    })
    res.redirect(url)
  } catch (e) {
    console.error('Error iniciando login Microsoft:', e)
    res.status(500).json({ error: 'No se pudo iniciar el login con Microsoft' })
  }
})

// ── GET /auth/microsoft/callback ────────────────────────────────────
router.get('/microsoft/callback', async (req, res) => {
  if (!enabled) return res.status(503).send('Login con Microsoft no configurado')

  const irConError = (codigo) => res.redirect(`${APP_URL}/auth/callback#error=${codigo}`)

  try {
    jwt.verify(req.query.state, SECRET)
  } catch {
    return irConError('estado_invalido')
  }

  try {
    const client = await getClient()
    const params = client.callbackParams(req)
    const tokenSet = await client.callback(REDIRECT_URI, params, { state: req.query.state })
    const claims = tokenSet.claims()

    const email = String(claims.email || claims.preferred_username || '').toLowerCase()
    if (!email.endsWith(DOMINIO_PERMITIDO)) return irConError('dominio_no_permitido')

    const { rows } = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email])
    const user = rows[0]
    if (!user) return irConError('usuario_no_registrado')
    if (!user.activo) return irConError('cuenta_bloqueada')

    if (!user.azure_oid) {
      await pool.query(
        `UPDATE usuarios SET azure_oid = $1, auth_provider = 'azure_ad' WHERE id = $2`,
        [claims.oid || claims.sub, user.id]
      )
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, nivel: user.nivel, nombre: user.nombre },
      SECRET,
      { expiresIn: EXPIRY }
    )
    res.redirect(`${APP_URL}/auth/callback#token=${token}`)
  } catch (e) {
    console.error('Error en callback de Microsoft:', e)
    irConError('error_desconocido')
  }
})

module.exports = router
