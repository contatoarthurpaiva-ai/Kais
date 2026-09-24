#!/usr/bin/env bash
# Restauração testável do backup. Uso:
#   DATABASE_URL=... ./scripts/restore.sh caminho/para/kais-AAAA...dump
# Restaure SEMPRE em um banco de teste antes de confiar no backup.
set -euo pipefail
: "${DATABASE_URL:?defina DATABASE_URL (aponte para um banco de TESTE)}"
ARQ="${1:?informe o arquivo .dump}"
[ -f "$ARQ" ] || { echo "arquivo não encontrado: $ARQ"; exit 1; }
# --clean recria objetos; --if-exists evita erro se não existirem
pg_restore --clean --if-exists --no-owner -d "$DATABASE_URL" "$ARQ"
echo "Restauração concluída em $DATABASE_URL"
