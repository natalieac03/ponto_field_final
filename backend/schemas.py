import re
from typing import Optional
from pydantic import BaseModel, field_validator


# ── Employee ──────────────────────────────────────────────────────────────────

def _validate_password(v: str) -> str:
    """Senha 4-8 chars (qualquer caractere, preserva espaços)."""
    if not (4 <= len(v) <= 8):
        raise ValueError("Senha deve ter entre 4 e 8 caracteres")
    return v


class EmployeeRename(BaseModel):
    name: str

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Nome não pode ser vazio")
        if len(v) > 60:
            raise ValueError("Nome muito longo (máx. 60 caracteres)")
        return v


class EmployeeCreate(BaseModel):
    """Admin cria — pode opcionalmente definir um PIN inicial.
    Se não definir, o colaborador cria no 1º acesso."""
    name: str
    pin: Optional[str] = None

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Nome não pode ser vazio")
        return v

    @field_validator("pin")
    @classmethod
    def pin_optional_valid(cls, v: Optional[str]) -> Optional[str]:
        if v is None or v == "":
            return None
        return _validate_password(v)


class WeeklySchedule(BaseModel):
    """Jornada semanal em minutos (None = usa std_minutes global)."""
    mon_minutes: Optional[int] = None
    tue_minutes: Optional[int] = None
    wed_minutes: Optional[int] = None
    thu_minutes: Optional[int] = None
    fri_minutes: Optional[int] = None
    sat_minutes: Optional[int] = None
    sun_minutes: Optional[int] = None

    @field_validator("mon_minutes", "tue_minutes", "wed_minutes", "thu_minutes",
                     "fri_minutes", "sat_minutes", "sun_minutes")
    @classmethod
    def valid_range(cls, v: Optional[int]) -> Optional[int]:
        if v is None:
            return None
        if v < 0 or v > 1440:
            raise ValueError("Minutos devem estar entre 0 e 1440")
        return v


class EmployeeRead(BaseModel):
    id: int
    name: str
    has_password: bool
    mon_minutes: Optional[int] = None
    tue_minutes: Optional[int] = None
    wed_minutes: Optional[int] = None
    thu_minutes: Optional[int] = None
    fri_minutes: Optional[int] = None
    sat_minutes: Optional[int] = None
    sun_minutes: Optional[int] = None

    model_config = {"from_attributes": False}


class EmployeePasswordSet(BaseModel):
    """1º acesso — define senha (não pode haver senha já)."""
    password: str

    @field_validator("password")
    @classmethod
    def pw_valid(cls, v: str) -> str:
        return _validate_password(v)


class EmployeePasswordChange(BaseModel):
    """Colaborador altera senha autenticando com a atual."""
    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def pw_valid(cls, v: str) -> str:
        return _validate_password(v)


# ── Auth ──────────────────────────────────────────────────────────────────────

class AuthEmployeeRequest(BaseModel):
    employee_id: int
    password: str

class AuthAdminRequest(BaseModel):
    password: str

class AuthEmployeeResponse(BaseModel):
    id: int
    name: str

class AuthAdminResponse(BaseModel):
    ok: bool


# ── DailyRecord ───────────────────────────────────────────────────────────────

HHMM_RE = re.compile(r"^\d{2}:\d{2}$")


def _validate_hhmm_or_empty(v: Optional[str]) -> Optional[str]:
    """Aceita None (não enviado), '' (limpar) ou HH:MM válido."""
    if v is None:
        return None
    if v == "":
        return ""  # mantém como sentinela "limpar"
    if not HHMM_RE.match(v):
        raise ValueError("Formato de hora inválido (use HH:MM)")
    h, m = v.split(":")
    if int(h) > 23 or int(m) > 59:
        raise ValueError("Hora inválida")
    return v


def _validate_hhmm(v: Optional[str]) -> Optional[str]:
    if v is None or v == "":
        return None
    if not HHMM_RE.match(v):
        raise ValueError("Formato de hora inválido (use HH:MM)")
    h, m = v.split(":")
    if int(h) > 23 or int(m) > 59:
        raise ValueError("Hora inválida")
    return v


class RecordCreate(BaseModel):
    employee_id: int
    date: str
    entry_time: str
    standard_minutes: int = 480
    note: Optional[str] = None

    @field_validator("note")
    @classmethod
    def note_max_len(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and len(v) > 500:
            raise ValueError("Observação deve ter no máximo 500 caracteres")
        return v


class RecordPatchBreak(BaseModel):
    break_start: Optional[str] = None
    break_end:   Optional[str] = None


class RecordPatchExit(BaseModel):
    exit_time: str
    standard_minutes: Optional[int] = None
    note: Optional[str] = None

    @field_validator("note")
    @classmethod
    def note_max_len(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and len(v) > 500:
            raise ValueError("Observação deve ter no máximo 500 caracteres")
        return v


class RecordPatchNote(BaseModel):
    note: Optional[str] = None

    @field_validator("note")
    @classmethod
    def note_max_len(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and len(v) > 500:
            raise ValueError("Observação deve ter no máximo 500 caracteres")
        return v


class RecordPatchTimes(BaseModel):
    """Admin edita horários (entrada/saída/intervalo) e opcionalmente a jornada do dia.
    String vazia = limpar o campo. Recalcula trabalhado/HE automaticamente."""
    entry_time: Optional[str] = None
    break_start: Optional[str] = None
    break_end: Optional[str] = None
    exit_time: Optional[str] = None
    standard_minutes: Optional[int] = None

    @field_validator("entry_time", "break_start", "break_end", "exit_time")
    @classmethod
    def hhmm(cls, v: Optional[str]) -> Optional[str]:
        return _validate_hhmm_or_empty(v)

    @field_validator("standard_minutes")
    @classmethod
    def valid_std(cls, v: Optional[int]) -> Optional[int]:
        if v is None:
            return None
        if v < 1 or v > 1440:
            raise ValueError("Jornada deve ser entre 1 e 1440 minutos")
        return v


class RecordRead(BaseModel):
    id: int
    employee_id: int
    date: str
    entry_time: str
    break_start: Optional[str]
    break_end:   Optional[str]
    exit_time:   Optional[str]
    standard_minutes: int
    break_minutes:    Optional[int]
    worked_minutes:   Optional[int]
    overtime_minutes: Optional[int]
    note: Optional[str]
    attachments: list[str] = []

    model_config = {"from_attributes": True}


# ── Settings ──────────────────────────────────────────────────────────────────

class SettingsUpdate(BaseModel):
    std_minutes: int = 480

class AdminPasswordUpdate(BaseModel):
    password: str

    @field_validator("password")
    @classmethod
    def pw_not_empty(cls, v: str) -> str:
        if len(v.strip()) < 4:
            raise ValueError("Senha deve ter pelo menos 4 caracteres")
        return v.strip()

class SettingsRead(BaseModel):
    id: int
    std_minutes: int
    has_admin_password: bool

    model_config = {"from_attributes": False}


# ── Reports ───────────────────────────────────────────────────────────────────

class BankEntry(BaseModel):
    employee_id: int
    employee_name: str
    total_records: int
    open_records: int
    worked_minutes: int
    standard_minutes: int
    positive_overtime: int
    negative_overtime: int
    balance: int

class BankReport(BaseModel):
    employees: list[BankEntry]
    total_balance: int
    employees_positive: int
    employees_negative: int
    total_records: int
    open_records: int

class MonthlyRecord(RecordRead):
    employee_name: str

class MonthlySummary(BaseModel):
    employee_id: int
    employee_name: str
    days: int
    worked_minutes: int
    standard_minutes: int
    positive_overtime: int
    negative_overtime: int
    balance: int

class CalendarDayCreate(BaseModel):
    date: str                       # YYYY-MM-DD
    kind: str = "feriado"           # feriado | facultativo | evento
    label: str
    deduct_minutes: Optional[int] = None   # None = dia inteiro

    @field_validator("date")
    @classmethod
    def date_ok(cls, v: str) -> str:
        from datetime import date as _d
        try:
            _d.fromisoformat(v)
        except ValueError:
            raise ValueError("Data inválida (use AAAA-MM-DD)")
        return v

    @field_validator("label")
    @classmethod
    def label_ok(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Descrição não pode ser vazia")
        return v[:80]

    @field_validator("kind")
    @classmethod
    def kind_ok(cls, v: str) -> str:
        if v not in ("feriado", "facultativo", "evento"):
            raise ValueError("Tipo inválido")
        return v

    @field_validator("deduct_minutes")
    @classmethod
    def deduct_ok(cls, v: Optional[int]) -> Optional[int]:
        if v is None:
            return None
        if v < 0 or v > 1440:
            raise ValueError("Abatimento deve ser entre 0 e 1440 minutos")
        return v


class CalendarDayRead(BaseModel):
    id: int
    date: str
    kind: str
    label: str
    deduct_minutes: Optional[int]

    model_config = {"from_attributes": True}


class HolidaySuggestion(BaseModel):
    date: str
    label: str
    kind: str          # feriado | facultativo
    already_added: bool


class WeeklyEntry(BaseModel):
    """Fechamento de uma semana (seg-dom) de um colaborador."""
    employee_id: int
    employee_name: str
    week_start: str          # segunda (YYYY-MM-DD)
    week_end: str            # domingo (YYYY-MM-DD)
    days: int                # dias com registro fechado na semana
    worked_minutes: int      # total trabalhado na semana (inclui sábado/escala)
    expected_minutes: int    # meta da semana JÁ com abatimentos aplicados
    deducted_minutes: int = 0        # quanto foi abatido por feriado/evento
    deduction_labels: list[str] = [] # ex.: ["07/09 Independência", "12/06 Jogo do Brasil (-3h)"]
    balance: int             # worked - expected

class MonthlyReport(BaseModel):
    year: int
    month: int
    records: list[MonthlyRecord]
    weeks: list[WeeklyEntry] = []
    summary: list[MonthlySummary]
    total_worked: int
    total_overtime: int
    positive_overtime: int
    negative_overtime: int
