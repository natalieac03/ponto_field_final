"""DTOs de entrada/saída (pydantic) — contrato dos casos de uso e da API.

Ficam na application (presentation e infrastructure dependem daqui, para dentro).
"""
import re
from datetime import date as _date
from typing import Optional

from pydantic import BaseModel, field_validator, model_validator

from app.domain.constants import ABONO_CODES, CONTRACT_TYPES

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


# ── Empregado ────────────────────────────────────────────────────────────────
def _validate_password(v: str) -> str:
    if not (4 <= len(v) <= 8):
        raise ValueError("Senha deve ter entre 4 e 8 caracteres")
    return v


def _clean_email(v: Optional[str]) -> Optional[str]:
    if v is None:
        return None
    v = v.strip()
    if v == "":
        return None
    if not EMAIL_RE.match(v):
        raise ValueError("E-mail inválido")
    if len(v) > 120:
        raise ValueError("E-mail muito longo (máx. 120 caracteres)")
    return v


def _clean_hire_date(v: Optional[str]) -> Optional[str]:
    if v is None:
        return None
    v = v.strip()
    if v == "":
        return None
    try:
        _date.fromisoformat(v)
    except ValueError:
        raise ValueError("Data de admissão inválida (use AAAA-MM-DD)")
    return v


def _clean_contract(v: Optional[str]) -> Optional[str]:
    if v is None:
        return None
    v = v.strip()
    if v == "":
        return None
    if v not in CONTRACT_TYPES:
        raise ValueError(f"Tipo de contrato inválido. Use: {', '.join(sorted(CONTRACT_TYPES))}")
    return v


def _clean_text(v: Optional[str], max_len: int) -> Optional[str]:
    if v is None:
        return None
    v = v.strip()
    if v == "":
        return None
    if len(v) > max_len:
        raise ValueError(f"Campo muito longo (máx. {max_len} caracteres)")
    return v


class EmployeeProfileUpdate(BaseModel):
    """Dados de RH do colaborador — geridos pelo gestor. Todos opcionais.
    cpf: "" limpa; is_admin liga/desliga o acesso ao painel."""
    cpf: Optional[str] = None
    is_admin: Optional[bool] = None
    termination_date: Optional[str] = None    # "" limpa
    role: Optional[str] = None
    hire_date: Optional[str] = None
    department: Optional[str] = None
    registration: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    contract_type: Optional[str] = None

    @field_validator("role", "department")
    @classmethod
    def _role_dep(cls, v: Optional[str]) -> Optional[str]:
        return _clean_text(v, 60)

    @field_validator("registration", "phone")
    @classmethod
    def _reg_phone(cls, v: Optional[str]) -> Optional[str]:
        return _clean_text(v, 30)

    @field_validator("email")
    @classmethod
    def _email(cls, v: Optional[str]) -> Optional[str]:
        return _clean_email(v)

    @field_validator("hire_date")
    @classmethod
    def _hire(cls, v: Optional[str]) -> Optional[str]:
        return _clean_hire_date(v)

    @field_validator("contract_type")
    @classmethod
    def _contract(cls, v: Optional[str]) -> Optional[str]:
        return _clean_contract(v)


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


class EmployeeCreate(EmployeeProfileUpdate):
    """Cria colaborador. Herda os campos de perfil (opcionais) de RH."""
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
    cpf_masked: Optional[str] = None
    has_cpf: bool = False
    is_admin: bool = False
    active: bool = True
    termination_date: Optional[str] = None
    photo: Optional[str] = None
    role: Optional[str] = None
    hire_date: Optional[str] = None
    department: Optional[str] = None
    registration: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    contract_type: Optional[str] = None
    mon_minutes: Optional[int] = None
    tue_minutes: Optional[int] = None
    wed_minutes: Optional[int] = None
    thu_minutes: Optional[int] = None
    fri_minutes: Optional[int] = None
    sat_minutes: Optional[int] = None
    sun_minutes: Optional[int] = None

    model_config = {"from_attributes": False}


class EmployeePublicRead(BaseModel):
    """Superfície mínima e pública p/ a landing: só o necessário p/ o colaborador
    se identificar. Não expõe jornada, perfil de RH nem foto."""
    id: int
    name: str
    has_password: bool


class EmployeePasswordSet(BaseModel):
    password: str

    @field_validator("password")
    @classmethod
    def pw_valid(cls, v: str) -> str:
        return _validate_password(v)


class EmployeePasswordChange(BaseModel):
    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def pw_valid(cls, v: str) -> str:
        return _validate_password(v)


# ── Auth ─────────────────────────────────────────────────────────────────────
class AuthEmployeeRequest(BaseModel):
    employee_id: int
    password: str


class AuthAdminRequest(BaseModel):
    password: str


class AuthEmployeeResponse(BaseModel):
    id: int
    name: str
    token: str


class AuthAdminResponse(BaseModel):
    ok: bool
    token: str
    name: str = "Administrador"
    employee_id: Optional[int] = None


# ── Registro diário ──────────────────────────────────────────────────────────
HHMM_RE = re.compile(r"^\d{2}:\d{2}$")


def _validate_hhmm_or_empty(v: Optional[str]) -> Optional[str]:
    if v is None:
        return None
    if v == "":
        return ""
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
    """Cria um registro. Um dia precisa ter batida (entry_time) OU um abono."""
    employee_id: int
    date: str
    entry_time: Optional[str] = None
    break_start: Optional[str] = None
    break_end: Optional[str] = None
    exit_time: Optional[str] = None
    abono_code: Optional[str] = None
    standard_minutes: int = 480  # compat (ignorado no modelo novo)
    note: Optional[str] = None

    @field_validator("entry_time", "break_start", "break_end", "exit_time")
    @classmethod
    def hhmm(cls, v: Optional[str]) -> Optional[str]:
        return _validate_hhmm(v)

    @field_validator("abono_code")
    @classmethod
    def abono_valid(cls, v: Optional[str]) -> Optional[str]:
        if v is None or v == "":
            return None
        v = v.upper()
        if v not in ABONO_CODES:
            raise ValueError(f"Abono inválido. Use um de: {', '.join(sorted(ABONO_CODES))}")
        return v

    @field_validator("note")
    @classmethod
    def note_max_len(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and len(v) > 500:
            raise ValueError("Observação deve ter no máximo 500 caracteres")
        return v

    @model_validator(mode="after")
    def entry_or_abono(self):
        if not self.entry_time and not self.abono_code:
            raise ValueError("Informe o horário de entrada ou um abono para o dia.")
        return self


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
    entry_time: Optional[str] = None
    break_start: Optional[str] = None
    break_end: Optional[str] = None
    exit_time: Optional[str] = None
    abono_code: Optional[str] = None
    standard_minutes: Optional[int] = None

    @field_validator("entry_time", "break_start", "break_end", "exit_time")
    @classmethod
    def hhmm(cls, v: Optional[str]) -> Optional[str]:
        return _validate_hhmm_or_empty(v)

    @field_validator("abono_code")
    @classmethod
    def abono_valid(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        if v == "":
            return ""
        v = v.upper()
        if v not in ABONO_CODES:
            raise ValueError(f"Abono inválido. Use um de: {', '.join(sorted(ABONO_CODES))}")
        return v

    @field_validator("standard_minutes")
    @classmethod
    def valid_std(cls, v: Optional[int]) -> Optional[int]:
        if v is None:
            return None
        if v < 1 or v > 1440:
            raise ValueError("Jornada deve ser entre 1 e 1440 minutos")
        return v


class RecordReview(BaseModel):
    action: str  # "approve" | "reject"
    note: Optional[str] = None

    @field_validator("action")
    @classmethod
    def action_valid(cls, v: str) -> str:
        if v not in ("approve", "reject"):
            raise ValueError("Ação deve ser 'approve' ou 'reject'")
        return v

    @field_validator("note")
    @classmethod
    def note_max_len(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and len(v) > 300:
            raise ValueError("Nota deve ter no máximo 300 caracteres")
        return v


class RecordRead(BaseModel):
    id: int
    employee_id: int
    date: str
    entry_time: Optional[str] = None
    break_start: Optional[str] = None
    break_end:   Optional[str] = None
    exit_time:   Optional[str] = None
    day_type: Optional[str] = None
    abono_code: Optional[str] = None
    standard_minutes: int
    break_minutes:      Optional[int] = None
    worked_minutes:     Optional[int] = None
    effective_minutes:  Optional[int] = None
    overtime_minutes:   Optional[int] = None
    normal_minutes:     Optional[int] = None
    shortfall_minutes:  Optional[int] = None
    extra50_minutes:    Optional[int] = None
    extra100_minutes:   Optional[int] = None
    night_minutes:      Optional[int] = None
    night_bonus_minutes: Optional[int] = None
    over_limit: bool = False
    status: str = "aprovado"
    is_retroactive: bool = False
    removal_requested: bool = False
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[str] = None
    review_note: Optional[str] = None
    note: Optional[str] = None
    attachments: list[str] = []

    model_config = {"from_attributes": True}


# ── Configurações ────────────────────────────────────────────────────────────
class SettingsUpdate(BaseModel):
    std_minutes: int = 480
    h1_minutes: Optional[int] = None
    h2_minutes: Optional[int] = None

    @field_validator("h1_minutes", "h2_minutes")
    @classmethod
    def valid_journey(cls, v: Optional[int]) -> Optional[int]:
        if v is None:
            return None
        if v < 0 or v > 1440:
            raise ValueError("Jornada deve estar entre 0 e 1440 minutos")
        return v


class RecordRequestEdit(BaseModel):
    """Colaborador solicita edição do próprio registro (entra pendente)."""
    entry_time: Optional[str] = None
    break_start: Optional[str] = None
    break_end: Optional[str] = None
    exit_time: Optional[str] = None
    abono_code: Optional[str] = None
    note: Optional[str] = None

    @field_validator("entry_time", "break_start", "break_end", "exit_time")
    @classmethod
    def hhmm(cls, v: Optional[str]) -> Optional[str]:
        return _validate_hhmm_or_empty(v)

    @field_validator("abono_code")
    @classmethod
    def abono_valid(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        if v == "":
            return ""
        v = v.upper()
        if v not in ABONO_CODES:
            raise ValueError(f"Abono inválido. Use um de: {', '.join(sorted(ABONO_CODES))}")
        return v

    @field_validator("note")
    @classmethod
    def note_max_len(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and len(v) > 500:
            raise ValueError("Observação deve ter no máximo 500 caracteres")
        return v


# ── Log de atividades ────────────────────────────────────────────────────────
class ActivityLogRead(BaseModel):
    id: int
    created_at: str
    actor_type: str
    actor_id: Optional[int] = None
    actor_name: str
    action: str
    entity_type: str
    entity_id: Optional[int] = None
    employee_id: Optional[int] = None
    description: str

    model_config = {"from_attributes": True}


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
    h1_minutes: int = 480
    h2_minutes: int = 240
    has_admin_password: bool

    model_config = {"from_attributes": False}


# ── Relatórios ───────────────────────────────────────────────────────────────
class BankEntry(BaseModel):
    employee_id: int
    employee_name: str
    total_records: int
    open_records: int
    pending_records: int
    worked_minutes: int
    standard_minutes: int
    normal_minutes: int = 0
    shortfall_minutes: int = 0
    extra50_minutes: int = 0
    extra100_minutes: int = 0
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
    pending_records: int


class MonthlyRecord(RecordRead):
    employee_name: str


class WeeklyBucket(BaseModel):
    week: int
    label: str
    worked_minutes: int
    reference_minutes: int
    balance: int


class MonthlySummary(BaseModel):
    employee_id: int
    employee_name: str
    days: int
    days_h1: int
    days_h2: int
    days_h3: int
    worked_minutes: int
    reference_minutes: int
    balance: int
    normal_minutes: int = 0        # horas normais (dentro da jornada)
    shortfall_minutes: int = 0     # atraso / horas falta
    extra50_minutes: int
    extra100_minutes: int
    night_bonus_minutes: int
    faltas: int
    atestados: int
    abonos: int
    viagens: int
    folgas: int
    over_limit_days: int
    pending: int
    weeks: list[WeeklyBucket] = []
    standard_minutes: int = 0
    positive_overtime: int = 0
    negative_overtime: int = 0


class MonthlyReport(BaseModel):
    year: int
    month: int
    records: list[MonthlyRecord]
    summary: list[MonthlySummary]
    total_worked: int
    total_reference: int
    total_overtime: int
    positive_overtime: int
    negative_overtime: int
    total_normal: int = 0
    total_shortfall: int = 0
    total_extra50: int = 0
    total_extra100: int
    total_night_bonus: int
    pending_records: int
