#!/bin/bash
# ─────────────────────────────────────────────────────────────────
# deploy.sh — Despliega la app en el servidor
# Uso desde el servidor: cd /usr/local/app/biomasa && bash deploy.sh
# ─────────────────────────────────────────────────────────────────

set -e   # para si hay algún error

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  COMSA Biomasa · Desplegando..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 1. Bajar cambios del repositorio
echo "→ Descargando cambios..."
git pull origin main

# 2. Reconstruir solo los contenedores afectados y reinicar
echo "→ Reconstruyendo contenedores..."
docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d --build

echo ""
echo "✓ Desplegado correctamente"
echo ""

# 3. Mostrar estado
docker compose -f deploy/docker-compose.yml ps
