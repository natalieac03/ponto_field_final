"""Agregação do banco de horas por CALENDÁRIO do período. Domínio puro.

Ponto-chave: a referência é enumerada pelo calendário (dia útil/sábado esperado),
não só pelos dias com registro. Sábado não trabalhado vira débito de −4h — é isso
que faz o saldo bater com a planilha. Recebe objetos "record-like" (qualquer coisa
com os atributos abaixo); não conhece SQLModel nem pydantic.
"""
from __future__ import annotations

from datetime import date as date_cls, timedelta
from typing import Iterable, Protocol

from app.domain import accounting


class RecordLike(Protocol):
    date: str
    status: str
    abono_code: str | None
    day_type: str | None
    entry_time: str | None
    break_start: str | None
    break_end: str | None
    exit_time: str | None
    overtime_minutes: int | None
    effective_minutes: int | None
    normal_minutes: int | None
    shortfall_minutes: int | None
    extra50_minutes: int | None
    extra100_minutes: int | None
    night_bonus_minutes: int | None
    over_limit: bool


def is_closed(r: RecordLike) -> bool:
    """Fechado = já entrou na conta (tem saldo calculado)."""
    return r.overtime_minutes is not None


def iter_days(start: date_cls, end: date_cls):
    d = start
    while d <= end:
        yield d
        d += timedelta(days=1)


def week_label(d: date_cls) -> tuple[int, str]:
    week = d.isocalendar().week
    monday = date_cls.fromordinal(d.toordinal() - d.weekday())
    sunday = monday + timedelta(days=6)
    return week, f"{monday.day:02d}/{monday.month:02d}–{sunday.day:02d}/{sunday.month:02d}"


def month_range(year: int, month: int, today: date_cls | None = None) -> tuple[date_cls, date_cls]:
    """[1º dia, último dia] do mês, sem passar de hoje (mês em andamento)."""
    today = today or date_cls.today()
    start = date_cls(year, month, 1)
    nxt = date_cls(year + (month == 12), (month % 12) + 1, 1)
    last = nxt - timedelta(days=1)
    return start, min(last, today)


def period_stats(recs: Iterable[RecordLike], start: date_cls, end: date_cls,
                 h1: int, h2: int, today: date_cls | None = None,
                 schedule: tuple | None = None,
                 leave_days: dict[str, str] | None = None,
                 employee_id: int | None = None) -> dict:
    """Enumera o calendário [start, end] e cruza com os registros do colaborador.

    O dia de HOJE, se ainda não tiver registro fechado, é ignorado (não debita um
    dia em curso). Dias passados sem registro continuam gerando débito.

    `schedule` (7-tupla seg..dom, min por dia | None) é a jornada personalizada do
    colaborador: substitui a referência de H1/H2 dia a dia.
    """
    today_iso = (today or date_cls.today()).isoformat()
    approved = {r.date: r for r in recs if r.status == "aprovado" and is_closed(r)}

    st = {
        "worked": 0, "reference": 0, "balance": 0,
        "days_h1": 0, "days_h2": 0, "days_h3": 0, "days_worked": 0,
        "normal": 0, "shortfall": 0, "extra50": 0, "extra100": 0,
        "night": 0, "over_limit": 0,
        "faltas": 0, "atestados": 0, "abonos": 0, "viagens": 0, "folgas": 0,
        "ferias": 0,
    }
    leaves = leave_days or {}
    week_map: dict[int, dict] = {}

    for d in iter_days(start, end):
        iso = d.isoformat()
        rec = approved.get(iso)
        if iso == today_iso and rec is None:
            continue  # dia corrente ainda não fechado — não debita
        dtype = accounting.day_type(iso)
        abono = rec.abono_code if rec else None
        override = accounting.weekday_reference_override(schedule, iso)
        on_leave = iso in leaves
        reference = accounting.employee_reference(employee_id, iso, abono, h1, h2,
                                                  override, on_leave=on_leave)
        if reference > 0:
            reference = max(reference - accounting.partial_deduction(iso), 0)
        if on_leave and dtype != "H3":
            st["ferias"] += 1
        effective = (rec.effective_minutes or 0) if rec else 0

        st["reference"] += reference
        st["worked"] += effective
        st["balance"] += effective - reference
        if rec is None:
            # dia útil sem registro = falta cheia
            st["shortfall"] += reference
        st["days_h1"] += 1 if dtype == "H1" else 0
        st["days_h2"] += 1 if dtype == "H2" else 0
        st["days_h3"] += 1 if dtype == "H3" else 0

        if rec:
            st["days_worked"] += 1
            # Recalcula pela regra VIGENTE (escala/feriado/férias podem ter
            # mudado desde que o registro foi gravado) — mesma função usada
            # nas linhas do detalhamento, para os dois nunca divergirem.
            res = accounting.compute_day(
                iso, rec.entry_time, rec.break_start, rec.break_end, rec.exit_time,
                abono=abono, h1=h1, h2=h2, schedule=schedule,
                on_leave=on_leave, employee_id=employee_id,
            )
            st["normal"] += res.normal
            st["shortfall"] += res.shortfall
            st["extra50"] += res.extra50
            st["extra100"] += res.extra100
            st["night"] += res.night_bonus
            st["over_limit"] += 1 if res.over_limit else 0
            st["faltas"] += 1 if rec.abono_code == "FA" else 0
            st["atestados"] += 1 if rec.abono_code == "AT" else 0
            st["abonos"] += 1 if rec.abono_code == "AB" else 0
            st["viagens"] += 1 if rec.abono_code == "VG" else 0
            st["folgas"] += 1 if rec.abono_code == "FE" else 0

        wk, label = week_label(d)
        b = week_map.setdefault(wk, {"week": wk, "label": label, "worked": 0, "reference": 0})
        b["worked"] += effective
        b["reference"] += reference

    st["weeks"] = [
        {**b, "balance": b["worked"] - b["reference"]}
        for b in sorted(week_map.values(), key=lambda x: x["week"])
    ]
    return st
