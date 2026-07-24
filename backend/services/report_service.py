"""
Relatórios com fechamento SEMANAL (44h seg-sex; sábado = escala, conta como
trabalhado). Saldos calculados na hora — banco intocado, vale retroativo.

Para semanas que cruzam a virada do mês, o relatório mensal busca também os
dias adjacentes (fora do mês) para fechar a semana corretamente.
"""
import json
from datetime import date as date_cls, timedelta

from sqlmodel import Session, select
from models import DailyRecord, Employee
from schemas import (
    BankEntry, BankReport, MonthlyRecord, MonthlySummary, MonthlyReport, WeeklyEntry,
)
from services.workweek import (
    daily_expected, weekly_expected_with_deductions, week_start, week_end,
)
import services.calendar_service as calendar_service


def _attachments_list(record: DailyRecord) -> list[str]:
    if not record.attachments:
        return []
    try:
        data = json.loads(record.attachments)
        return data if isinstance(data, list) else []
    except json.JSONDecodeError:
        return []


def _weekly_close(records: list[DailyRecord], employees: dict[int, Employee],
                  calendar_map: dict) -> list[WeeklyEntry]:
    """Agrupa registros FECHADOS por (colaborador, semana) e fecha o saldo semanal,
    descontando feriados/eventos marcados no calendário."""
    buckets: dict[tuple[int, str], dict] = {}
    for r in records:
        if r.exit_time is None:
            continue
        ws = week_start(r.date)
        key = (r.employee_id, ws)
        if key not in buckets:
            emp = employees.get(r.employee_id)
            expected, deducted, labels = weekly_expected_with_deductions(emp, ws, calendar_map)
            buckets[key] = {
                "employee_id": r.employee_id,
                "employee_name": emp.name if emp else "?",
                "week_start": ws,
                "week_end": week_end(ws),
                "days": 0,
                "worked_minutes": 0,
                "expected_minutes": expected,
                "deducted_minutes": deducted,
                "deduction_labels": labels,
            }
        b = buckets[key]
        b["days"] += 1
        b["worked_minutes"] += r.worked_minutes or 0

    entries = [
        WeeklyEntry(**b, balance=b["worked_minutes"] - b["expected_minutes"])
        for b in buckets.values()
    ]
    entries.sort(key=lambda e: (e.week_start, e.employee_name))
    return entries


def get_bank(session: Session) -> BankReport:
    employees_list = list(session.exec(select(Employee)).all())
    employees = {e.id: e for e in employees_list}
    all_records = list(session.exec(select(DailyRecord)).all())
    calendar_map = calendar_service.deduction_map(session, '0000-01-01', '9999-12-31')

    weeks = _weekly_close(all_records, employees, calendar_map)

    entries: list[BankEntry] = []
    for emp in employees_list:
        recs = [r for r in all_records if r.employee_id == emp.id]
        closed = [r for r in recs if r.exit_time is not None]
        emp_weeks = [w for w in weeks if w.employee_id == emp.id]

        worked = sum(w.worked_minutes for w in emp_weeks)
        expected = sum(w.expected_minutes for w in emp_weeks)
        pos = sum(w.balance for w in emp_weeks if w.balance > 0)
        neg = sum(w.balance for w in emp_weeks if w.balance < 0)

        entries.append(BankEntry(
            employee_id=emp.id,
            employee_name=emp.name,
            total_records=len(recs),
            open_records=len(recs) - len(closed),
            worked_minutes=worked,
            standard_minutes=expected,
            positive_overtime=pos,
            negative_overtime=neg,
            balance=worked - expected,
        ))

    return BankReport(
        employees=entries,
        total_balance=sum(e.balance for e in entries),
        employees_positive=sum(1 for e in entries if e.balance > 0),
        employees_negative=sum(1 for e in entries if e.balance < 0),
        total_records=len(all_records),
        open_records=sum(e.open_records for e in entries),
    )


def get_monthly(session: Session, year: int, month: int) -> MonthlyReport:
    prefix = f"{year:04d}-{month:02d}"
    employees = {e.id: e for e in session.exec(select(Employee)).all()}

    # Faixa estendida: pega dias adjacentes p/ fechar semanas que cruzam o mês
    first = date_cls(year, month, 1)
    last = (date_cls(year + 1, 1, 1) if month == 12 else date_cls(year, month + 1, 1)) - timedelta(days=1)
    range_start = (first - timedelta(days=first.weekday())).isoformat()      # segunda da 1ª semana
    range_end = (last + timedelta(days=6 - last.weekday())).isoformat()      # domingo da última

    extended = list(
        session.exec(
            select(DailyRecord)
            .where(DailyRecord.date >= range_start)
            .where(DailyRecord.date <= range_end)
            .order_by(DailyRecord.date)
        ).all()
    )

    in_month = [r for r in extended if r.date.startswith(prefix)]

    # Detalhamento: só dias do mês; sem saldo diário (fechamento é semanal)
    records_out = []
    for r in in_month:
        emp = employees.get(r.employee_id)
        d = r.model_dump()
        d["standard_minutes"] = daily_expected(emp, r.date)   # informativo
        d["overtime_minutes"] = None                           # saldo é POR SEMANA
        d["attachments"] = _attachments_list(r)
        d["employee_name"] = emp.name if emp else "?"
        records_out.append(MonthlyRecord(**d))

    # Fechamento semanal (com dias adjacentes p/ semanas de virada)
    calendar_map = calendar_service.deduction_map(session, range_start, range_end)
    weeks = _weekly_close(extended, employees, calendar_map)

    # Resumo por colaborador = soma das semanas
    summary_map: dict[int, dict] = {}
    for w in weeks:
        if w.employee_id not in summary_map:
            summary_map[w.employee_id] = {
                "employee_id": w.employee_id,
                "employee_name": w.employee_name,
                "days": 0, "worked_minutes": 0, "standard_minutes": 0,
                "positive_overtime": 0, "negative_overtime": 0,
            }
        s = summary_map[w.employee_id]
        s["days"] += w.days
        s["worked_minutes"] += w.worked_minutes
        s["standard_minutes"] += w.expected_minutes
        if w.balance > 0: s["positive_overtime"] += w.balance
        elif w.balance < 0: s["negative_overtime"] += w.balance

    summaries = [
        MonthlySummary(**s, balance=s["worked_minutes"] - s["standard_minutes"])
        for s in summary_map.values()
    ]

    total_worked = sum(w.worked_minutes for w in weeks)
    total_expected = sum(w.expected_minutes for w in weeks)

    return MonthlyReport(
        year=year, month=month,
        records=records_out,
        weeks=weeks,
        summary=summaries,
        total_worked=total_worked,
        total_overtime=total_worked - total_expected,
        positive_overtime=sum(w.balance for w in weeks if w.balance > 0),
        negative_overtime=sum(w.balance for w in weeks if w.balance < 0),
    )
