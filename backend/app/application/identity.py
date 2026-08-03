"""Autorização baseada na identidade (dict do token). Puro — sem crypto/framework."""
from app.application.errors import ForbiddenError


def is_admin(identity: dict) -> bool:
    return identity.get("role") == "admin"


def owns(identity: dict, employee_id: int) -> bool:
    return identity.get("role") == "employee" and identity.get("sub") == employee_id


def ensure_self_or_admin(identity: dict, employee_id: int) -> None:
    if is_admin(identity) or owns(identity, employee_id):
        return
    raise ForbiddenError("Você só pode acessar os seus próprios dados.")
