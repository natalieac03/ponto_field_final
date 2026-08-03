"""Motor de cálculo do banco de horas — modelo Folha de Ponto FieldTech v2.

Lógica pura (sem I/O) p/ ser testável. Regras em [[folha-ponto-spec]]:
- Tipo de dia: H1 (útil, 8h) | H2 (sábado, 4h) | H3 (domingo/feriado, 0h) = 44h/semana.
- Banco de horas = Σ(efetivo − referência) acumulado.
- Abonos AB/AT/VG contam como trabalhado; FA gera débito; FE zera a referência.
- Extra 50% (H1/H2 acima da jornada), Extra 100% (H3), adicional noturno 22h–05h (+20%).
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date as date_cls

from app.domain.constants import (
    ABONO_AS_WORKED, ABONO_FOLGA, DAILY_ALERT_MINUTES, H1_MINUTES, H2_MINUTES,
    HOLIDAYS_2026, NIGHT_END_MIN, NIGHT_PCT, NIGHT_START_MIN,
)
from app.domain.time_utils import calc_break_minutes, calc_worked_minutes, time_to_minutes


# ── Calendário dinâmico (alimentado pelo banco via infra; fallback = constante) ──
_CAL_HOLIDAYS: set[str] | None = None      # dias inteiros (feriado/facultativo/evento)
_CAL_PARTIAL: dict[str, int] = {}          # data → minutos abatidos (dispensa parcial)
_CAL_LABELS: dict[str, str] = {}           # data → rótulo (p/ relatórios)


# Ausências programadas por colaborador: {employee_id: {data_iso: rótulo}}
_LEAVES: dict[int, dict[str, str]] = {}


def set_leaves(leaves: dict[int, dict[str, str]]) -> None:
    """Instalado no startup e a cada mudança de férias/licença."""
    global _LEAVES
    _LEAVES = {int(k): dict(v) for k, v in leaves.items()}


def leave_days(employee_id: int | None) -> dict[str, str]:
    """{data: rótulo} das ausências do colaborador."""
    if employee_id is None:
        return {}
    return _LEAVES.get(int(employee_id), {})


def is_on_leave(employee_id: int | None, iso_date: str) -> bool:
    return iso_date in leave_days(employee_id)


# Escalas marcadas na agenda: {employee_id: {datas ISO}}
_SHIFTS: dict[int, set[str]] = {}


def set_shifts(shifts: dict[int, set[str]]) -> None:
    """Instalado no startup e a cada mudança da agenda de escalas."""
    global _SHIFTS
    _SHIFTS = {int(k): set(v) for k, v in shifts.items()}


def shift_days(employee_id: int | None) -> set[str]:
    if employee_id is None:
        return set()
    return _SHIFTS.get(int(employee_id), set())


def has_shift(employee_id: int | None, iso_date: str) -> bool:
    """Este colaborador está escalado neste dia?"""
    return iso_date in shift_days(employee_id)


def week_bounds(iso_date: str) -> tuple[str, str]:
    """(segunda, domingo) da semana da data."""
    from datetime import timedelta
    d = date_cls.fromisoformat(iso_date)
    mon = d - timedelta(days=d.weekday())
    return mon.isoformat(), (mon + timedelta(days=6)).isoformat()


def week_has_shift(employee_id: int | None, iso_date: str) -> bool:
    """A semana desta data tem algum dia de escala p/ o colaborador?"""
    days = shift_days(employee_id)
    if not days:
        return False
    start, end = week_bounds(iso_date)
    return any(start <= d <= end for d in days)


def employee_reference(employee_id: int | None, iso_date: str, abono: str | None,
                       h1: int, h2: int, override: int | None,
                       on_leave: bool = False,
                       holidays: set[str] | None = None) -> int:
    """Jornada esperada do dia PARA ESTE COLABORADOR — sempre 44h/semana.

    Ordem: férias/licença → folga (FE) → jornada personalizada → domingo/feriado
    → escala marcada na agenda → redistribuição semanal.

    Semana COM escala:  8h de seg-sex + 4h no dia escalado  = 44h
    Semana SEM escala:  8h48 de seg-sex, sáb/dom descanso   = 44h
    Trabalho em dia de descanso (sem escala) = hora extra 100%.
    """
    if on_leave or abono in ABONO_FOLGA:
        return 0
    if override is not None:          # jornada personalizada tem prioridade
        return 0 if day_type(iso_date, holidays) == "H3" else override
    if day_type(iso_date, holidays) == "H3":   # domingo/feriado
        return 0

    week_target = h1 * 5 + h2                  # 44h
    wd = date_cls.fromisoformat(iso_date).weekday()   # 0=seg … 6=dom

    if has_shift(employee_id, iso_date):       # dia escalado
        return h2 if wd >= 5 else h1
    if wd >= 5:                                # sáb/dom sem escala = descanso
        return 0
    if week_has_shift(employee_id, iso_date):  # semana tem escala → 8h/dia
        return h1
    return week_target // 5                    # sem escala → 8h48/dia


def set_calendar(holidays: set[str], partial: dict[str, int],
                 labels: dict[str, str] | None = None) -> None:
    """Instalado no startup e a cada mudança do calendário editável."""
    global _CAL_HOLIDAYS, _CAL_PARTIAL, _CAL_LABELS
    _CAL_HOLIDAYS = set(holidays)
    _CAL_PARTIAL = dict(partial)
    _CAL_LABELS = dict(labels or {})


def active_holidays() -> set[str]:
    return _CAL_HOLIDAYS if _CAL_HOLIDAYS is not None else HOLIDAYS_2026


def partial_deduction(iso_date: str) -> int:
    return _CAL_PARTIAL.get(iso_date, 0)


def calendar_label(iso_date: str) -> str | None:
    return _CAL_LABELS.get(iso_date)


def day_type(iso_date: str, holidays: set[str] | None = None) -> str:
    """H1 (útil) | H2 (sábado) | H3 (domingo/feriado)."""
    holidays = active_holidays() if holidays is None else holidays
    d = date_cls.fromisoformat(iso_date)
    if iso_date in holidays or d.weekday() == 6:  # domingo
        return "H3"
    if d.weekday() == 5:  # sábado
        return "H2"
    return "H1"


def reference_minutes(dtype: str, abono: str | None,
                      h1: int = H1_MINUTES, h2: int = H2_MINUTES,
                      override: int | None = None) -> int:
    """Jornada esperada do dia. Folga (FE) zera a referência.

    `override` (minutos) vem da jornada semanal personalizada do colaborador e
    substitui a referência de dias úteis/sábado (H1/H2). Domingo/feriado (H3)
    permanece 0. `override=0` = folga naquele dia da semana; `None` = padrão global.
    """
    if abono in ABONO_FOLGA:
        return 0
    if dtype == "H3":
        return 0
    base = override if override is not None else (h1 if dtype == "H1" else h2)
    return base


def weekday_reference_override(schedule: tuple | None, iso_date: str) -> int | None:
    """Minutos esperados p/ o dia da semana da data, pela jornada personalizada.

    `schedule` é uma 7-tupla (seg..dom) de int|None; None = usar padrão global.
    """
    if not schedule:
        return None
    idx = date_cls.fromisoformat(iso_date).weekday()  # 0=segunda … 6=domingo
    return schedule[idx] if idx < len(schedule) else None


def _abs_interval(start_min: int, end_min: int) -> tuple[int, int]:
    """Normaliza p/ minutos absolutos, tratando virada de meia-noite."""
    if end_min < start_min:
        end_min += 24 * 60
    return start_min, end_min


def _overlap(a1: int, a2: int, b1: int, b2: int) -> int:
    return max(0, min(a2, b2) - max(a1, b1))


def night_minutes(entry: str, exit_time: str,
                  break_start: str | None = None, break_end: str | None = None) -> int:
    """Minutos trabalhados dentro da janela noturna 22:00–05:00 (desconta intervalo)."""
    s, e = _abs_interval(time_to_minutes(entry), time_to_minutes(exit_time))
    windows = [(k * 1440 + NIGHT_START_MIN, k * 1440 + 1440 + NIGHT_END_MIN) for k in (-1, 0, 1)]
    total = sum(_overlap(s, e, w1, w2) for w1, w2 in windows)
    if break_start and break_end:
        bs, be = _abs_interval(time_to_minutes(break_start), time_to_minutes(break_end))
        total -= sum(_overlap(bs, be, w1, w2) for w1, w2 in windows)
    return max(total, 0)


@dataclass
class DayResult:
    day_type: str
    reference: int        # jornada esperada (min)
    worked: int           # total trabalhado (min)
    effective: int        # trabalhado + abono pago (base do saldo)
    balance: int          # effective − reference
    normal: int           # horas NORMAIS (dentro da jornada) — min
    shortfall: int        # atraso/horas falta (jornada não cumprida) — min
    rest_day: bool        # dia de descanso p/ este colaborador (ref. 0)
    extra50: int          # extra normal: além do expediente — min
    extra100: int         # extra em dobro: trabalho no descanso — min
    night: int            # min na janela noturna
    night_bonus: int      # adicional (night × 20%) em min
    over_limit: bool      # > 10h


def compute_day(
    iso_date: str,
    entry: str | None,
    break_start: str | None,
    break_end: str | None,
    exit_time: str | None,
    abono: str | None = None,
    holidays: set[str] | None = None,
    h1: int = H1_MINUTES,
    h2: int = H2_MINUTES,
    schedule: tuple | None = None,
    on_leave: bool = False,
    employee_id: int | None = None,
) -> DayResult:
    dtype = day_type(iso_date, holidays)
    override = weekday_reference_override(schedule, iso_date)
    reference = employee_reference(employee_id, iso_date, abono, h1, h2, override,
                                   on_leave=on_leave, holidays=holidays)
    if reference > 0:
        reference = max(reference - partial_deduction(iso_date), 0)

    if entry and exit_time:
        brk = calc_break_minutes(break_start, break_end)
        worked = calc_worked_minutes(entry, exit_time, brk)
        night = night_minutes(entry, exit_time, break_start, break_end)
    else:
        worked = 0
        night = 0

    # Efetivo: abono "como trabalhado" garante ao menos a referência (sem débito)
    effective = worked
    if abono in ABONO_AS_WORKED:
        effective = max(worked, reference)

    # ── Classificação DP/Contabilidade ──────────────────────────────────────
    # Dia SEM jornada esperada = descanso do colaborador (domingo, feriado,
    # sábado de quem não faz escala, folga, férias/licença): todo o trabalho
    # é hora EM DOBRO (100%).
    # Dia COM jornada: até a jornada = horas NORMAIS; o que passa = extra 50%
    # (ficar depois do expediente ou entrar mais cedo). O que falta = atraso.
    rest_day = reference == 0
    if rest_day:
        normal = 0
        extra50 = 0
        extra100 = worked
        shortfall = 0
    else:
        normal = min(worked, reference)
        extra50 = max(worked - reference, 0)
        extra100 = 0
        # Abono pago (atestado/viagem/abono) não gera atraso
        shortfall = 0 if abono in ABONO_AS_WORKED else max(reference - worked, 0)
    night_bonus = round(night * NIGHT_PCT)

    return DayResult(
        day_type=dtype,
        reference=reference,
        worked=worked,
        effective=effective,
        balance=effective - reference,
        normal=normal,
        shortfall=shortfall,
        rest_day=rest_day,
        extra50=extra50,
        extra100=extra100,
        night=night,
        night_bonus=night_bonus,
        over_limit=worked > DAILY_ALERT_MINUTES,
    )
