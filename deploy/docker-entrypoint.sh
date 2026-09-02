#!/bin/sh
# Sobe como root só para ajustar a dona do volume montado em /data (bind mount
# do host, criado com o dono do host) e então derruba privilégio pro usuário
# "app" antes de rodar o uvicorn — o processo da API nunca fica como root.
set -e
chown -R app:app /data
exec su -s /bin/sh app -c "uvicorn app.main:app --host 0.0.0.0 --port 8000"
