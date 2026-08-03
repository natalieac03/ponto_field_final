"""Ponto de entrada FastAPI — camada de apresentação. Entrypoint: `app.main:app`."""
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.application.errors import AppError
from app.infrastructure.config import CORS_ORIGINS, IS_PROD
from app.infrastructure.database import create_db_and_tables
from app.presentation.routers import (
    activity, auth, calendar as calendar_router, employees, records, reports,
    settings as settings_router,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    # Instala o calendário editável no motor de cálculo (H3/dispensas)
    from sqlmodel import Session
    from app.application.calendar import sync_engine, sync_leaves, sync_shifts
    from app.infrastructure.database import engine
    with Session(engine) as session:
        sync_engine(session)
        sync_leaves(session)
        sync_shifts(session)
        # Recalcula registros migrados de versões antigas (effective NULL)
        from app.application.records import backfill_missing_calculations
        n = backfill_missing_calculations(session)
        if n:
            print(f"[startup] {n} registro(s) antigos recalculados para o modelo atual.")
    yield


app = FastAPI(title="Ponto_Field", version="3.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    """Cabeçalhos de segurança em toda resposta (defesa em profundidade)."""
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    # cross-origin: front e back podem estar em domínios diferentes (ex.: Railway);
    # o acesso continua protegido pelo CORS allowlist.
    response.headers["Cross-Origin-Resource-Policy"] = "cross-origin"
    if IS_PROD:
        response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains"
    return response


@app.exception_handler(AppError)
async def app_error_handler(_request: Request, exc: AppError):
    """Mapeia erros de aplicação para HTTP (mantém contrato: {'detail': ...})."""
    return JSONResponse(status_code=exc.status, content={"detail": exc.message})


app.include_router(auth.router)
app.include_router(employees.router)
app.include_router(records.router)
app.include_router(reports.router)
app.include_router(settings_router.router)
app.include_router(calendar_router.router)
app.include_router(activity.router)


@app.get("/")
def root():
    return {"status": "ok", "app": "Ponto_Field"}
