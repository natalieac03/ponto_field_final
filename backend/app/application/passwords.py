"""Hashing de senha/PIN. Utilitário de aplicação.

bcrypt (com salt) é o esquema atual. Hashes SHA-256 legados (64 hex, sem salt)
continuam sendo verificados para não invalidar senhas existentes, e são
regravados em bcrypt de forma transparente no próximo login (ver `needs_rehash`).
"""
import hashlib
import hmac
import re

import bcrypt

_BCRYPT_PREFIX = ("$2a$", "$2b$", "$2y$")
_SHA256_RE = re.compile(r"^[0-9a-f]{64}$")
_BCRYPT_MAX_BYTES = 72  # limite do algoritmo


def _to_bytes(secret: str) -> bytes:
    return secret.encode("utf-8")[:_BCRYPT_MAX_BYTES]


def hash_password(password: str) -> str:
    return bcrypt.hashpw(_to_bytes(password), bcrypt.gensalt()).decode("ascii")


def _is_bcrypt(hashed: str) -> bool:
    return hashed.startswith(_BCRYPT_PREFIX)


def verify_password(plain: str, hashed: str) -> bool:
    if not hashed:
        return False
    if _is_bcrypt(hashed):
        try:
            return bcrypt.checkpw(_to_bytes(plain), hashed.encode("ascii"))
        except ValueError:
            return False
    # Legado SHA-256 sem salt (comparação em tempo ~constante).
    if _SHA256_RE.match(hashed):
        legacy = hashlib.sha256(plain.encode("utf-8")).hexdigest()
        return hmac.compare_digest(legacy, hashed)
    return False


def needs_rehash(hashed: str) -> bool:
    """True quando o hash não está no esquema atual (bcrypt) e deve ser regravado."""
    return not (hashed and _is_bcrypt(hashed))


# PIN usa o mesmo esquema (strip para tolerar espaços). Mantido por compatibilidade
# com os chamadores existentes (senha do admin).
def hash_pin(pin: str) -> str:
    return hash_password(pin.strip())


def verify_pin(plain: str, hashed: str) -> bool:
    return verify_password(plain.strip(), hashed)
