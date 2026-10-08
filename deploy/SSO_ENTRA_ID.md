# Login con Microsoft Entra ID (SSO) — biomasa.cserintranet.com

Documento técnico de referencia. La solicitud para IT (qué configurar en
Entra y qué valores devolver) sale de aquí.

## 1. Cómo funciona

| Aspecto | Implementación |
|---|---|
| Protocolo | OpenID Connect sobre OAuth 2.0, endpoint v2.0 de Entra ID |
| Flujo | Authorization Code + PKCE (S256), cliente confidencial (secreto en servidor) |
| Tenant | Single-tenant: solo se acepta el tenant configurado (issuer + `tid` validados) |
| Scopes | `openid profile email` — sin acceso a Graph, correo ni archivos del usuario |
| Validación del id_token | Firma RS256 contra las JWKS de Microsoft, `iss`, `aud`, `exp`, `nonce` |
| Anti-CSRF | `state` + `nonce` + `code_verifier` en cookie HttpOnly, Secure, SameSite=Lax, firmada, de un solo uso y 10 min |
| Identidad | Se fija por el `oid` de Entra. El email solo vincula la cuenta la primera vez |
| Alta de usuarios | No hay alta automática: la cuenta debe existir y estar activa en la app |
| Tokens de Microsoft | No se guardan. Solo se lee el id_token durante el login |
| Sesión en la app | JWT propio (HS256, 8 h), revocable (`token_version`). Desactivar un usuario en la app corta su sesión en la siguiente petición |
| Auditoría | Cada login correcto o fallido (motivo, email, IP) queda en el log de auditoría |

Código: `deploy/api/routes/auth-microsoft.js` (flujo OIDC) y
`deploy/api/routes/auth.js` (sesión, login con contraseña, SSO obligatorio).

## 2. Registro de la aplicación en Entra ID (lo configura IT)

**App registrations → New registration**
- Nombre: `Albaranes Biomasa – COMSA`
- Supported account types: **Accounts in this organizational directory only (Single tenant)**
- Redirect URI — plataforma **Web**:
  `https://biomasa.cserintranet.com/api/auth/microsoft/callback`

**Authentication**
- Implicit grant (access tokens / ID tokens): **desactivado**
- Allow public client flows: **No**
- Front-channel logout URL: vacío (no se usa)

**Certificates & secrets**
- Un client secret con caducidad de 12 o 24 meses. Hay que pasar el **valor** (no el Secret ID) por un canal seguro e indicar la fecha de caducidad.

**API permissions**
- Microsoft Graph, permisos delegados: `openid`, `profile`, `email`, con **admin consent** concedido para que no salga la pantalla de consentimiento a cada usuario.
- No hace falta ningún permiso de aplicación.

**Token configuration** (opcional, recomendado)
- Optional claim `email` en el ID token.

**Enterprise applications → la app**
- Properties → **Assignment required: Yes**
- Users and groups: asignar el grupo de seguridad de usuarios de la app (p. ej. `SG-Biomasa-Albaranes`)
- (Opcional) **App roles** para gestionar los permisos desde Entra (ver §4)

**Conditional Access**
- Incluir la app en la política de MFA y en las demás políticas corporativas (dispositivo, ubicación...). La app no necesita nada especial: Entra lo aplica antes de devolver al usuario.

**Valores que IT debe devolver**
1. Directory (tenant) ID — GUID
2. Application (client) ID — GUID
3. Client secret: **valor** y fecha de caducidad
4. Nombre del grupo asignado (y de los App roles, si se usan)

## 3. Variables de entorno (servidor, `/opt/biomasa/.env`)

```
AZURE_AD_TENANT_ID=<GUID tenant>
AZURE_AD_CLIENT_ID=<GUID app>
AZURE_AD_CLIENT_SECRET=<valor del secreto>
AZURE_AD_ALLOWED_DOMAINS=comsa.com     # dominios admitidos, coma-separados
AZURE_AD_ENFORCE=false                 # true → @comsa.com solo con Microsoft
AZURE_AD_ROLE_SYNC=false               # true → el nivel sale de los App roles
AZURE_AD_SINGLE_LOGOUT=false           # true → salir cierra también la sesión de Microsoft
```

Después: `docker compose up -d api` y comprobar que
`https://biomasa.cserintranet.com/api/auth/microsoft/status` devuelve `"enabled": true`.
La migración `scripts/migrate_012_azure_ad.sql` (columnas `auth_provider` y
`azure_oid`) tiene que estar aplicada en la BD.

## 4. Modos opcionales

**SSO obligatorio** (`AZURE_AD_ENFORCE=true`): las cuentas de los dominios
corporativos ya no pueden entrar con contraseña, así que MFA y acceso
condicional se aplican siempre. Las sesiones abiertas antes con contraseña
dejan de valer. Las cuentas de otros dominios (cuenta de emergencia
*break-glass*, externos) siguen entrando con contraseña. Activarlo cuando
todos los usuarios hayan entrado una vez con Microsoft.

**Permisos desde Entra** (`AZURE_AD_ROLE_SYNC=true`): IT crea tres App roles
(Allowed member types: Users/Groups) y los asigna a grupos.

| Value del App role | Nivel en la app |
|---|---|
| `Biomasa.Superadmin` | superadmin (gestión de usuarios y auditoría) |
| `Biomasa.Usuario` | usuario (operativa + configuración) |
| `Biomasa.Basico` | básico (operativa sin configuración) |

En cada login el nivel se actualiza al rol de Entra (y queda auditado). Un
usuario sin ninguno de estos roles no entra.

**Logout único** (`AZURE_AD_SINGLE_LOGOUT=true`): al cerrar sesión en la app
también se cierra la de Microsoft en ese navegador (Outlook web, Teams...).
Desactivado por defecto porque suele molestar a los usuarios.

## 5. Ciclo de vida de las cuentas

- **Alta**: un superadmin crea el usuario en la app con su email `@comsa.com`. Con el SSO activo no hace falta contraseña. IT lo añade al grupo asignado.
- **Primer login**: se vincula su `oid` de Entra; a partir de ahí cambiar el email no rompe el acceso, y otra identidad con el mismo email queda rechazada.
- **Baja**: deshabilitar la cuenta en Entra o sacarla del grupo impide nuevos logins al momento. La sesión ya abierta dura como máximo 8 h; para cortarla al instante se desactiva también en la app.

## 6. Controles de seguridad (resumen para auditoría / ISO 27001)

| Control | Estado |
|---|---|
| A.5.15–5.18 Control de acceso e identidades | Identidad centralizada en Entra, asignación por grupo, niveles en la app o por App roles |
| A.8.5 Autenticación segura | OIDC + PKCE, MFA y acceso condicional de Entra, SSO obligatorio opcional. Login local: contraseñas de 12+ caracteres con complejidad, bcrypt, límite de 10 intentos / 15 min por IP |
| A.8.2 Accesos privilegiados | Superadmin separado; desde Entra con `Biomasa.Superadmin` |
| A.8.15 Registro | Logins correctos y fallidos, cambios de usuarios y acciones administrativas en el log de auditoría |
| A.8.24 Criptografía | Solo TLS 1.2/1.3, HSTS 1 año, JWT firmados con secreto de 32+ bytes y algoritmo fijado |
| A.8.9 Configuración segura | CSP estricta sin scripts inline, X-Frame-Options DENY / frame-ancestors none, COOP, nosniff, Referrer-Policy no-referrer, Cache-Control no-store en la API, sin cabecera X-Powered-By |
| A.8.8 Vulnerabilidades técnicas | `npm audit` sin vulnerabilidades conocidas en frontend ni API (oct-2026) |

**Limitaciones conocidas, documentadas:**
- El token de sesión de la app se guarda en el almacenamiento del navegador (no en una cookie HttpOnly). Lo mitiga una CSP estricta sin scripts inline. Si IT exige cookie HttpOnly, es un cambio acotado en `src/lib/api.js` y en el middleware `requireAuth`.
- Los paneles externos (proveedor, astilladora, instalación) y las pantallas de campo usan enlaces con token propio, por diseño, para personal sin cuenta corporativa. Están fuera del SSO.

## 7. Infraestructura (Apache de IT)

- `Server: Apache/2.4.53 (Unix) OpenSSL/1.1.1n`: ambas versiones están sin soporte y tienen CVEs publicados. Hay que actualizar el contenedor `apache2` (2.4.6x + OpenSSL 3.x).
- `ServerTokens Prod` y `ServerSignature Off` en `httpd.conf`, para no publicar versiones.
- Aplicar el `apache/biomasa.conf` actualizado: quita el `X-Frame-Options SAMEORIGIN` que chocaba con el `DENY` de la app, envía `X-Forwarded-Proto` como cabecera de petición y limita a TLS 1.2/1.3.
- Salida HTTPS (443) del servidor hacia `login.microsoftonline.com` (ya hace falta para el envío de correo por Graph).
