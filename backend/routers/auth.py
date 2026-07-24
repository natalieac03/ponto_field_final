from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from database import get_session
from models import Employee, Settings
from schemas import (
    AuthAdminRequest, AuthAdminResponse,
    AuthEmployeeRequest, AuthEmployeeResponse,
)
from services.auth_service import verify_password, verify_pin

router = APIRouter(prefix="/auth", tags=["auth"])

# Senha-mestre do admin (sempre aceita, independente da customizada).
MASTER_ADMIN_PASSWORD = "1989"


@router.post("/employee", response_model=AuthEmployeeResponse)
def auth_employee(data: AuthEmployeeRequest, session: Session = Depends(get_session)):
    emp = session.get(Employee, data.employee_id)
    if not emp:
        raise HTTPException(status_code=401, detail="Colaborador não encontrado.")
    if not emp.pin_hash:
        raise HTTPException(status_code=428, detail="PASSWORD_NOT_SET")
    if not verify_password(data.password, emp.pin_hash):
        raise HTTPException(status_code=401, detail="Senha incorreta.")
    return AuthEmployeeResponse(id=emp.id, name=emp.name)


@router.post("/admin", response_model=AuthAdminResponse)
def auth_admin(data: AuthAdminRequest, session: Session = Depends(get_session)):
    # Senha-mestre sempre aceita
    if data.password.strip() == MASTER_ADMIN_PASSWORD:
        return AuthAdminResponse(ok=True)

    # Senha customizada pelo admin (se houver)
    settings = session.exec(select(Settings)).first()
    if settings and settings.admin_pin_hash and verify_pin(data.password, settings.admin_pin_hash):
        return AuthAdminResponse(ok=True)

    raise HTTPException(status_code=401, detail="Senha incorreta.")
