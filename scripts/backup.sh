#!/usr/bin/env bash
# Backup do Postgres da Kais. Requer pg_dump e a variável DATABASE_URL.
# Uso: DATABASE_URL=... ./scripts/backup.sh [pasta_destino]
set -euo pipefail
: "${DATABASE_URL:?defina DATABASE_URL}"
DEST="${1:-backups}"
mkdir -p "$DEST"
STAMP="$(date +%Y%m%d-%H%M%S)"
ARQ="$DEST/kais-$STAMP.dump"
# formato custom (-Fc) permite restauração seletiva com pg_restore
pg_dump "$DATABASE_URL" -Fc -f "$ARQ"
echo "Backup gravado: $ARQ"
# retenção: mantém os 30 mais recentes
ls -1t "$DEST"/kais-*.dump | tail -n +31 | xargs -r rm -f
echo "Retenção aplicada (mantidos os 30 mais recentes)."
