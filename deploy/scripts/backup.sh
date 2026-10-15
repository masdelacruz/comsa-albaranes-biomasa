#!/bin/bash
# Copia nocturna (cron 02:00): base de datos + ficheros de MinIO (documentos,
# firmas, tickets de pesada, logos). Sin MinIO, una restauración dejaría los
# albaranes sin sus adjuntos. Se conservan 30 días.
# Pendiente: copia fuera de este servidor (ahora todo vive en el mismo disco).
set -euo pipefail
FECHA=$(date +%Y%m%d_%H%M%S)
DEST=/opt/biomasa/backups
mkdir -p "$DEST"

# 1. PostgreSQL (si pg_dump falla, pipefail hace que el script falle y no quede un .gz vacío)
docker exec biomasa_db pg_dump -U biomasa_user -d biomasa --no-password | gzip > "$DEST/biomasa_${FECHA}.sql.gz.tmp"
mv "$DEST/biomasa_${FECHA}.sql.gz.tmp" "$DEST/biomasa_${FECHA}.sql.gz"

# 2. MinIO: copia del volumen en solo lectura
docker run --rm -v biomasa_minio_data:/data:ro -v "$DEST":/backup alpine \
  tar czf "/backup/minio_${FECHA}.tar.gz.tmp" -C /data .
mv "$DEST/minio_${FECHA}.tar.gz.tmp" "$DEST/minio_${FECHA}.tar.gz"

find "$DEST" -name "biomasa_*.sql.gz" -mtime +30 -delete
find "$DEST" -name "minio_*.tar.gz"   -mtime +30 -delete
find "$DEST" -name "*.tmp"            -mtime +1  -delete

echo "Backup OK $FECHA: BD $(du -h "$DEST/biomasa_${FECHA}.sql.gz" | cut -f1) · MinIO $(du -h "$DEST/minio_${FECHA}.tar.gz" | cut -f1)"
