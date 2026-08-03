"""Injeção de dependência da apresentação: sessão, repositórios e identidade."""
from fastapi import Depends, Header, Request
from sqlmodel import Session

from app.application import identity as idt
from app.application.errors import ForbiddenError, TooManyRequests, UnauthorizedError
from app.infrastructure.database import get_session
from app.infrastructure.ratelimit import login_limiter
from app.infrastructure.repositories import (
    SqlActivityLogRepository, SqlEmployeeRepository, SqlRecordRepository, SqlSettingsRepository,
)
from app.infrastructure.security import decode_token
from app.infrastructure.storage import build_storage


# ── Repositórios / storage ───────────────────────────────────────────────────
def employee_repo(session: Session = Depends(get_session)) -> SqlEmployeeRepository:
    return SqlEmployeeRepository(session)


def record_repo(session: Session = Depends(get_session)) -> SqlRecordRepository:
    return SqlRecordRepository(session)


def settings_repo(session: Session = Depends(get_session)) -> SqlSettingsRepository:
    return SqlSettingsRepository(session)


def activity_repo(session: Session = Depends(get_session)) -> SqlActivityLogRepository:
    return SqlActivityLogRepository(session)


_STORAGE = build_storage()

def attachment_storage():
    return _STORAGE


# ── Identidade / autorização ─────────────────────────────────────────────────
def get_identity(authorization: str | None = Header(default=None)) -> dict:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise UnauthorizedError("Não autenticado.")
    token = authorization[7:].strip()
    try:
        return decode_token(token)
    except ValueError:
        raise UnauthorizedError("Sessão inválida ou expirada.")


def require_admin(identity: dict = Depends(get_identity)) -> dict:
    if not idt.is_admin(identity):
        raise ForbiddenError("Acesso restrito ao administrador.")
    return identity


def auth_rate_limit(request: Request) -> None:
    """Anti brute-force: limita tentativas de login por IP de origem."""
    client = request.client.host if request.client else "unknown"
    # Respeita proxy reverso (1º IP do X-Forwarded-For), se presente.
    fwd = request.headers.get("x-forwarded-for")
    ip = fwd.split(",")[0].strip() if fwd else client
    if not login_limiter.check(f"login:{ip}"):
        raise TooManyRequests("Muitas tentativas de login. Aguarde alguns minutos e tente novamente.")
