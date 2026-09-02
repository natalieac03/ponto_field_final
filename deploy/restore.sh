#!/usr/bin/env bash
# Restaura um backup do banco. USO:  ./restore.sh backups/che_AAAAMMDD_HHMMSS.db.gz
# ATENÇÃO: sobrescreve o banco atual. Faça um backup antes, por garantia.
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
DATA="$DIR/data"
SRC="${1:-}"

if [ -z "$SRC" ] || [ ! -f "$SRC" ]; then
  echo "USO: $0 <arquivo che_*.db.gz | che_*.db.gz.enc>" >&2
  echo "Disponíveis:" >&2
  ls -1 "$DIR/backups"/che_*.db.gz 2>/dev/null || echo "  (nenhum backup encontrado)" >&2
  exit 1
fi

# Backup baixado do S3 vem cifrado (.enc) — decifra com BACKUP_PASSPHRASE do .env.
if [ "${SRC##*.}" = "enc" ]; then
  if [ -f "$DIR/.env" ]; then
    set -a; . "$DIR/.env"; set +a
  fi
  if [ -z "${BACKUP_PASSPHRASE:-}" ]; then
    echo "ERRO: $SRC está cifrado (.enc), mas BACKUP_PASSPHRASE não está no .env." >&2
    exit 1
  fi
  DECRYPTED="$(mktemp)"
  trap 'rm -f "$DECRYPTED"' EXIT
  openssl enc -d -aes-256-cbc -pbkdf2 -pass env:BACKUP_PASSPHRASE -in "$SRC" -out "$DECRYPTED"
  SRC="$DECRYPTED"
fi

echo "Parando a stack..."
docker compose stop api

echo "Restaurando $SRC → $DATA/che.db"
gunzip -c "$SRC" > "$DATA/che.db"

echo "Subindo a stack..."
docker compose start api

echo "Restauração concluída. Confira o sistema no navegador."
echo "OBS: para restaurar uploads, extraia o uploads_*.tar.gz correspondente em $DATA/."
