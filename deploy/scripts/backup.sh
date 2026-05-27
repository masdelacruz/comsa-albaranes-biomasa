#!/bin/bash
FECHA=$(date +%Y%m%d_%H%M%S)
DEST=/opt/biomasa/backups
mkdir -p $DEST
docker exec biomasa_db pg_dump -U biomasa_user -d biomasa --no-password > $DEST/biomasa_${FECHA}.sql
gzip $DEST/biomasa_${FECHA}.sql
find $DEST -name "biomasa_*.sql.gz" -mtime +30 -delete
echo "Backup OK: $DEST/biomasa_${FECHA}.sql.gz"
