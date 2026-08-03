#!/usr/bin/env bash
# Backup consistente do banco (che.db) + uploads. Rode a partir da pasta deploy/.
# Agende no cron (ver DEPLOY.md). Retenção padrão: 30 dias.
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"

# Variáveis opcionais (S3_BUCKET, RETENTION_DAYS) podem vir do .env.
if [ -f "$DIR/.env" ]; then
  set -a; . "$DIR/.env"; set +a
fi

DATA="$DIR/data"
DEST="$DIR/backups"
STAMP="$(date +%Y%m%d_%H%M%S)"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

mkdir -p "$DEST"

if [ ! -f "$DATA/che.db" ]; then
  echo "ERRO: $DATA/che.db não encontrado. A stack já rodou pelo menos uma vez?" >&2
  exit 1
fi

# Backup ONLINE do SQLite (consistente mesmo com a app rodando) usando o Python
# do próprio container da API. Cai para cópia simples se o compose não responder.
if docker compose ps api >/dev/null 2>&1 && docker compose exec -T api python - <<'PY' 2>/dev/null
import sqlite3
src = sqlite3.connect("/data/che.db")
dst = sqlite3.connect("/data/.backup_tmp.db")
with dst:
    src.backup(dst)
dst.close(); src.close()
PY
then
  mv "$DATA/.backup_tmp.db" "$DEST/che_$STAMP.db"
else
  echo "Aviso: usando cópia simples (container indisponível)." >&2
  cp "$DATA/che.db" "$DEST/che_$STAMP.db"
fi

gzip -f "$DEST/che_$STAMP.db"

# Uploads (fotos + anexos), se existirem.
if [ -d "$DATA/uploads" ]; then
  tar -czf "$DEST/uploads_$STAMP.tar.gz" -C "$DATA" uploads
fi

# Retenção local.
find "$DEST" -name 'che_*.db.gz'      -mtime "+$RETENTION_DAYS" -delete
find "$DEST" -name 'uploads_*.tar.gz' -mtime "+$RETENTION_DAYS" -delete

echo "Backup OK → $DEST/che_$STAMP.db.gz"

# Cópia off-site no S3 (opcional): se S3_BUCKET estiver definido e o aws CLI presente.
if [ -n "${S3_BUCKET:-}" ]; then
  if command -v aws >/dev/null 2>&1; then
    aws s3 sync "$DEST" "s3://$S3_BUCKET/pontofield-backups/" --only-show-errors
    echo "Off-site OK → s3://$S3_BUCKET/pontofield-backups/"
  else
    echo "Aviso: S3_BUCKET definido, mas 'aws' não encontrado — pulei o off-site." >&2
  fi
fi
