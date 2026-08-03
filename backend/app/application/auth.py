"""Casos de uso de autenticação. Não emitem token (isso é infra/apresentação):
retornam a identidade autenticada; a apresentação assina o token.

Mensagens de falha são genéricas ("Credenciais inválidas") para não permitir
enumeração de contas. Hashes legados são regravados em bcrypt no login (rehash).
"""
from app.application.dtos import AuthAdminRequest, AuthEmployeeRequest
from app.application.errors import PreconditionRequired, UnauthorizedError
from app.application.passwords import hash_pin, hash_password, needs_rehash, verify_password, verify_pin
from app.application.ports import EmployeeRepository, SettingsRepository

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
    return {"id": emp.id, "name": emp.name}


def authenticate_admin(settings: SettingsRepository, data: AuthAdminRequest,
                       master_password: str | None,
                       employees: EmployeeRepository | None = None) -> dict:
    """Identidade do gestor autenticado: {'name', 'employee_id'|None}.

    Ordem: 1) colaborador com is_admin (estrela) usando a PRÓPRIA senha —
    vem primeiro para a trilha de auditoria registrar o nome real de quem entrou;
    2) senha-mestra (env); 3) senha personalizada do painel.
    """
    if employees is not None:
        for emp in employees.list_all():
            if not getattr(emp, "active", True):
                continue
            if emp.is_admin and emp.pin_hash and verify_password(data.password, emp.pin_hash):
                if needs_rehash(emp.pin_hash):
                    emp.pin_hash = hash_password(data.password)
                    employees.update(emp)
                return {"name": emp.name, "employee_id": emp.id}
    if master_password and data.password.strip() == master_password:
        return {"name": "Administrador", "employee_id": None}
    s = settings.get_or_create()
    if s.admin_pin_hash and verify_pin(data.password, s.admin_pin_hash):
        if needs_rehash(s.admin_pin_hash):
            s.admin_pin_hash = hash_pin(data.password)
            settings.update(s)
        return {"name": "Administrador", "employee_id": None}
    raise UnauthorizedError(_INVALID)
