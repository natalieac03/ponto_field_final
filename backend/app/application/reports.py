"""Casos de uso de relatórios. Cruzam repositórios com a agregação do domínio (banking)."""
import json
from datetime import date as date_cls

from app.application.dtos import (
    BankEntry, BankReport, MonthlyRecord, MonthlyReport, MonthlySummary, WeeklyBucket,
)
from app.application.employees import schedule_tuple
from app.application import cpf as cpf_utils
from app.domain import accounting
from app.application.ports import EmployeeRepository, RecordRepository, SettingsRepository
from app.domain import banking


def _attachments_list(rec) -> list[str]:
    if not rec.attachments:
        return []
    try:
        data = json.loads(rec.attachments)
        return data if isinstance(data, list) else []
    except json.JSONDecodeError:
        return []


def _make_summary(eid: int, name: str, recs: list, st: dict) -> MonthlySummary:
    pending = sum(1 for r in recs if r.status == "pendente")
    weeks = [WeeklyBucket(week=w["week"], label=w["label"], worked_minutes=w["worked"],
                          reference_minutes=w["reference"], balance=w["balance"])
             for w in st["weeks"]]
    return MonthlySummary(
        employee_id=eid, employee_name=name, days=st["days_worked"],
        days_h1=st["days_h1"], days_h2=st["days_h2"], days_h3=st["days_h3"],
        worked_minutes=st["worked"], reference_minutes=st["reference"], balance=st["balance"],
        normal_minutes=st.get("normal", 0), shortfall_minutes=st.get("shortfall", 0),
        extra50_minutes=st.get("extra50", 0), extra100_minutes=st["extra100"],
        night_bonus_minutes=st["night"], faltas=st["faltas"], atestados=st["atestados"],
        abonos=st["abonos"], viagens=st["viagens"], folgas=st["folgas"],
        over_limit_days=st["over_limit"], pending=pending, weeks=weeks,
        standard_minutes=st["reference"],
        positive_overtime=max(st["balance"], 0), negative_overtime=min(st["balance"], 0),
    )


def _to_monthly_record(rec, name: str, emp=None, h1: int = 480, h2: int = 240) -> MonthlyRecord:
    """Serializa o registro RECALCULANDO a jornada pela regra vigente.

    Os valores gravados no banco refletem a regra do momento da batida; aqui a
    exibição é sempre recalculada (escala da semana, feriados, férias), para que
    as linhas do detalhamento batam com os totais do resumo.
    """
    d = rec.model_dump()
    d["attachments"] = _attachments_list(rec)
    d["employee_name"] = name

    if emp is not None:
        res = accounting.compute_day(
            rec.date, rec.entry_time, rec.break_start, rec.break_end, rec.exit_time,
            abono=rec.abono_code, h1=h1, h2=h2, schedule=schedule_tuple(emp),
            on_leave=accounting.is_on_leave(emp.id, rec.date), employee_id=emp.id,
        )
        d["day_type"]           = res.day_type
        d["standard_minutes"]   = res.reference
        d["worked_minutes"]     = res.worked
        d["effective_minutes"]  = res.effective
        d["overtime_minutes"]   = res.balance
        d["normal_minutes"]     = res.normal
        d["shortfall_minutes"]  = res.shortfall
        d["extra50_minutes"]    = res.extra50
        d["extra100_minutes"]   = res.extra100
        d["night_minutes"]      = res.night
        d["night_bonus_minutes"] = res.night_bonus
        d["over_limit"]         = res.over_limit
    return MonthlyRecord(**d)


def _bank_entry(emp, recs: list, h1: int, h2: int, today: date_cls) -> BankEntry:
    """Banco de horas acumulado do 1º registro fechado até hoje ('até ontem' dentro de period_stats)."""
    recs = [r for r in recs if r.status != "reprovado"]
    pending = [r for r in recs if r.status == "pendente"]
    approved = [r for r in recs if r.status == "aprovado"]
    closed = [r for r in approved if banking.is_closed(r)]
    open_recs = [r for r in approved if not banking.is_closed(r)]

    if closed:
        first = min(date_cls.fromisoformat(r.date) for r in closed)
        st = banking.period_stats(recs, first, today, h1, h2, schedule=schedule_tuple(emp),
                                  leave_days=accounting.leave_days(emp.id),
                                  employee_id=emp.id)
        worked, reference, balance = st["worked"], st["reference"], st["balance"]
        normal, shortfall = st.get("normal", 0), st.get("shortfall", 0)
        ex50, ex100 = st.get("extra50", 0), st.get("extra100", 0)
    else:
        worked = reference = balance = 0
        normal = shortfall = ex50 = ex100 = 0

    return BankEntry(
        employee_id=emp.id, employee_name=emp.name, total_records=len(recs),
        open_records=len(open_recs), pending_records=len(pending),
        worked_minutes=worked, standard_minutes=reference,
        normal_minutes=normal, shortfall_minutes=shortfall,
        extra50_minutes=ex50, extra100_minutes=ex100,
        positive_overtime=max(balance, 0), negative_overtime=min(balance, 0), balance=balance,
    )


def build_bank(records: RecordRepository, employees: EmployeeRepository,
               settings: SettingsRepository) -> BankReport:
    h1, h2 = settings.journey_params()
    all_records = records.list_all()
    today = date_cls.today()

    entries: list[BankEntry] = []
    for emp in employees.list_all():
        recs = [r for r in all_records if r.employee_id == emp.id]
        entries.append(_bank_entry(emp, recs, h1, h2, today))

    return BankReport(
        employees=entries,
        total_balance=sum(e.balance for e in entries),
        employees_positive=sum(1 for e in entries if e.balance > 0),
        employees_negative=sum(1 for e in entries if e.balance < 0),
        total_records=len(all_records),
        open_records=sum(e.open_records for e in entries),
        pending_records=sum(e.pending_records for e in entries),
    )


def build_employee_bank(records: RecordRepository, employees: EmployeeRepository,
                        settings: SettingsRepository, employee_id: int) -> BankEntry:
    h1, h2 = settings.journey_params()
    emp = employees.get(employee_id) or type("E", (), {"id": employee_id, "name": "?"})()
    recs = records.list_by_employee(employee_id)
    return _bank_entry(emp, recs, h1, h2, date_cls.today())


def filter_monthly(rep: MonthlyReport, employee_id: int | None = None,
                   start: str | None = None, end: str | None = None) -> MonthlyReport:
    """Recorta o relatório mensal por colaborador e/ou intervalo de datas,
    recalculando os totais — usado nas exportações filtradas."""
    if employee_id is None and not start and not end:
        return rep

    recs = [r for r in rep.records
            if (employee_id is None or r.employee_id == employee_id)
            and (not start or r.date >= start)
            and (not end or r.date <= end)]
    sums = [s for s in rep.summary if employee_id is None or s.employee_id == employee_id]

    data = rep.model_dump()
    data["records"] = [r.model_dump() for r in recs]
    data["summary"] = [s.model_dump() for s in sums]
    data["total_worked"]      = sum(s.worked_minutes for s in sums)
    data["total_reference"]   = sum(s.reference_minutes for s in sums)
    data["total_overtime"]    = sum(s.balance for s in sums)
    data["positive_overtime"] = sum(s.balance for s in sums if s.balance > 0)
    data["negative_overtime"] = sum(s.balance for s in sums if s.balance < 0)
    data["total_normal"]      = sum(s.normal_minutes for s in sums)
    data["total_shortfall"]   = sum(s.shortfall_minutes for s in sums)
    data["total_extra50"]     = sum(s.extra50_minutes for s in sums)
    data["total_extra100"]    = sum(s.extra100_minutes for s in sums)
    data["total_night_bonus"] = sum(s.night_bonus_minutes for s in sums)
    data["pending_records"]   = sum(1 for r in recs if r.status == "pendente")
    return MonthlyReport(**data)


def build_vacation_report(session, records: RecordRepository, employees: EmployeeRepository,
                          settings: SettingsRepository, start: str, end: str,
                          lookback_days: int = 90) -> dict:
    """Colaboradores com férias/licença iniciando no período + o espelho dos
    últimos `lookback_days` de cada um (para conferência antes do afastamento)."""
    from datetime import date as _d, timedelta
    from sqlmodel import select
    from app.domain.models import EmployeeLeave

    h1, h2 = settings.journey_params()
    emp_by_id = {e.id: e for e in employees.list_all()}
    today = _d.today()

    leaves = [lv for lv in session.exec(select(EmployeeLeave)).all()
              if start <= lv.start_date <= end]
    leaves.sort(key=lambda lv: (lv.start_date, emp_by_id.get(lv.employee_id).name
                                if lv.employee_id in emp_by_id else ""))

    items = []
    for lv in leaves:
        emp = emp_by_id.get(lv.employee_id)
        if not emp:
            continue
        ini = _d.fromisoformat(lv.start_date)
        fim = _d.fromisoformat(lv.end_date)
        win_end = min(ini - timedelta(days=1), today)
        win_start = win_end - timedelta(days=lookback_days - 1)

        recs = [r for r in records.list_by_employee(emp.id) if r.status != "reprovado"]
        st = banking.period_stats(recs, win_start, win_end, h1, h2,
                                  schedule=schedule_tuple(emp),
                                  leave_days=accounting.leave_days(emp.id),
                                  employee_id=emp.id)
        detail = sorted(
            [r for r in recs if win_start.isoformat() <= r.date <= win_end.isoformat()],
            key=lambda r: r.date,
        )
        items.append({
            "employee_id": emp.id,
            "employee_name": emp.name,
            "cpf_masked": cpf_utils.mask(emp.cpf),
            "role": emp.role,
            "leave_kind": lv.kind,
            "leave_start": lv.start_date,
            "leave_end": lv.end_date,
            "leave_days": (fim - ini).days + 1,
            "leave_note": lv.note,
            "window_start": win_start.isoformat(),
            "window_end": win_end.isoformat(),
            "worked_minutes": st["worked"],
            "reference_minutes": st["reference"],
            "balance": st["balance"],
            "normal_minutes": st.get("normal", 0),
            "shortfall_minutes": st.get("shortfall", 0),
            "extra50_minutes": st.get("extra50", 0),
            "extra100_minutes": st.get("extra100", 0),
            "days_worked": st["days_worked"],
            "records": [
                {"date": r.date, "entry_time": r.entry_time, "break_start": r.break_start,
                 "break_end": r.break_end, "exit_time": r.exit_time,
                 "worked_minutes": r.worked_minutes, "standard_minutes": r.standard_minutes,
                 "overtime_minutes": r.overtime_minutes, "abono_code": r.abono_code,
                 "day_type": r.day_type, "status": r.status}
                for r in detail
            ],
        })

    return {"start": start, "end": end, "lookback_days": lookback_days, "items": items}


def build_monthly(records: RecordRepository, employees: EmployeeRepository,
                  settings: SettingsRepository, year: int, month: int) -> MonthlyReport:
    h1, h2 = settings.journey_params()
    prefix = f"{year:04d}-{month:02d}"
    emp_by_id = {e.id: e for e in employees.list_all()}
    start, end = banking.month_range(year, month)
    all_recs = records.list_by_month(prefix)

    def name_of(eid: int) -> str:
        return emp_by_id[eid].name if eid in emp_by_id else "?"

    records_out = [_to_monthly_record(r, name_of(r.employee_id),
                                      emp_by_id.get(r.employee_id), h1, h2) for r in all_recs]

    by_emp: dict[int, list] = {}
    for r in all_recs:
        by_emp.setdefault(r.employee_id, []).append(r)

    summaries = [
        _make_summary(eid, name_of(eid), recs,
                      banking.period_stats(recs, start, end, h1, h2,
                                           schedule=schedule_tuple(emp_by_id.get(eid)),
                                           leave_days=accounting.leave_days(eid),
                                           employee_id=eid))
        for eid, recs in by_emp.items()
    ]
    summaries.sort(key=lambda s: s.employee_name.lower())
    return _assemble_monthly(year, month, records_out, summaries)


def build_employee_month(records: RecordRepository, employees: EmployeeRepository,
                         settings: SettingsRepository, employee_id: int,
                         year: int, month: int) -> MonthlyReport:
    h1, h2 = settings.journey_params()
    prefix = f"{year:04d}-{month:02d}"
    emp = employees.get(employee_id)
    name = emp.name if emp else "?"
    start, end = banking.month_range(year, month)

    recs = [r for r in records.list_by_month(prefix) if r.employee_id == employee_id]
    records_out = [_to_monthly_record(r, name, emp, h1, h2) for r in recs]
    summary = _make_summary(employee_id, name, recs,
                            banking.period_stats(recs, start, end, h1, h2, schedule=schedule_tuple(emp),
                                                 leave_days=accounting.leave_days(emp.id),
                                                 employee_id=emp.id))
    return _assemble_monthly(year, month, records_out, [summary])


def _assemble_monthly(year: int, month: int, records_out: list[MonthlyRecord],
                      summaries: list[MonthlySummary]) -> MonthlyReport:
    return MonthlyReport(
        year=year, month=month, records=records_out, summary=summaries,
        total_worked=sum(s.worked_minutes for s in summaries),
        total_reference=sum(s.reference_minutes for s in summaries),
        total_overtime=sum(s.balance for s in summaries),
        positive_overtime=sum(s.positive_overtime for s in summaries),
        negative_overtime=sum(s.negative_overtime for s in summaries),
        total_normal=sum(s.normal_minutes for s in summaries),
        total_shortfall=sum(s.shortfall_minutes for s in summaries),
        total_extra50=sum(s.extra50_minutes for s in summaries),
        total_extra100=sum(s.extra100_minutes for s in summaries),
        total_night_bonus=sum(s.night_bonus_minutes for s in summaries),
        pending_records=sum(s.pending for s in summaries),
    )
