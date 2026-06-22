#!/usr/bin/env bash
set -euo pipefail

ENV_FILE=".env.production"

if [ ! -f "${ENV_FILE}" ]; then
  echo "No existe ${ENV_FILE}. Primero crea el archivo .env.production."
  exit 1
fi

BACKUP_DIR="./backups"
TIMESTAMP="$(date +'%Y%m%d_%H%M%S')"
BACKUP_FILE="${BACKUP_DIR}/neurokanban_${TIMESTAMP}.sql"

mkdir -p "${BACKUP_DIR}"

echo "Creando backup de PostgreSQL..."

docker compose --env-file "${ENV_FILE}" -f docker-compose.prod.yml exec -T db \
  sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > "${BACKUP_FILE}"

echo "Backup creado en: ${BACKUP_FILE}"