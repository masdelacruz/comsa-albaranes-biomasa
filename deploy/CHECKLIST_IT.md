# Checklist IT — Despliegue biomasa.cserintranet.com

## ✅ Ya resuelto

- [x] Red Docker `biomasa` existente — apache2 ya conectado
- [x] SMTP: smtp.serviciodecorreo.es:465 · biomasa@cserintranet.com
- [x] Puerto 8080 expuesto al host desde biomasa_nginx
- [x] Apache proxea a localhost:8080 (no depende de resolución de nombre de contenedor)
- [x] SSL gestionado 100% por Apache — los contenedores internos usan HTTP plano

## 🔴 Bloqueante para arrancar

- [ ] **Firewall**: confirmar que el puerto 8080 del host no está bloqueado
      (necesario mientras no hay DNS externo — se puede probar con http://82.223.104.137:8080)

## 🟡 Para pruebas internas (DNS en hosts local ya funciona)

Pasos para activar el VirtualHost HTTP:

```bash
# 1. Copiar el fichero de configuración
cp biomasa.conf /usr/local/app/apache2/conf/extra/biomasa.conf

# 2. Añadir Include al final de httpd.conf (solo si no existe ya)
echo 'Include /usr/local/apache2/conf/extra/biomasa.conf' \
  >> /usr/local/app/apache2/conf/httpd.conf

# 3. Verificar sintaxis
docker exec apache2 httpd -t    # debe decir "Syntax OK"

# 4. Recargar sin cortar las otras apps
docker exec apache2 httpd -k graceful
```

Resultado esperado:
- http://biomasa.cserintranet.com → app funcionando (vía Apache)
- http://82.223.104.137:8080     → app funcionando (acceso directo, para pruebas)

## 🟠 Pendiente para producción real

- [ ] **DNS externo**: que biomasa.cserintranet.com resuelva desde fuera de la red
- [ ] **Certificado SSL**: IT entrega los ficheros .crt y .key
      → Descomentar bloque HTTPS en biomasa.conf, comentar el HTTP
      → `docker exec apache2 httpd -k graceful`
- [ ] **Módulos Apache activos** (probablemente ya están):
      `docker exec apache2 httpd -M | grep -E 'proxy|rewrite|ssl|headers'`
