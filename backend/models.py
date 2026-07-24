from typing import Optional
from sqlmodel import Field, SQLModel


class Employee(SQLModel, table=True):
    __tablename__ = "employees"

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True, max_length=60)
    # senha (4-8 chars quaisquer). Pode ser definida pelo admin no cadastro
    # OU pelo colaborador no 1º acesso, se admin não definiu.
    pin_hash: Optional[str] = Field(default=None)

    # Jornada semanal personalizada (minutos por dia da semana).
    # NULL = usa std_minutes global. Segunda=mon ... Domingo=sun.
    mon_minutes: Optional[int] = Field(default=None)
    tue_minutes: Optional[int] = Field(default=None)
    wed_minutes: Optional[int] = Field(default=None)
    thu_minutes: Optional[int] = Field(default=None)
    fri_minutes: Optional[int] = Field(default=None)
    sat_minutes: Optional[int] = Field(default=None)
    sun_minutes: Optional[int] = Field(default=None)


class DailyRecord(SQLModel, table=True):
    __tablename__ = "daily_records"

    id: Optional[int] = Field(default=None, primary_key=True)
    employee_id: int = Field(foreign_key="employees.id", index=True)
    date: str = Field(index=True)           # YYYY-MM-DD

    entry_time: str                          # HH:MM  — hora de entrada
    break_start: Optional[str] = Field(default=None)   # HH:MM  — início do intervalo
    break_end:   Optional[str] = Field(default=None)   # HH:MM  — fim do intervalo
    exit_time:   Optional[str] = Field(default=None)   # HH:MM  — hora de saída

    standard_minutes: int = Field(default=480)

    # Calculados
    break_minutes:    Optional[int] = Field(default=None)
    worked_minutes:   Optional[int] = Field(default=None)
    overtime_minutes: Optional[int] = Field(default=None)

    note: Optional[str] = Field(default=None, max_length=500)
    attachments: Optional[str] = Field(default=None, max_length=500)


class CalendarDay(SQLModel, table=True):
    """Dia especial marcado pelo admin: feriado, ponto facultativo ou evento
    manual (jogo do Brasil, dedetização...). Abate da meta semanal."""
    __tablename__ = "calendar_days"

    id: Optional[int] = Field(default=None, primary_key=True)
    date: str = Field(index=True, unique=True)          # YYYY-MM-DD
    kind: str = Field(default="feriado")                # feriado | facultativo | evento
    label: str = Field(max_length=80)
    # None = abate o dia inteiro (a jornada esperada daquele dia).
    # Número = abate parcial em minutos (ex.: 180 = dispensa de 3h).
    deduct_minutes: Optional[int] = Field(default=None)


class Settings(SQLModel, table=True):
    __tablename__ = "settings"

    id: Optional[int] = Field(default=None, primary_key=True)
    std_minutes: int = Field(default=480)
    admin_pin_hash: Optional[str] = Field(default=None)
