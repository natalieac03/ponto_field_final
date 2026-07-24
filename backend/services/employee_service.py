from fastapi import HTTPException
from sqlmodel import Session, select

from models import Employee
from schemas import (
    EmployeeCreate, EmployeeRead, WeeklySchedule,
    EmployeePasswordSet, EmployeePasswordChange,
)
from services.auth_service import hash_password, verify_password

MAX_EMPLOYEES = 10

WEEKDAY_FIELDS = ("mon_minutes", "tue_minutes", "wed_minutes", "thu_minutes",
                  "fri_minutes", "sat_minutes", "sun_minutes")


def _to_read(emp: Employee) -> EmployeeRead:
    return EmployeeRead(
        id=emp.id,
        name=emp.name,
        has_password=emp.pin_hash is not None,
        mon_minutes=emp.mon_minutes,
        tue_minutes=emp.tue_minutes,
        wed_minutes=emp.wed_minutes,
        thu_minutes=emp.thu_minutes,
        fri_minutes=emp.fri_minutes,
        sat_minutes=emp.sat_minutes,
        sun_minutes=emp.sun_minutes,
    )


def get_all(session: Session) -> list[EmployeeRead]:
    emps = session.exec(select(Employee)).all()
    return [_to_read(e) for e in emps]


def get_by_id(session: Session, employee_id: int) -> Employee:
    emp = session.get(Employee, employee_id)
    if not emp:
        raise HTTPException(status_code=404, detail="Colaborador não encontrado.")
    return emp


def create(session: Session, data: EmployeeCreate) -> EmployeeRead:
    """Admin cria. PIN inicial é opcional — se não vier, colab define no 1º acesso."""
    existing = session.exec(select(Employee)).all()
    if len(existing) >= MAX_EMPLOYEES:
        raise HTTPException(status_code=400, detail="Limite de 10 colaboradores atingido.")
    name_lower = data.name.strip().lower()
    for emp in existing:
        if emp.name.lower() == name_lower:
            raise HTTPException(status_code=409, detail="Colaborador já cadastrado.")
    pin_hash = hash_password(data.pin) if data.pin else None
    employee = Employee(name=data.name.strip(), pin_hash=pin_hash)
    session.add(employee)
    session.commit()
    session.refresh(employee)
    return _to_read(employee)


def rename(session: Session, employee_id: int, new_name: str) -> EmployeeRead:
    emp = get_by_id(session, employee_id)
    # Verifica duplicata (exceto o próprio)
    existing = session.exec(select(Employee)).all()
    for e in existing:
        if e.id != employee_id and e.name.lower() == new_name.lower():
            raise HTTPException(status_code=409, detail="Já existe um colaborador com esse nome.")
    emp.name = new_name
    session.add(emp)
    session.commit()
    session.refresh(emp)
    return _to_read(emp)


def set_password_first_time(session: Session, employee_id: int, data: EmployeePasswordSet) -> EmployeeRead:
    emp = get_by_id(session, employee_id)
    if emp.pin_hash is not None:
        raise HTTPException(status_code=409, detail="Colaborador já possui senha. Use 'alterar senha'.")
    emp.pin_hash = hash_password(data.password)
    session.add(emp)
    session.commit()
    session.refresh(emp)
    return _to_read(emp)


def change_password(session: Session, employee_id: int, data: EmployeePasswordChange) -> EmployeeRead:
    emp = get_by_id(session, employee_id)
    if not emp.pin_hash:
        raise HTTPException(status_code=400, detail="Colaborador ainda não definiu uma senha.")
    if not verify_password(data.current_password, emp.pin_hash):
        raise HTTPException(status_code=401, detail="Senha atual incorreta.")
    emp.pin_hash = hash_password(data.new_password)
    session.add(emp)
    session.commit()
    session.refresh(emp)
    return _to_read(emp)


def update_schedule(session: Session, employee_id: int, data: WeeklySchedule) -> EmployeeRead:
    """Admin define jornada semanal personalizada. None = usa padrão global."""
    emp = get_by_id(session, employee_id)
    for field in WEEKDAY_FIELDS:
        setattr(emp, field, getattr(data, field))
    session.add(emp)
    session.commit()
    session.refresh(emp)
    return _to_read(emp)


def get_standard_minutes_for_date(emp: Employee, iso_date: str, default: int) -> int:
    """Dado um colaborador e uma data, devolve a jornada esperada do dia.
    Fallback para o padrão global se não tiver jornada personalizada."""
    from datetime import date as date_cls
    try:
        d = date_cls.fromisoformat(iso_date)
    except ValueError:
        return default
    # weekday(): 0=segunda ... 6=domingo
    fields = ["mon_minutes", "tue_minutes", "wed_minutes", "thu_minutes",
              "fri_minutes", "sat_minutes", "sun_minutes"]
    val = getattr(emp, fields[d.weekday()])
    return val if val is not None else default


def delete(session: Session, employee_id: int) -> None:
    emp = session.get(Employee, employee_id)
    if not emp:
        raise HTTPException(status_code=404, detail="Colaborador não encontrado.")
    from models import DailyRecord
    records = session.exec(select(DailyRecord).where(DailyRecord.employee_id == employee_id)).all()
    for r in records:
        session.delete(r)
    session.delete(emp)
    session.commit()
