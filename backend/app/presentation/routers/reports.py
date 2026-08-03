from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response

from app.application import reports as uc
from app.application.dtos import BankEntry, BankReport, MonthlyReport
from app.application.identity import ensure_self_or_admin
from app.infrastructure import export_xlsx as exporter
from app.infrastructure.database import get_session
from sqlmodel import Session
from app.presentation.deps import (
    employee_repo, get_identity, record_repo, require_admin, settings_repo,
)

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/bank", response_model=BankReport)
def bank_report(records=Depends(record_repo), employees=Depends(employee_repo),
                settings=Depends(settings_repo), _admin: dict = Depends(require_admin)):
    return uc.build_bank(records, employees, settings)


@router.get("/employee/{employee_id}/monthly", response_model=MonthlyReport)
def employee_monthly(
    employee_id: int,
    year: int = Query(..., ge=2000, le=2100),
    month: int = Query(..., ge=1, le=12),
    records=Depends(record_repo), employees=Depends(employee_repo),
    settings=Depends(settings_repo), identity: dict = Depends(get_identity),
):
    """Espelho mensal do próprio colaborador (ou admin)."""
    ensure_self_or_admin(identity, employee_id)
    return uc.build_employee_month(records, employees, settings, employee_id, year, month)


@router.get("/employee/{employee_id}/bank", response_model=BankEntry)
def employee_bank(
    employee_id: int,
    records=Depends(record_repo), employees=Depends(employee_repo),
    settings=Depends(settings_repo), identity: dict = Depends(get_identity),
):
    """Banco de horas acumulado do próprio colaborador (ou admin)."""
    ensure_self_or_admin(identity, employee_id)
    return uc.build_employee_bank(records, employees, settings, employee_id)


@router.get("/monthly", response_model=MonthlyReport)
def monthly_report(year: int = Query(..., ge=2000, le=2100), month: int = Query(..., ge=1, le=12),
                   records=Depends(record_repo), employees=Depends(employee_repo),
                   settings=Depends(settings_repo), _admin: dict = Depends(require_admin)):
    return uc.build_monthly(records, employees, settings, year, month)


@router.get("/monthly.xlsx")
def monthly_xlsx(year: int = Query(..., ge=2000, le=2100), month: int = Query(..., ge=1, le=12),
                 employee_id: int | None = Query(None), start: str | None = Query(None),
                 end: str | None = Query(None),
                 records=Depends(record_repo), employees=Depends(employee_repo),
                 settings=Depends(settings_repo), _admin: dict = Depends(require_admin)):
    rep = uc.build_monthly(records, employees, settings, year, month)
    rep = uc.filter_monthly(rep, employee_id, start, end)
    h1, h2 = settings.journey_params()
    from app.application.employees import schedule_tuple
    scheds = {e.id: schedule_tuple(e) for e in employees.list_all()}
    content = exporter.build_monthly_xlsx(rep, h1=h1, h2=h2, schedules=scheds,
                                          start=start, end=end)
    who = f"_col{employee_id}" if employee_id else ""
    fname = f"pontofield_{year}{month:02d}{who}.xlsx"
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
    )


@router.get("/vacation")
def vacation_report(start: str = Query(..., description="AAAA-MM-DD"),
                    end: str = Query(..., description="AAAA-MM-DD"),
                    lookback_days: int = Query(90, ge=1, le=365),
                    session: Session = Depends(get_session),
                    records=Depends(record_repo), employees=Depends(employee_repo),
                    settings=Depends(settings_repo), _admin: dict = Depends(require_admin)):
    """Quem entra de férias/licença no período + espelho dos últimos N dias."""
    return uc.build_vacation_report(session, records, employees, settings, start, end, lookback_days)


@router.get("/vacation.csv")
def vacation_csv(start: str = Query(...), end: str = Query(...),
                 lookback_days: int = Query(90, ge=1, le=365),
                 session: Session = Depends(get_session),
                 records=Depends(record_repo), employees=Depends(employee_repo),
                 settings=Depends(settings_repo), _admin: dict = Depends(require_admin)):
    import csv, io
    rep = uc.build_vacation_report(session, records, employees, settings, start, end, lookback_days)

    def hm(m: int | None) -> str:
        if m is None:
            return ""
        sign = "-" if m < 0 else ""
        m = abs(m)
        return f"{sign}{m // 60}h{m % 60:02d}"

    buf = io.StringIO()
    w = csv.writer(buf, delimiter=";")
    w.writerow(["RELATORIO DE FERIAS / AFASTAMENTOS"])
    w.writerow([f"Periodo de inicio: {rep['start']} a {rep['end']}",
                f"Espelho dos ultimos {rep['lookback_days']} dias"])
    w.writerow([])
    for it in rep["items"]:
        w.writerow(["Colaborador", it["employee_name"], "CPF", it["cpf_masked"] or "",
                    "Cargo", it["role"] or ""])
        w.writerow(["Afastamento", f"{it['leave_kind']}", "De", it["leave_start"],
                    "Ate", it["leave_end"], "Dias", it["leave_days"]])
        w.writerow(["Espelho", f"{it['window_start']} a {it['window_end']}",
                    "Dias trabalhados", it["days_worked"]])
        w.writerow(["Trabalhado", hm(it["worked_minutes"]), "Referencia", hm(it["reference_minutes"]),
                    "Saldo", hm(it["balance"])])
        w.writerow(["H. normais", hm(it["normal_minutes"]), "Extra 50%", hm(it["extra50_minutes"]),
                    "Extra 100%", hm(it["extra100_minutes"]), "Atraso/Falta", hm(it["shortfall_minutes"])])
        w.writerow([])
        w.writerow(["Data", "Entrada", "Inicio Int.", "Fim Int.", "Saida",
                    "Trabalhado", "Referencia", "Saldo", "Tipo", "Abono", "Status"])
        for r in it["records"]:
            w.writerow([r["date"], r["entry_time"] or "", r["break_start"] or "",
                        r["break_end"] or "", r["exit_time"] or "",
                        hm(r["worked_minutes"]), hm(r["standard_minutes"]),
                        hm(r["overtime_minutes"]), r["day_type"] or "",
                        r["abono_code"] or "", r["status"]])
        w.writerow([])
        w.writerow([])

    content = ("\ufeff" + buf.getvalue()).encode("utf-8")
    fname = f"ferias_{rep['start']}_a_{rep['end']}.csv"
    return Response(content=content, media_type="text/csv; charset=utf-8",
                    headers={"Content-Disposition": f'attachment; filename="{fname}"'})


@router.get("/monthly.csv")
def monthly_csv(year: int = Query(..., ge=2000, le=2100), month: int = Query(..., ge=1, le=12),
                employee_id: int | None = Query(None), start: str | None = Query(None),
                end: str | None = Query(None),
                records=Depends(record_repo), employees=Depends(employee_repo),
                settings=Depends(settings_repo), _admin: dict = Depends(require_admin)):
    rep = uc.build_monthly(records, employees, settings, year, month)
    rep = uc.filter_monthly(rep, employee_id, start, end)
    h1, h2 = settings.journey_params()
    from app.application.employees import schedule_tuple
    scheds = {e.id: schedule_tuple(e) for e in employees.list_all()}
    content = ("﻿" + exporter.build_monthly_csv(rep, h1=h1, h2=h2, schedules=scheds,
                                                    start=start, end=end)).encode("utf-8")
    who = f"_col{employee_id}" if employee_id else ""
    fname = f"pontofield_{year}{month:02d}{who}.csv"
    return Response(
        content=content,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
    )
