# ── Frontend (Vite build) servido pelo Caddy, que também faz proxy da API ──────

# Estágio 1 — build dos estáticos
FROM node:20-alpine AS build
WORKDIR /app

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
# API no MESMO domínio, sob /api (proxy reverso do Caddy) → sem CORS.
# .env.production tem prioridade no `vite build` (modo production).
RUN printf 'VITE_API_URL=/api\n' > .env.production && npm run build

# Estágio 2 — Caddy serve os estáticos + faz proxy /api → backend
FROM caddy:2-alpine
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv
