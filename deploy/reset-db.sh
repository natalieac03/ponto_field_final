#!/usr/bin/env bash
# Zera o banco (che.db) e os uploads para um começo LIMPO. Faz backup antes e
# exige confirmação. USO:  ./reset-db.sh
#
# OBS: um deploy novo (bundle) já sobe SEM banco — o app cria um vazio no 1º boot.
# Use este script só para limpar depois de testes no próprio servidor.
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

echo "ATENÇÃO: isto APAGA o banco (che.db) e todos os uploads em ./data (começo do zero)."
read -r -p "Digite LIMPAR para confirmar: " ans
[ "$ans" = "LIMPAR" ] || { echo "Cancelado."; exit 1; }

if [ -f ./data/che.db ]; then
  echo "==> Backup antes de apagar..."
  ./backup.sh || echo "Aviso: backup falhou (seguindo)."
fi

echo "==> Parando a API..."
docker compose stop api 2>/dev/null || true

rm -f ./data/che.db
rm -rf ./data/uploads
mkdir -p ./data/uploads

echo "==> Subindo a API (recria o banco vazio)..."
docker compose up -d api

echo "Banco limpo. O 1º acesso admin volta a usar a MASTER_ADMIN_PASSWORD do .env."
