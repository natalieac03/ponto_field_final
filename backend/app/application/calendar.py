"""Calendário editável (feriados, facultativos e eventos) — portado da versão
anterior e ligado ao motor: dia inteiro vira H3 (referência 0); dispensa
parcial abate N minutos da referência do dia.

Depois de qualquer mudança, `sync_engine` reinstala o calendário no domínio
(`accounting.set_calendar`) — é assim que os cálculos passam a enxergar o banco.
"""
from sqlmodel import Session, select

from app.application.errors import ConflictError, NotFoundError, ValidationError
from app.domain import accounting
from app.domain.models import CalendarDay, EmployeeLeave, EmployeeShift

# Municipais de Goiânia (a lib `holidays` não cobre município)
GOIANIA_MUNICIPAL = {
    (5, 24): "Nossa Senhora Auxiliadora (padroeira de Goiânia)",
    (10, 24): "Aniversário de Goiânia",
}
SUBDIV = "GO"

VALID_KINDS = {"feriado", "facultativo", "evento"}


def sync_engine(session: Session) -> None:
    """Lê calendar_days e instala no domínio (holidays + parciais + rótulos)."""
    days = session.exec(select(CalendarDay)).all()
    full = {d.date for d in days if d.deduct_minutes is None}
    partial = {d.date: d.deduct_minutes for d in days if d.deduct_minutes is not None}
    labels = {d.date: d.label for d in days}
    accounting.set_calendar(full, partial, labels)


def sync_leaves(session: Session) -> None:
    """Expande os períodos de férias em datas e instala no domínio."""
    from datetime import date as _d, timedelta
    out: dict[int, dict[str, str]] = {}
    for lv in session.exec(select(EmployeeLeave)).all():
        try:
            start = _d.fromisoformat(lv.start_date)
            end = _d.fromisoformat(lv.end_date)
        except ValueError:
            continue
        label = LEAVE_LABELS.get(lv.kind, "Ausência")
        bucket = out.setdefault(lv.employee_id, {})
        d = start
        while d <= end:
            bucket[d.isoformat()] = label
            d += timedelta(days=1)
    accounting.set_leaves(out)


LEAVE_LABELS = {"ferias": "Férias", "licenca": "Licença", "folga": "Folga programada"}
VALID_LEAVE_KINDS = set(LEAVE_LABELS)


def sync_shifts(session: Session) -> None:
    """Lê employee_shifts e instala no motor de cálculo."""
    out: dict[int, set[str]] = {}
    for sh in session.exec(select(EmployeeShift)).all():
        out.setdefault(sh.employee_id, set()).add(sh.date)
    accounting.set_shifts(out)


def get_shifts(session: Session) -> list[EmployeeShift]:
    return list(session.exec(select(EmployeeShift).order_by(EmployeeShift.date.desc())).all())


def add_shifts(session: Session, employee_id: int, dates: list[str],
               note: str | None = None) -> int:
    """Marca escala em uma ou várias datas. Ignora datas já marcadas."""
    from datetime import date as _d
    from app.domain.models import Employee
    if not session.get(Employee, employee_id):
        raise NotFoundError("Colaborador não encontrado.")
    existing = {sh.date for sh in session.exec(
        select(EmployeeShift).where(EmployeeShift.employee_id == employee_id)).all()}
    added = 0
    for raw in dates:
        try:
            iso = _d.fromisoformat(raw).isoformat()
        except ValueError:
            raise ValidationError(f"Data inválida: {raw}")
        if iso in existing:
            continue
        session.add(EmployeeShift(employee_id=employee_id, date=iso,
                                  note=(note or "").strip()[:120] or None))
        existing.add(iso)
        added += 1
    session.commit()
    sync_shifts(session)
    return added


def delete_shift(session: Session, shift_id: int) -> None:
    sh = session.get(EmployeeShift, shift_id)
    if not sh:
        raise NotFoundError("Escala não encontrada.")
    session.delete(sh)
    session.commit()
    sync_shifts(session)


def get_leaves(session: Session) -> list[EmployeeLeave]:
    return list(session.exec(
        select(EmployeeLeave).order_by(EmployeeLeave.start_date.desc())
    ).all())


def add_leave(session: Session, employee_id: int, start_date: str, end_date: str,
              kind: str = "ferias", note: str | None = None) -> EmployeeLeave:
    from datetime import date as _d
    from app.domain.models import Employee
    if kind not in VALID_LEAVE_KINDS:
        raise ValidationError("Tipo de ausência inválido.")
    if not session.get(Employee, employee_id):
        raise NotFoundError("Colaborador não encontrado.")
    try:
        start = _d.fromisoformat(start_date)
        end = _d.fromisoformat(end_date)
    except ValueError:
        raise ValidationError("Datas inválidas (use AAAA-MM-DD).")
    if end < start:
        raise ValidationError("A data final não pode ser antes da inicial.")
    if (end - start).days > 400:
        raise ValidationError("Período muito longo (máx. 400 dias).")

    # Impede sobreposição com outro período do mesmo colaborador
    for lv in session.exec(select(EmployeeLeave).where(EmployeeLeave.employee_id == employee_id)).all():
        if not (end.isoformat() < lv.start_date or start.isoformat() > lv.end_date):
            raise ConflictError(
                f"Já existe ausência de {lv.start_date} a {lv.end_date} para este colaborador.")

    leave = EmployeeLeave(employee_id=employee_id, start_date=start.isoformat(),
                          end_date=end.isoformat(), kind=kind,
                          note=(note or "").strip()[:120] or None)
    session.add(leave)
    session.commit()
    session.refresh(leave)
    sync_leaves(session)
    return leave


def delete_leave(session: Session, leave_id: int) -> None:
    lv = session.get(EmployeeLeave, leave_id)
    if not lv:
        raise NotFoundError("Período não encontrado.")
    session.delete(lv)
    session.commit()
    sync_leaves(session)


def get_all(session: Session) -> list[CalendarDay]:
    return list(session.exec(select(CalendarDay).order_by(CalendarDay.date)).all())


def upsert(session: Session, date: str, kind: str, label: str,
           deduct_minutes: int | None) -> CalendarDay:
    from datetime import date as _d
    try:
        _d.fromisoformat(date)
    except ValueError:
        raise ValidationError("Data inválida (use AAAA-MM-DD).")
    if kind not in VALID_KINDS:
        raise ValidationError("Tipo inválido.")
    label = (label or "").strip()[:80]
    if not label:
        raise ValidationError("Descrição não pode ser vazia.")
    if deduct_minutes is not None and not (0 < deduct_minutes <= 1440):
        raise ValidationError("Dispensa parcial deve ser entre 1 e 1440 minutos.")

    day = session.exec(select(CalendarDay).where(CalendarDay.date == date)).first()
    if day:
        day.kind, day.label, day.deduct_minutes = kind, label, deduct_minutes
    else:
        day = CalendarDay(date=date, kind=kind, label=label, deduct_minutes=deduct_minutes)
    session.add(day)
    session.commit()
    session.refresh(day)
    sync_engine(session)
    return day


def delete(session: Session, day_id: int) -> None:
    day = session.get(CalendarDay, day_id)
    if not day:
        raise NotFoundError("Dia não encontrado.")
    session.delete(day)
    session.commit()
    sync_engine(session)


def suggestions(session: Session, year: int) -> list[dict]:
    """Feriados oficiais do ano: nacionais + GO + municipais de Goiânia."""
    try:
        import holidays as _hl
    except ImportError:
        raise ValidationError("Biblioteca de feriados indisponível no servidor.")

    existing = {d.date for d in get_all(session)}
    found: dict[str, tuple[str, str]] = {}
    try:
        public = _hl.Brazil(subdiv=SUBDIV, years=year)
    except Exception:
        public = _hl.Brazil(years=year)
    for d, name in public.items():
        found[d.isoformat()] = (name, "feriado")
    try:
        both = _hl.Brazil(subdiv=SUBDIV, years=year, categories=("public", "optional"))
        for d, name in both.items():
            found.setdefault(d.isoformat(), (name, "facultativo"))
    except Exception:
        pass
    for (m, dd), name in GOIANIA_MUNICIPAL.items():
        found.setdefault(f"{year:04d}-{m:02d}-{dd:02d}", (name, "feriado"))

    return sorted(
        ({"date": iso, "label": lb, "kind": kd, "already_added": iso in existing}
         for iso, (lb, kd) in found.items()),
        key=lambda x: x["date"],
    )


def import_year(session: Session, year: int, include_facultativos: bool) -> int:
    kinds = {"feriado"} | ({"facultativo"} if include_facultativos else set())
    added = 0
    for sug in suggestions(session, year):
        if sug["already_added"] or sug["kind"] not in kinds:
            continue
        session.add(CalendarDay(date=sug["date"], kind=sug["kind"],
                                label=sug["label"], deduct_minutes=None))
        added += 1
    session.commit()
    sync_engine(session)
    return added
