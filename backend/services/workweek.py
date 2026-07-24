"""
workweek.py — Regra de jornada SEMANAL de 44h (seg-sex).

PRINCÍPIOS:
  - Os dados gravados no banco NÃO são alterados. Toda a regra é aplicada
    apenas no CÁLCULO/EXIBIÇÃO dos relatórios. Vale retroativamente.
  - Semana útil: SEGUNDA A SEXTA. Padrão semanal 44h = 2640 min.
  - Sábado é escala: as horas trabalhadas no sábado CONTAM no total da
    semana, mas sábado/domingo não geram expectativa de jornada.
  - O saldo é fechado POR SEMANA: soma trabalhada (seg-dom) − 44h.
  - Jornada personalizada por dia (Configurações → Jornada semanal) tem
    prioridade sobre o padrão daquele dia; a expectativa semanal do
    colaborador passa a ser a soma dos 7 dias (personalizado ou padrão).

Config por env: WEEK_STD_MINUTES (padrão 2640).
"""
import os
from datetime import date as date_cls, timedelta

from models import Employee

WEEK_STD_MINUTES = int(os.getenv("WEEK_STD_MINUTES", "2640"))   # 44h
WORKDAYS = 5                                                    # seg-sex
DAILY_DEFAULT = WEEK_STD_MINUTES // WORKDAYS                    # 528 min = 8h48

_WD_FIELDS = ["mon_minutes", "tue_minutes", "wed_minutes", "thu_minutes",
              "fri_minutes", "sat_minutes", "sun_minutes"]


def daily_expected(emp: Employee | None, iso_date: str) -> int:
    """Expectativa do dia: personalizada se houver; senão 528 seg-sex, 0 sáb/dom."""
    try:
        d = date_cls.fromisoformat(iso_date)
    except ValueError:
        return DAILY_DEFAULT
    wd = d.weekday()  # 0=seg ... 6=dom
    if emp is not None:
        custom = getattr(emp, _WD_FIELDS[wd], None)
        if custom is not None:
            return custom
    return DAILY_DEFAULT if wd < WORKDAYS else 0


def weekly_expected(emp: Employee | None) -> int:
    """Meta bruta da semana (sem abatimentos): soma dos 7 dias."""
    total = 0
    for wd in range(7):
        custom = getattr(emp, _WD_FIELDS[wd], None) if emp is not None else None
        if custom is not None:
            total += custom
        else:
            total += DAILY_DEFAULT if wd < WORKDAYS else 0
    return total


def weekly_expected_with_deductions(emp, monday_iso: str, calendar_map: dict):
    """Meta da semana já descontando feriados/eventos.

    calendar_map: {data_iso: objeto com .label, .kind, .deduct_minutes}
      - deduct_minutes None → abate a jornada esperada do dia inteiro
      - deduct_minutes N    → abate N minutos (limitado à jornada do dia)

    Feriado em sábado/domingo não abate nada (meta do dia já é 0).
    Retorna (meta_liquida, total_abatido, [rotulos]).
    """
    monday = date_cls.fromisoformat(monday_iso)
    gross = 0
    deducted = 0
    labels: list[str] = []

    for i in range(7):
        d = monday + timedelta(days=i)
        iso = d.isoformat()
        day_exp = daily_expected(emp, iso)
        gross += day_exp
        special = calendar_map.get(iso)
        if special is None or day_exp == 0:
            continue
        cut = day_exp if special.deduct_minutes is None else min(special.deduct_minutes, day_exp)
        if cut <= 0:
            continue
        deducted += cut
        suffix = "" if special.deduct_minutes is None else f" (−{cut // 60}h{cut % 60:02d})"
        labels.append(f"{d.strftime('%d/%m')} {special.label}{suffix}")

    return max(gross - deducted, 0), deducted, labels


def week_start(iso_date: str) -> str:
    """Segunda-feira da semana da data (ISO)."""
    d = date_cls.fromisoformat(iso_date)
    return (d - timedelta(days=d.weekday())).isoformat()


def week_end(monday_iso: str) -> str:
    """Domingo da semana cuja segunda é monday_iso."""
    d = date_cls.fromisoformat(monday_iso)
    return (d + timedelta(days=6)).isoformat()
