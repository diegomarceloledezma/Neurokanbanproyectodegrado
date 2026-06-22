#!/usr/bin/env bash
set -euo pipefail

ENV_FILE=".env.production"

if [ ! -f "${ENV_FILE}" ]; then
  echo "No existe ${ENV_FILE}. Primero crea el archivo .env.production."
  exit 1
fi

if [ $# -lt 1 ]; then
  echo "Uso: ./scripts/restore_postgres.sh backups/archivo.sql"
  exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "${BACKUP_FILE}" ]; then
  echo "No existe el archivo: ${BACKUP_FILE}"
  exit 1
fi

echo "Restaurando backup: ${BACKUP_FILE}"

cat "${BACKUP_FILE}" | docker compose --env-file "${ENV_FILE}" -f docker-compose.prod.yml exec -T db \
  sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'

echo "Restauración completada."