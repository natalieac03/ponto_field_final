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
def _identity_from_token(token: str | None) -> dict:
    if not token:
        raise UnauthorizedError("Não autenticado.")
    try:
        return decode_token(token)
    except ValueError:
        raise UnauthorizedError("Sessão inválida ou expirada.")


def get_identity(authorization: str | None = Header(default=None)) -> dict:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise UnauthorizedError("Não autenticado.")
    return _identity_from_token(authorization[7:].strip())


def get_identity_flexible(request: Request, authorization: str | None = Header(default=None)) -> dict:
    """Como get_identity, mas também aceita o token via query string (?t=).

    Usado só nas rotas de download de foto/anexo, carregadas pelo browser via
    <img src>/<a href>/download direto — não é possível anexar o header
    Authorization nesses casos.
    """
    token = None
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization[7:].strip()
    else:
        token = request.query_params.get("t")
    return _identity_from_token(token)


def require_admin(identity: dict = Depends(get_identity)) -> dict:
    if not idt.is_admin(identity):
        raise ForbiddenError("Acesso restrito ao administrador.")
    return identity


def require_auth(identity: dict = Depends(get_identity)) -> dict:
    """Qualquer usuário autenticado (admin ou colaborador) — para leitura compartilhada."""
    return identity


def require_auth_download(identity: dict = Depends(get_identity_flexible)) -> dict:
    """Autenticado — aceita token via header OU query string (?t=)."""
    return identity


def client_ip(request: Request) -> str:
    """IP real do cliente por trás do Caddy.

    O Caddy ACRESCENTA o IP do cliente ao final do X-Forwarded-For (não
    substitui um valor já existente) — por isso usamos o ÚLTIMO IP da lista,
    não o primeiro. O primeiro é controlado pelo próprio cliente (um
    atacante pode enviar um X-Forwarded-For forjado para burlar o rate
    limit por IP), enquanto o último é o que o Caddy efetivamente viu na
    conexão.
    """
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[-1].strip()
    return request.client.host if request.client else "unknown"


def auth_rate_limit(request: Request) -> None:
    """Anti brute-force: limita tentativas de login por IP de origem."""
    ip = client_ip(request)
    if not login_limiter.check(f"login:{ip}"):
        raise TooManyRequests("Muitas tentativas de login. Aguarde alguns minutos e tente novamente.")
