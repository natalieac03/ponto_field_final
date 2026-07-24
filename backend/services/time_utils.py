def time_to_minutes(t: str) -> int:
    """HH:MM → minutos totais."""
    h, m = map(int, t.split(":"))
    return h * 60 + m


def calc_break_minutes(break_start: str | None, break_end: str | None) -> int:
    """Duração do intervalo em minutos. Retorna 0 se não informado."""
    if not break_start or not break_end:
        return 0
    diff = time_to_minutes(break_end) - time_to_minutes(break_start)
    return max(diff, 0)   # nunca negativo


def calc_worked_minutes(entry: str, exit_time: str, break_minutes: int) -> int:
    """
    Horas Trabalhadas = (Saída − Entrada) − Intervalo
    Suporta virada de meia-noite.
    """
    worked = time_to_minutes(exit_time) - time_to_minutes(entry) - break_minutes
    if worked < 0:
        worked += 24 * 60
    return worked


def calc_overtime(worked_minutes: int, standard_minutes: int) -> int:
    """Positivo = hora extra, negativo = débito."""
    return worked_minutes - standard_minutes
