import hashlib


def hash_password(password: str) -> str:
    """Hash da senha (NÃO faz strip — preserva caracteres especiais e espaços)."""
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def verify_password(plain: str, hashed: str) -> bool:
    return hash_password(plain) == hashed


# Aliases p/ compatibilidade com código antigo (senha do admin é alfanumérica,
# mas o nome PIN ficou pelo legado)
def hash_pin(pin: str) -> str:
    """Versão p/ senha do admin — faz strip por compatibilidade."""
    return hashlib.sha256(pin.strip().encode("utf-8")).hexdigest()


def verify_pin(plain: str, hashed: str) -> bool:
    return hash_pin(plain) == hashed
