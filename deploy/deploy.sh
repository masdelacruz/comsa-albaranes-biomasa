#!/bin/bash
# ─────────────────────────────────────────────────────────────────
# deploy.sh — Actualiza la imagen de la API en producción
#
# El servidor NO contiene clon del repositorio.
# GitHub Actions construye y publica la imagen en GHCR al hacer
# push a master. Este script solo descarga la nueva imagen y
# reinicia el contenedor de la API.
#
# Uso en el servidor (desde /opt/biomasa):
#   bash deploy.sh
#
# Uso remoto desde la máquina local:
#   ssh root@82.223.204.73 'cd /opt/biomasa && bash -s' < deploy/deploy.sh
# ─────────────────────────────────────────────────────────────────

set -e

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  COMSA Biomasa · Desplegando..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 1. Aplicar migraciones pendientes (seguras de re-ejecutar)
echo "→ Aplicando migraciones SQL..."
for f in scripts/migrate_*.sql; do
  echo "  · $f"
  docker exec -i biomasa_db psql \
    -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" < "$f"
done

# 2. Descargar nueva imagen de la API desde GHCR
echo "→ Descargando nueva imagen API..."
docker compose pull api

# 3. Recrear solo el contenedor api (DB y MinIO no se tocan)
echo "→ Aplicando nueva imagen..."
docker compose up -d

echo ""
echo "✓ Desplegado correctamente"
echo ""

# 4. Estado final de los contenedores
docker compose ps
