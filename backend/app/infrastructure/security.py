"""Tokens de sessão assinados (HMAC-SHA256) — sem dependências externas.

Formato: base64url(payload_json).base64url(hmac_sha256(SECRET, payload_b64))
Payload: {"role": "admin"|"employee", "sub": <int|str>, "name": <str|null>, "exp": <unix ts>}
"""
import base64
import hashlib
import hmac
import json
import os
import time

from app.infrastructure.config import IS_PROD

_secret = os.getenv("AUTH_SECRET")
if not _secret:
    if IS_PROD:
        raise RuntimeError(
            "AUTH_SECRET é obrigatório em produção. Defina a variável de ambiente "
            "com um valor aleatório longo (ex.: `python -c \"import secrets;print(secrets.token_urlsafe(48))\"`)."
        )
    _secret = "dev-insecure-secret-troque-em-producao"  # somente desenvolvimento
    # Aviso alto-contraste: se o deploy subir sem APP_ENV=production por engano
    # (fora do docker-compose.yml, que já fixa essa env), este é o único sinal
    # de que a instância está rodando com um segredo público e conhecido —
    # qualquer um poderia forjar um token de admin.
    print(
        "\n" + "!" * 70 +
        "\n!! AUTH_SECRET não definido — usando segredo de DESENVOLVIMENTO,\n"
        "!! PÚBLICO e CONHECIDO. Isso NUNCA deve rodar em produção.\n"
        "!! Se isto é produção, defina APP_ENV=production e AUTH_SECRET já.\n" +
        "!" * 70 + "\n"
    )
SECRET = _secret.encode("utf-8")
TOKEN_TTL_SECONDS = int(os.getenv("AUTH_TTL_SECONDS", str(12 * 3600)))


def _b64e(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def _b64d(txt: str) -> bytes:
    return base64.urlsafe_b64decode(txt + "=" * (-len(txt) % 4))


def _sign(body_b64: str) -> str:
    return _b64e(hmac.new(SECRET, body_b64.encode("ascii"), hashlib.sha256).digest())


def fingerprint(secret: str) -> str:
    """Impressão curta e não-reversível de um hash de senha, p/ carimbar o token
    (claim "sec") sem expor o hash em si num payload que o próprio cliente pode
    decodificar. Trocar a senha muda o hash → muda a impressão → tokens antigos
    param de bater na checagem de revogação (ver deps.py)."""
    return hashlib.sha256(secret.encode("utf-8")).hexdigest()[:16]


def create_token(role: str, sub, name: str | None = None, ttl: int | None = None,
                 sec: str | None = None) -> str:
    payload = {
        "role": role, "sub": sub, "name": name,
        "exp": int(time.time()) + (ttl if ttl is not None else TOKEN_TTL_SECONDS),
    }
    if sec:
        payload["sec"] = sec
    body = _b64e(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    return f"{body}.{_sign(body)}"


def decode_token(token: str) -> dict:
    """Retorna o payload se válido; levanta ValueError caso contrário."""
    try:
        body, sig = token.split(".")
    except ValueError:
        raise ValueError("Token malformado.")
    if not hmac.compare_digest(sig, _sign(body)):
        raise ValueError("Assinatura inválida.")
    payload = json.loads(_b64d(body))
    if int(payload.get("exp", 0)) < int(time.time()):
        raise ValueError("Token expirado.")
    return payload
