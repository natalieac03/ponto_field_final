"""Casos de uso de autenticação. Não emitem token (isso é infra/apresentação):
retornam a identidade autenticada; a apresentação assina o token.

Mensagens de falha são genéricas ("Credenciais inválidas") para não permitir
enumeração de contas. Hashes legados são regravados em bcrypt no login (rehash).
"""
from app.application.dtos import AuthAdminRequest, AuthEmployeeRequest
from app.application.errors import PreconditionRequired, UnauthorizedError
from app.application.passwords import hash_password, needs_rehash, verify_password
from app.application.ports import EmployeeRepository

_INVALID = "Credenciais inválidas."


def authenticate_employee(employees: EmployeeRepository, data: AuthEmployeeRequest) -> dict:
    """Retorna {'id', 'name'} do colaborador autenticado."""
    emp = employees.get(data.employee_id)
    if not emp:
        raise UnauthorizedError(_INVALID)
    if not getattr(emp, "active", True):
        raise UnauthorizedError("Colaborador desligado. Fale com o gestor.")
    if not emp.pin_hash:
        raise PreconditionRequired("PASSWORD_NOT_SET")
    if not verify_password(data.password, emp.pin_hash):
        raise UnauthorizedError(_INVALID)
    # Rehash transparente de hash legado (SHA-256) → bcrypt.
    if needs_rehash(emp.pin_hash):
        emp.pin_hash = hash_password(data.password)
        employees.update(emp)
    return {"id": emp.id, "name": emp.name, "pin_hash": emp.pin_hash}


def authenticate_admin(data: AuthAdminRequest, master_password: str | None,
                       employees: EmployeeRepository) -> dict:
    """Identidade do gestor autenticado: {'name', 'employee_id'|None}.

    Ordem: 1) colaborador com is_admin (estrela) usando a PRÓPRIA senha —
    vem primeiro para a trilha de auditoria registrar o nome real de quem entrou;
    2) senha-mestra (env) — mecanismo de bootstrap/recuperação controlado fora
    da aplicação (variável de ambiente do servidor), não redefinível por ela.
    """
    for emp in employees.list_all():
        if not getattr(emp, "active", True):
            continue
        if emp.is_admin and emp.pin_hash and verify_password(data.password, emp.pin_hash):
            if needs_rehash(emp.pin_hash):
                emp.pin_hash = hash_password(data.password)
                employees.update(emp)
            return {"name": emp.name, "employee_id": emp.id, "pin_hash": emp.pin_hash}
    if master_password and data.password.strip() == master_password:
        # Senha-mestra (env) — sem hash persistido p/ carimbar; sessão só expira
        # naturalmente (TTL) ou trocando AUTH_SECRET/redeploy.
        return {"name": "Administrador", "employee_id": None, "pin_hash": None}
    raise UnauthorizedError(_INVALID)
