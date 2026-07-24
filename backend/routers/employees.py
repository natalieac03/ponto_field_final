from fastapi import APIRouter, Depends
from sqlmodel import Session

from database import get_session
from schemas import (
    EmployeeCreate, EmployeeRead, EmployeeRename, WeeklySchedule,
    EmployeePasswordSet, EmployeePasswordChange,
)
import services.employee_service as svc

router = APIRouter(prefix="/employees", tags=["employees"])


@router.get("", response_model=list[EmployeeRead])
def list_employees(session: Session = Depends(get_session)):
    return svc.get_all(session)


@router.post("", response_model=EmployeeRead, status_code=201)
def add_employee(data: EmployeeCreate, session: Session = Depends(get_session)):
    return svc.create(session, data)


@router.patch("/{employee_id}/name", response_model=EmployeeRead)
def rename_employee(employee_id: int, data: EmployeeRename, session: Session = Depends(get_session)):
    """Admin renomeia um colaborador."""
    return svc.rename(session, employee_id, data.name)


@router.post("/{employee_id}/password", response_model=EmployeeRead)
def set_password_first_time(employee_id: int, data: EmployeePasswordSet, session: Session = Depends(get_session)):
    """1º acesso — define senha. 409 se já tiver senha."""
    return svc.set_password_first_time(session, employee_id, data)


@router.patch("/{employee_id}/password", response_model=EmployeeRead)
def change_password(employee_id: int, data: EmployeePasswordChange, session: Session = Depends(get_session)):
    """Colaborador altera senha autenticando com a atual."""
    return svc.change_password(session, employee_id, data)


@router.put("/{employee_id}/schedule", response_model=EmployeeRead)
def update_schedule(employee_id: int, data: WeeklySchedule, session: Session = Depends(get_session)):
    """Admin define jornada semanal personalizada (mon..sun)."""
    return svc.update_schedule(session, employee_id, data)


@router.delete("/{employee_id}", status_code=204)
def remove_employee(employee_id: int, session: Session = Depends(get_session)):
    svc.delete(session, employee_id)
