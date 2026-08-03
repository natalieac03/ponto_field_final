from fastapi import APIRouter, Depends, File, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel

from app.application import activity, employees as uc
from app.application.dtos import (
    EmployeeCreate, EmployeePasswordChange, EmployeePasswordSet, EmployeeProfileUpdate,
    EmployeePublicRead, EmployeeRead, EmployeeRename, WeeklySchedule,
)
from app.application.identity import ensure_self_or_admin
from app.presentation.deps import (
    activity_repo, attachment_storage, employee_repo, get_identity, require_admin,
)

router = APIRouter(prefix="/employees", tags=["employees"])


def _log_emp(logs, actor: dict, emp: EmployeeRead, action: str, desc: str) -> None:
    activity.log(logs, actor, action=action, description=desc,
                 entity_type="employee", entity_id=emp.id, employee_id=emp.id)


@router.get("/public", response_model=list[EmployeePublicRead])
def list_employees_public(employees=Depends(employee_repo)):
    """Público — a landing lista só id/nome/tem-senha p/ o colaborador se identificar."""
    return uc.get_all_public(employees)


@router.get("", response_model=list[EmployeeRead])
def list_employees(employees=Depends(employee_repo), admin: dict = Depends(require_admin)):
    """Restrito ao admin — expõe perfil de RH, jornada e status de senha."""
    return uc.get_all(employees)


class _Deactivate(BaseModel):
    termination_date: str | None = None


@router.post("/{employee_id}/deactivate", response_model=EmployeeRead)
def deactivate_employee(employee_id: int, data: _Deactivate,
                        employees=Depends(employee_repo), logs=Depends(activity_repo),
                        admin: dict = Depends(require_admin)):
    """Inativa (desliga) — mantém histórico e permite reativar depois."""
    emp = uc.deactivate(employees, employee_id, data.termination_date)
    _log_emp(logs, admin, emp, "employee.deactivate",
             f"Colaborador {emp.name} desligado em {emp.termination_date}")
    return emp


@router.post("/{employee_id}/reactivate", response_model=EmployeeRead)
def reactivate_employee(employee_id: int, employees=Depends(employee_repo),
                        logs=Depends(activity_repo), admin: dict = Depends(require_admin)):
    emp = uc.reactivate(employees, employee_id)
    _log_emp(logs, admin, emp, "employee.reactivate", f"Colaborador {emp.name} reativado")
    return emp


@router.get("/{employee_id}", response_model=EmployeeRead)
def get_employee(employee_id: int, employees=Depends(employee_repo),
                 identity: dict = Depends(get_identity)):
    """Dados completos de um colaborador — o próprio ou o admin."""
    ensure_self_or_admin(identity, employee_id)
    return uc.get_one(employees, employee_id)


@router.post("", response_model=EmployeeRead, status_code=201)
def add_employee(data: EmployeeCreate, employees=Depends(employee_repo),
                 logs=Depends(activity_repo), admin: dict = Depends(require_admin)):
    emp = uc.create(employees, data)
    _log_emp(logs, admin, emp, "colaborador_criado", f"Cadastrou o colaborador {emp.name}")
    return emp


@router.patch("/{employee_id}/name", response_model=EmployeeRead)
def rename_employee(employee_id: int, data: EmployeeRename, employees=Depends(employee_repo),
                    logs=Depends(activity_repo), admin: dict = Depends(require_admin)):
    emp = uc.rename(employees, employee_id, data.name)
    _log_emp(logs, admin, emp, "colaborador_renomeado", f"Renomeou colaborador para {emp.name}")
    return emp


@router.post("/{employee_id}/password", response_model=EmployeeRead)
def set_password_first_time(employee_id: int, data: EmployeePasswordSet, employees=Depends(employee_repo)):
    """1º acesso — define senha (público). 409 se já tiver senha."""
    return uc.set_password_first_time(employees, employee_id, data)


@router.patch("/{employee_id}/password", response_model=EmployeeRead)
def change_password(employee_id: int, data: EmployeePasswordChange, employees=Depends(employee_repo),
                    logs=Depends(activity_repo), identity: dict = Depends(get_identity)):
    ensure_self_or_admin(identity, employee_id)
    emp = uc.change_password(employees, employee_id, data)
    _log_emp(logs, identity, emp, "senha_alterada", "Alterou a senha de acesso")
    return emp


@router.patch("/{employee_id}/profile", response_model=EmployeeRead)
def update_profile(employee_id: int, data: EmployeeProfileUpdate, employees=Depends(employee_repo),
                   logs=Depends(activity_repo), admin: dict = Depends(require_admin)):
    """Dados de RH (cargo, admissão, contato, contrato) — geridos pelo gestor."""
    emp = uc.update_profile(employees, employee_id, data)
    _log_emp(logs, admin, emp, "perfil_atualizado", f"Atualizou o perfil de {emp.name}")
    return emp


@router.put("/{employee_id}/schedule", response_model=EmployeeRead)
def update_schedule(employee_id: int, data: WeeklySchedule, employees=Depends(employee_repo),
                    logs=Depends(activity_repo), admin: dict = Depends(require_admin)):
    emp = uc.update_schedule(employees, employee_id, data)
    _log_emp(logs, admin, emp, "jornada_alterada", f"Ajustou a jornada semanal de {emp.name}")
    return emp


@router.post("/{employee_id}/photo", response_model=EmployeeRead)
async def upload_photo(employee_id: int, file: UploadFile = File(...), employees=Depends(employee_repo),
                       storage=Depends(attachment_storage), logs=Depends(activity_repo),
                       identity: dict = Depends(get_identity)):
    ensure_self_or_admin(identity, employee_id)
    content = await file.read()
    emp = uc.set_photo(employees, storage, employee_id, file.filename or "foto", content)
    _log_emp(logs, identity, emp, "foto_alterada", "Atualizou a foto de perfil")
    return emp


@router.delete("/{employee_id}/photo", response_model=EmployeeRead)
def delete_photo(employee_id: int, employees=Depends(employee_repo),
                 storage=Depends(attachment_storage), logs=Depends(activity_repo),
                 identity: dict = Depends(get_identity)):
    ensure_self_or_admin(identity, employee_id)
    emp = uc.remove_photo(employees, storage, employee_id)
    _log_emp(logs, identity, emp, "foto_removida", "Removeu a foto de perfil")
    return emp


@router.get("/photos/{filename}")
def download_photo(filename: str, storage=Depends(attachment_storage)):
    data, content_type = storage.read(filename)
    return Response(content=data, media_type=content_type,
                    headers={"Cache-Control": "public, max-age=86400"})



@router.delete("/{employee_id}", status_code=204)
def remove_employee(employee_id: int, employees=Depends(employee_repo), storage=Depends(attachment_storage),
                    logs=Depends(activity_repo), admin: dict = Depends(require_admin)):
    emp = employees.get(employee_id)
    name = emp.name if emp else f"#{employee_id}"
    uc.delete(employees, storage, employee_id)
    activity.log(logs, admin, action="colaborador_excluido", description=f"Excluiu o colaborador {name}",
                 entity_type="employee", entity_id=employee_id, employee_id=employee_id)
