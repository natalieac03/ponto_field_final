# ── Backend FastAPI — Ponto_Field ──────────────────────────────────────────
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Dependências primeiro (aproveita cache de camada entre builds)
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Código da aplicação (camada Clean Architecture: app/{domain,application,infrastructure,presentation})
COPY backend/app ./app

# Dados persistentes (banco SQLite + uploads) vivem no volume montado em /data.
# Sobrescreve os defaults relativos de config.py para caminhos absolutos no volume.
ENV DATABASE_URL=sqlite:////data/che.db \
    UPLOAD_DIR=/data/uploads
RUN mkdir -p /data/uploads

# Usuário sem privilégio para rodar o processo da API (o container não roda como root).
RUN groupadd -r app && useradd -r -g app -u 1000 app

COPY deploy/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 8000

# Um worker uvicorn: SQLite serializa escritas; para a escala interna atual é o
# mais seguro (evita contenção de lock). Escalar → Postgres (ver roadmap).
# O entrypoint ajusta a dona de /data (volume do host) e derruba pro usuário "app".
ENTRYPOINT ["/docker-entrypoint.sh"]
