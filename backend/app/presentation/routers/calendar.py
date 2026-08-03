"""Calendário editável — feriados/facultativos/eventos que afetam a referência."""
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlmodel import Session

from app.application import calendar as cal_uc
from app.infrastructure.database import get_session
from app.presentation.deps import require_admin

router = APIRouter(prefix="/calendar", tags=["calendar"])


class CalendarDayIn(BaseModel):
    date: str
    kind: str = "feriado"
    label: str
    deduct_minutes: int | None = None


class CalendarDayOut(BaseModel):
    id: int
    date: str
    kind: str
    label: str
    deduct_minutes: int | None

    model_config = {"from_attributes": True}


@router.get("", response_model=list[CalendarDayOut])
def list_days(session: Session = Depends(get_session)):
    return cal_uc.get_all(session)


@router.put("", response_model=CalendarDayOut, dependencies=[Depends(require_admin)])
def upsert_day(data: CalendarDayIn, session: Session = Depends(get_session)):
    return cal_uc.upsert(session, data.date, data.kind, data.label, data.deduct_minutes)


@router.delete("/{day_id}", status_code=204, dependencies=[Depends(require_admin)])
def delete_day(day_id: int, session: Session = Depends(get_session)):
    cal_uc.delete(session, day_id)


class LeaveIn(BaseModel):
    employee_id: int
    start_date: str
    end_date: str
    kind: str = "ferias"
    note: str | None = None


class LeaveOut(BaseModel):
    id: int
    employee_id: int
    start_date: str
    end_date: str
    kind: str
    note: str | None

    model_config = {"from_attributes": True}


class ShiftIn(BaseModel):
    employee_id: int
    dates: list[str]           # uma ou várias datas
    note: str | None = None


class ShiftOut(BaseModel):
    id: int
    employee_id: int
    date: str
    note: str | None

    model_config = {"from_attributes": True}


@router.get("/shifts", response_model=list[ShiftOut], dependencies=[Depends(require_admin)])
def list_shifts(session: Session = Depends(get_session)):
    """Escalas marcadas (dias em que o colaborador está escalado)."""
    return cal_uc.get_shifts(session)


@router.post("/shifts", dependencies=[Depends(require_admin)])
def add_shifts(data: ShiftIn, session: Session = Depends(get_session)):
    return {"added": cal_uc.add_shifts(session, data.employee_id, data.dates, data.note)}


@router.delete("/shifts/{shift_id}", status_code=204, dependencies=[Depends(require_admin)])
def delete_shift(shift_id: int, session: Session = Depends(get_session)):
    cal_uc.delete_shift(session, shift_id)


@router.get("/leaves", response_model=list[LeaveOut], dependencies=[Depends(require_admin)])
def list_leaves(session: Session = Depends(get_session)):
    """Férias/licenças programadas de todos os colaboradores."""
    return cal_uc.get_leaves(session)


@router.post("/leaves", response_model=LeaveOut, dependencies=[Depends(require_admin)])
def add_leave(data: LeaveIn, session: Session = Depends(get_session)):
    return cal_uc.add_leave(session, data.employee_id, data.start_date,
                            data.end_date, data.kind, data.note)


@router.delete("/leaves/{leave_id}", status_code=204, dependencies=[Depends(require_admin)])
def delete_leave(leave_id: int, session: Session = Depends(get_session)):
    cal_uc.delete_leave(session, leave_id)


@router.get("/suggestions", dependencies=[Depends(require_admin)])
def get_suggestions(year: int, session: Session = Depends(get_session)):
    return cal_uc.suggestions(session, year)


@router.post("/import", dependencies=[Depends(require_admin)])
def import_year(year: int, include_facultativos: bool = Query(False),
                session: Session = Depends(get_session)):
    return {"added": cal_uc.import_year(session, year, include_facultativos)}
