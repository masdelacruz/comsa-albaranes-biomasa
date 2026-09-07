# Fase 0 de seguridad

Este documento registra los cambios urgentes de seguridad y las evidencias de
despliegue. No constituye por sí solo una certificación ISO/IEC 27001.

## Entrega 0A: identidad y credenciales

### Controles implantados

- Las contraseñas se conservan exclusivamente como hashes bcrypt (coste 12).
- Se elimina la contraseña predeterminada compartida.
- Las nuevas contraseñas deben tener entre 12 caracteres y 72 bytes e incluir
  mayúsculas, minúsculas, números y símbolos.
- Los cambios de contraseña, nivel, estado o acceso a aplicaciones revocan las
  sesiones activas del usuario.
- Cada petición autenticada comprueba en base de datos que la cuenta continúa
  activa y utiliza los permisos vigentes.
- Solo un superadministrador puede listar o administrar usuarios.
- Un superadministrador no puede borrarse, desactivarse o degradarse a sí
  mismo desde la aplicación.
- En producción, la API no arranca si faltan secretos esenciales o si
  `JWT_SECRET` tiene menos de 32 bytes.

### Orden obligatorio de despliegue

1. Crear un backup cifrado de PostgreSQL y verificar que no está vacío.
2. Ejecutar `scripts/migrate_013_credential_hardening.sql` en la base de datos.
3. Desplegar la nueva imagen de la aplicación.
4. Comprobar login local, login Microsoft, alta de usuario y cambio de nivel.
5. Confirmar que una sesión anterior deja de funcionar tras desactivar la
   cuenta o cambiar su contraseña.
6. Forzar el restablecimiento de todas las contraseñas locales que estuvieron
   almacenadas en `password_visible`.
7. Registrar ejecutor, fecha, resultado y referencia del cambio.

La migración elimina datos sensibles y no debe ejecutarse sin backup probado.
Los JWT emitidos antes de esta entrega quedan invalidados deliberadamente.

### Pruebas de aceptación

- Una contraseña débil recibe HTTP 400.
- La respuesta de usuarios nunca incluye hashes ni contraseñas.
- Un usuario no superadministrador recibe HTTP 403 en `GET /api/usuarios`.
- Una cuenta desactivada recibe HTTP 403 aun usando un token emitido antes.
- Un token con una versión anterior recibe HTTP 401.
- La base de datos ya no contiene la columna `password_visible`.

## Entrega 0B: enlaces de campo con token propio

### Controles implantados

- Cada albarán tiene un `campo_token` propio (24 bytes aleatorios), generado
  al crearse. Es la credencial real de los enlaces de campo — el id
  correlativo del albarán ya no basta por sí solo para leer ni modificar nada.
- `GET /albaranes/:id` y todas las acciones públicas de campo (firmar,
  rechazar, solicitar revisión, observaciones, subir ticket de pesada) exigen
  o bien una sesión de oficina válida o bien `?t=<campo_token>` correcto para
  ese albarán concreto.
- La firma de "oficina" no puede registrarse nunca desde un enlace de campo,
  solo desde una sesión de oficina autenticada.
- Un enlace de campo no puede sobrescribir una firma ya registrada (evita
  firmas repetidas o modificadas en silencio); la oficina autenticada sí
  puede corregir.
- No se admiten firmas sobre un albarán ya cerrado, cancelado o rechazado.
- Un superadmin u oficina puede regenerar el enlace de un albarán en
  cualquier momento — el enlace anterior deja de funcionar al instante
  (revocación manual, botón en el detalle del albarán).

### Orden obligatorio de despliegue

1. Ejecutar `scripts/migrate_014_campo_token.sql` (genera el token de cada
   albarán existente).
2. Desplegar la nueva imagen de la API y el frontend juntos — el frontend ya
   añade `?t=` a los enlaces que genera.
3. Los enlaces de campo compartidos **antes** de este despliegue (WhatsApp,
   email, etc.) dejarán de funcionar en el momento del despliegue, igual que
   las sesiones de oficina abiertas (ver Entrega 0A). Avisar a los equipos de
   campo y reenviar los enlaces de los albaranes en curso justo después de
   desplegar.

## Entrega 0C: bucket privado y descargas firmadas

### Controles implantados

- El bucket de MinIO deja de tener política de lectura pública.
- La base de datos guarda solo el path del objeto, nunca una URL utilizable
  directamente. La API firma cada URL de documento, firma de empresa, ticket
  de pesada y logo con HMAC-SHA256 y caducidad (24 h), y las regenera en cada
  respuesta.
- `GET /api/storage/file/*` exige una firma válida y no caducada — ya no es
  de lectura libre.
- Se ejecuta `scripts/migrate_015_storage_paths.sql` para convertir las URLs
  ya guardadas en la base de datos (formato antiguo) a solo su path.

## Entrega 0D: validación de cargas y transiciones

### Controles implantados

- Los ficheros subidos (documentos, tickets de pesada, firmas de empresa,
  logos) se comprueban por cabecera real (magic bytes), no solo por
  extensión o `Content-Type` declarado por el cliente.
- Ver también en 0B: validación de rol, estado del albarán y firma ya
  registrada antes de aceptar una firma.

## Entrega 0B (cierre): código de acceso por empresa

### Controles implantados

- Cada empresa (proveedor/astilladora/transportista/instalación) tiene un
  `acceso_codigo` propio (16 bytes aleatorios). Los paneles públicos por
  nombre (`/campo/instalacion/:nombre`, `/campo/astilladora/:nombre`) y sus
  notificaciones exigen ahora sesión de oficina o `?c=<acceso_codigo>`
  correcto — adivinar o conocer el nombre de la empresa ya no basta para ver
  su cola de entregas.
- Botones en Configuración → Empresas para copiar el enlace del panel (con
  su código) y para regenerarlo (revocación — el enlace anterior deja de
  funcionar al instante).

### Despliegue

Ejecutar `scripts/migrate_016_empresa_acceso_codigo.sql` (genera el código de
cada empresa existente) antes de desplegar la imagen nueva. Los enlaces de
panel ya compartidos con las empresas (guardados como favorito, impresos,
etc.) dejarán de funcionar hasta que se les reenvíe el enlace nuevo con
`?c=`.

## Entregas pendientes de Fase 0

- 0E: rate limiting compartido y registro de eventos de autenticación en
  todos los endpoints públicos (hoy solo existe en login).
