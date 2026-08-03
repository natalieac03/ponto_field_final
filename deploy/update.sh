#!/usr/bin/env bash
# Atualiza para uma nova versão SEM perder dados (o volume ./data fica intacto).
# Faz backup antes, rebuilda as imagens e sobe. Rode a partir de deploy/.
#
# Fluxo por bundle (.tar.gz): extraia o novo pacote por cima de ~/ponto-field ANTES
# de rodar este script. Fluxo por git: o script dá 'git pull' sozinho.
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

echo "==> Backup de segurança antes de atualizar..."
if [ -f ./backup.sh ] && [ -f ./data/che.db ]; then
  ./backup.sh || echo "Aviso: backup falhou (seguindo mesmo assim)."
else
  echo "(sem banco ainda — primeira subida; pulando backup)"
fi

if [ -d "$DIR/../.git" ]; then
  echo "==> Atualizando o código (git pull)..."
  git -C "$DIR/.." pull --ff-only
else
  echo "==> Sem git aqui: certifique-se de já ter extraído o novo bundle por cima."
fi

echo "==> Rebuild + subida..."
docker compose up -d --build

echo "==> Removendo imagens órfãs..."
docker image prune -f >/dev/null 2>&1 || true

docker compose ps
echo "Atualização concluída. Migrações de coluna do banco rodam sozinhas na subida."
