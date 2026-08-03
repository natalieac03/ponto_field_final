"""Entidades persistentes (SQLModel). Único ponto do domínio que acopla ORM —
compromisso pragmático do SQLModel (entidade = tabela) documentado no plano.
"""
from typing import Optional
from sqlmodel import Field, SQLModel


class Employee(SQLModel, table=True):
    __tablename__ = "employees"

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True, max_length=60)
    pin_hash: Optional[str] = Field(default=None)
    photo: Optional[str] = Field(default=None)  # nome do arquivo da foto de perfil (avatar)
    # CPF só em dígitos; a API devolve sempre mascarado (123.***.**4-56)
    cpf: Optional[str] = Field(default=None, max_length=11)
    # Acesso ao painel do gestor com a própria senha (estrela na lista)
    is_admin: bool = Field(default=False)
    # Desligamento: inativo continua no banco (histórico preservado) e pode ser reativado
    active: bool = Field(default=True)
    termination_date: Optional[str] = Field(default=None)   # YYYY-MM-DD

    # Dados de RH (geridos pelo gestor)
    role: Optional[str] = Field(default=None, max_length=60)          # cargo/função
    hire_date: Optional[str] = Field(default=None)                     # admissão ISO 'YYYY-MM-DD'
    department: Optional[str] = Field(default=None, max_length=60)     # setor/departamento
    registration: Optional[str] = Field(default=None, max_length=30)   # matrícula/registro
    email: Optional[str] = Field(default=None, max_length=120)
    phone: Optional[str] = Field(default=None, max_length=30)
    contract_type: Optional[str] = Field(default=None, max_length=20)  # CLT/PJ/Estágio/Temporário

    # Jornada semanal personalizada (minutos por dia da semana)
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
    date: str = Field(index=True)

    entry_time:  Optional[str] = Field(default=None)
    break_start: Optional[str] = Field(default=None)
    break_end:   Optional[str] = Field(default=None)
    exit_time:   Optional[str] = Field(default=None)

    # Modelo banco de horas
    day_type: Optional[str] = Field(default=None)
    abono_code: Optional[str] = Field(default=None)
    standard_minutes: int = Field(default=480)

    # Calculados
    break_minutes:       Optional[int] = Field(default=None)
    worked_minutes:      Optional[int] = Field(default=None)
    effective_minutes:   Optional[int] = Field(default=None)
    overtime_minutes:    Optional[int] = Field(default=None)
    normal_minutes:      Optional[int] = Field(default=None)   # horas normais (dentro da jornada)
    shortfall_minutes:   Optional[int] = Field(default=None)   # atraso / horas falta
    extra50_minutes:     Optional[int] = Field(default=None)
    extra100_minutes:    Optional[int] = Field(default=None)
    night_minutes:       Optional[int] = Field(default=None)
    night_bonus_minutes: Optional[int] = Field(default=None)
    over_limit: bool = Field(default=False)

    # Fluxo de aprovação / lançamento retroativo
    status: str = Field(default="aprovado", index=True)
    is_retroactive: bool = Field(default=False)
    removal_requested: bool = Field(default=False, index=True)  # colaborador pediu exclusão → fila do gestor
    reviewed_by: Optional[str] = Field(default=None)
    reviewed_at: Optional[str] = Field(default=None)
    review_note: Optional[str] = Field(default=None, max_length=300)

    note: Optional[str] = Field(default=None, max_length=500)
    attachments: Optional[str] = Field(default=None, max_length=500)


class ActivityLog(SQLModel, table=True):
    """Trilha de auditoria — um registro por ação que altera dados."""
    __tablename__ = "activity_logs"

    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: str = Field(index=True)  # ISO 'YYYY-MM-DDTHH:MM:SS'
    actor_type: str = Field(default="employee")  # "admin" | "employee"
    actor_id: Optional[int] = Field(default=None)
    actor_name: str = Field(default="")
    action: str = Field(index=True)  # código curto (ex.: "ponto_saida", "aprovacao")
    entity_type: str = Field(default="")  # "record" | "employee" | "settings"
    entity_id: Optional[int] = Field(default=None)
    employee_id: Optional[int] = Field(default=None, index=True)  # colaborador-alvo (p/ filtro do próprio)
    description: str = Field(default="", max_length=300)


class EmployeeLeave(SQLModel, table=True):
    """Período de ausência programada de UM colaborador (férias, licença).
    Os dias no intervalo têm referência 0 — não geram débito na ficha."""
    __tablename__ = "employee_leaves"

    id: Optional[int] = Field(default=None, primary_key=True)
    employee_id: int = Field(index=True)
    start_date: str = Field(index=True)      # YYYY-MM-DD
    end_date: str = Field(index=True)        # YYYY-MM-DD (inclusive)
    kind: str = Field(default="ferias")      # ferias | licenca | folga
    note: Optional[str] = Field(default=None, max_length=120)


class EmployeeShift(SQLModel, table=True):
    """Escala marcada na agenda: dia em que o colaborador está escalado.
    Sábado escalado = jornada normal (4h). Sábado NÃO escalado é descanso —
    se trabalhar, vira hora extra 100%."""
    __tablename__ = "employee_shifts"

    id: Optional[int] = Field(default=None, primary_key=True)
    employee_id: int = Field(index=True)
    date: str = Field(index=True)              # YYYY-MM-DD
    note: Optional[str] = Field(default=None, max_length=120)


class CalendarDay(SQLModel, table=True):
    """Dia especial marcado pelo gestor: feriado, ponto facultativo ou evento
    (jogo do Brasil, dedetização…). Dia inteiro vira H3 (referência 0);
    parcial abate N minutos da referência do dia."""
    __tablename__ = "calendar_days"

    id: Optional[int] = Field(default=None, primary_key=True)
    date: str = Field(index=True, unique=True)
    kind: str = Field(default="feriado")             # feriado | facultativo | evento
    label: str = Field(max_length=80)
    deduct_minutes: Optional[int] = Field(default=None)  # None = dia inteiro


class Settings(SQLModel, table=True):
    __tablename__ = "settings"

    id: Optional[int] = Field(default=None, primary_key=True)
    std_minutes: int = Field(default=480)
    h1_minutes: int = Field(default=480)
    h2_minutes: int = Field(default=240)
    admin_pin_hash: Optional[str] = Field(default=None)
