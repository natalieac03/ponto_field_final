from fastapi import APIRouter, Depends, Query
from sqlmodel import Session

from database import get_session
from schemas import CalendarDayCreate, CalendarDayRead, HolidaySuggestion
import services.calendar_service as svc

router = APIRouter(prefix="/calendar", tags=["calendar"])


@router.get("", response_model=list[CalendarDayRead])
def list_days(
    start: str | None = Query(None, description="YYYY-MM-DD"),
    end: str | None = Query(None, description="YYYY-MM-DD"),
    session: Session = Depends(get_session),
):
    if start and end:
        return svc.get_range(session, start, end)
    return svc.get_all(session)


@router.put("", response_model=CalendarDayRead)
def upsert_day(data: CalendarDayCreate, session: Session = Depends(get_session)):
    """Marca (ou atualiza) um dia especial."""
    return svc.upsert(session, data)


@router.delete("/{day_id}", status_code=204)
def delete_day(day_id: int, session: Session = Depends(get_session)):
    svc.delete(session, day_id)


@router.delete("/date/{date}", status_code=204)
def delete_day_by_date(date: str, session: Session = Depends(get_session)):
    svc.delete_by_date(session, date)


@router.get("/suggestions", response_model=list[HolidaySuggestion])
def get_suggestions(year: int, session: Session = Depends(get_session)):
    """Feriados oficiais do ano (nacionais + Goiás + Goiânia)."""
    return svc.suggestions(session, year)


@router.post("/import")
def import_year(
    year: int,
    include_facultativos: bool = Query(False),
    session: Session = Depends(get_session),
):
    kinds = ["feriado"] + (["facultativo"] if include_facultativos else [])
    added = svc.import_suggestions(session, year, kinds)
    return {"added": added}
