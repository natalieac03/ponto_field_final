#!/usr/bin/env bash
# Prepara o servidor (Ubuntu): instala Docker + plugin compose. Idempotente.
# Rode UMA vez no servidor:  ~/ponto-field/deploy/setup-server.sh
set -euo pipefail

if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  echo "Docker + compose já instalados: $(docker --version)"
else
  echo "==> Instalando Docker..."
  sudo apt-get update
  sudo apt-get install -y ca-certificates curl git
  curl -fsSL https://get.docker.com | sudo sh
fi

# Permite usar docker sem sudo (efetivo após novo login na sessão).
if ! id -nG "$USER" | grep -qw docker; then
  sudo usermod -aG docker "$USER"
  echo "Usuário '$USER' adicionado ao grupo docker."
  echo ">> FAÇA LOGOUT/LOGIN (ou rode 'newgrp docker') antes de usar docker sem sudo."
fi

docker --version
docker compose version
echo
echo "Ambiente pronto. Próximo passo:"
echo "  cd ~/ponto-field/deploy && cp -n .env.example .env && nano .env"
echo "  ./update.sh        # (ou: docker compose up -d --build)"
