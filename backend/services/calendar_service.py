"""
calendar_service.py — Dias especiais (feriados, pontos facultativos e eventos
manuais como jogo do Brasil, dedetização etc).

Esses dias ABATEM da meta semanal:
  - deduct_minutes = None  → abate o dia inteiro (jornada esperada daquele dia)
  - deduct_minutes = N     → abate N minutos (dispensa parcial)

Feriado que cai em sábado/domingo não abate nada, porque nesses dias a meta
já é zero (sábado é escala).

As sugestões automáticas usam a biblioteca `holidays` (nacionais + Goiás) e
somam os feriados municipais de Goiânia.
"""
from fastapi import HTTPException
from sqlmodel import Session, select

from models import CalendarDay
from schemas import CalendarDayCreate, CalendarDayRead, HolidaySuggestion

# Feriados municipais de Goiânia (a lib não cobre município)
GOIANIA_MUNICIPAL = {
    (5, 24): "Nossa Senhora Auxiliadora (padroeira de Goiânia)",
    (10, 24): "Aniversário de Goiânia",
}

SUBDIV = "GO"


def get_all(session: Session) -> list[CalendarDayRead]:
    days = session.exec(select(CalendarDay).order_by(CalendarDay.date)).all()
    return [CalendarDayRead.model_validate(d) for d in days]


def get_range(session: Session, start: str, end: str) -> list[CalendarDayRead]:
    days = session.exec(
        select(CalendarDay)
        .where(CalendarDay.date >= start)
        .where(CalendarDay.date <= end)
        .order_by(CalendarDay.date)
    ).all()
    return [CalendarDayRead.model_validate(d) for d in days]


def deduction_map(session: Session, start: str, end: str) -> dict[str, CalendarDay]:
    """Mapa {data: CalendarDay} para o período — usado nos cálculos."""
    days = session.exec(
        select(CalendarDay)
        .where(CalendarDay.date >= start)
        .where(CalendarDay.date <= end)
    ).all()
    return {d.date: d for d in days}


def upsert(session: Session, data: CalendarDayCreate) -> CalendarDayRead:
    """Cria ou atualiza o dia (a data é única)."""
    existing = session.exec(
        select(CalendarDay).where(CalendarDay.date == data.date)
    ).first()
    if existing:
        existing.kind = data.kind
        existing.label = data.label
        existing.deduct_minutes = data.deduct_minutes
        day = existing
    else:
        day = CalendarDay(
            date=data.date, kind=data.kind,
            label=data.label, deduct_minutes=data.deduct_minutes,
        )
    session.add(day)
    session.commit()
    session.refresh(day)
    return CalendarDayRead.model_validate(day)


def delete(session: Session, day_id: int) -> None:
    day = session.get(CalendarDay, day_id)
    if not day:
        raise HTTPException(status_code=404, detail="Dia não encontrado.")
    session.delete(day)
    session.commit()


def delete_by_date(session: Session, date: str) -> None:
    day = session.exec(select(CalendarDay).where(CalendarDay.date == date)).first()
    if not day:
        raise HTTPException(status_code=404, detail="Dia não encontrado.")
    session.delete(day)
    session.commit()


def suggestions(session: Session, year: int) -> list[HolidaySuggestion]:
    """Feriados oficiais do ano (nacionais + GO + municipais de Goiânia)."""
    try:
        import holidays
    except ImportError:
        raise HTTPException(
            status_code=503,
            detail="Biblioteca de feriados indisponível no servidor.",
        )

    existing = {d.date for d in session.exec(select(CalendarDay)).all()}
    found: dict[str, tuple[str, str]] = {}   # data -> (label, kind)

    # Oficiais (nacionais + estaduais de GO)
    try:
        public = holidays.Brazil(subdiv=SUBDIV, years=year)
    except Exception:
        public = holidays.Brazil(years=year)
    for d, name in public.items():
        found[d.isoformat()] = (name, "feriado")

    # Facultativos (Carnaval, Corpus Christi, vésperas...)
    try:
        both = holidays.Brazil(subdiv=SUBDIV, years=year, categories=("public", "optional"))
        for d, name in both.items():
            iso = d.isoformat()
            if iso not in found:
                found[iso] = (name, "facultativo")
    except Exception:
        pass

    # Municipais de Goiânia
    for (m, dd), name in GOIANIA_MUNICIPAL.items():
        iso = f"{year:04d}-{m:02d}-{dd:02d}"
        found.setdefault(iso, (name, "feriado"))

    out = [
        HolidaySuggestion(date=iso, label=label, kind=kind, already_added=iso in existing)
        for iso, (label, kind) in found.items()
    ]
    out.sort(key=lambda s: s.date)
    return out


def import_suggestions(session: Session, year: int, kinds: list[str]) -> int:
    """Importa em lote os feriados sugeridos do ano. Não sobrescreve dias já
    marcados. Retorna quantos foram adicionados."""
    added = 0
    for s in suggestions(session, year):
        if s.already_added or s.kind not in kinds:
            continue
        session.add(CalendarDay(date=s.date, kind=s.kind, label=s.label, deduct_minutes=None))
        added += 1
    session.commit()
    return added
