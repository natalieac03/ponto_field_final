from fastapi import APIRouter, Depends

from app.application import auth as auth_uc
from app.application.dtos import (
    AuthAdminRequest, AuthAdminResponse, AuthEmployeeRequest, AuthEmployeeResponse,
)
from app.infrastructure.config import MASTER_ADMIN_PASSWORD
from app.infrastructure.security import create_token
from app.presentation.deps import auth_rate_limit, employee_repo, settings_repo

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/employee", response_model=AuthEmployeeResponse)
def auth_employee(data: AuthEmployeeRequest, employees=Depends(employee_repo),
                  _rl: None = Depends(auth_rate_limit)):
    res = auth_uc.authenticate_employee(employees, data)
    token = create_token(role="employee", sub=res["id"], name=res["name"])
    return AuthEmployeeResponse(id=res["id"], name=res["name"], token=token)


@router.post("/admin", response_model=AuthAdminResponse)
def auth_admin(data: AuthAdminRequest, settings=Depends(settings_repo),
               employees=Depends(employee_repo),
               _rl: None = Depends(auth_rate_limit)):
    ident = auth_uc.authenticate_admin(settings, data, MASTER_ADMIN_PASSWORD, employees)
    token = create_token(role="admin", sub=ident["employee_id"] or "admin", name=ident["name"])
    return AuthAdminResponse(ok=True, token=token,
                             name=ident["name"], employee_id=ident["employee_id"])
