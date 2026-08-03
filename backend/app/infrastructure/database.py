"""Engine e sessão do banco (SQLModel/SQLite)."""
from sqlalchemy import inspect, text
from sqlmodel import Session, SQLModel, create_engine

from app.domain import models  # noqa: F401 — importa p/ registrar as tabelas no metadata
from app.infrastructure.config import DATABASE_URL

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args, echo=False,
                       pool_pre_ping=True)  # Neon/Postgres: reconecta se a conexão dormir


# Migrações leves de colunas adicionadas depois (SQLite não faz via create_all).
# Cada entrada: (tabela, coluna, DDL da coluna).
_COLUMN_MIGRATIONS = [
    ("employees", "photo", "VARCHAR"),
    ("employees", "role", "VARCHAR"),
    ("employees", "hire_date", "VARCHAR"),
    ("employees", "department", "VARCHAR"),
    ("employees", "registration", "VARCHAR"),
    ("employees", "email", "VARCHAR"),
    ("employees", "phone", "VARCHAR"),
    ("employees", "contract_type", "VARCHAR"),
    ("employees", "cpf", "VARCHAR(11)"),
    ("employees", "is_admin", "BOOLEAN DEFAULT FALSE NOT NULL"),
    ("employees", "active", "BOOLEAN DEFAULT TRUE NOT NULL"),
    ("employees", "termination_date", "VARCHAR"),
    # Banco vindo da versão anterior (Neon): colunas do modelo banco de horas
    ("daily_records", "day_type", "VARCHAR"),
    ("daily_records", "abono_code", "VARCHAR"),
    ("daily_records", "effective_minutes", "INTEGER"),
    ("daily_records", "normal_minutes", "INTEGER"),
    ("daily_records", "shortfall_minutes", "INTEGER"),
    ("daily_records", "extra50_minutes", "INTEGER"),
    ("daily_records", "extra100_minutes", "INTEGER"),
    ("daily_records", "night_minutes", "INTEGER"),
    ("daily_records", "night_bonus_minutes", "INTEGER"),
    ("daily_records", "over_limit", "BOOLEAN DEFAULT FALSE NOT NULL"),
    ("daily_records", "status", "VARCHAR DEFAULT 'aprovado' NOT NULL"),
    ("daily_records", "is_retroactive", "BOOLEAN DEFAULT FALSE NOT NULL"),
    ("daily_records", "removal_requested", "BOOLEAN DEFAULT FALSE NOT NULL"),
    ("daily_records", "reviewed_by", "VARCHAR"),
    ("daily_records", "reviewed_at", "VARCHAR"),
    ("daily_records", "review_note", "VARCHAR(300)"),
    ("settings", "h1_minutes", "INTEGER DEFAULT 480 NOT NULL"),
    ("settings", "h2_minutes", "INTEGER DEFAULT 240 NOT NULL"),
]


def _ensure_columns() -> None:
    insp = inspect(engine)
    existing_tables = set(insp.get_table_names())
    with engine.begin() as conn:
        for table, column, ddl in _COLUMN_MIGRATIONS:
            if table not in existing_tables:
                continue
            cols = {c["name"] for c in insp.get_columns(table)}
            if column not in cols:
                conn.execute(text(f'ALTER TABLE {table} ADD COLUMN {column} {ddl}'))


def create_db_and_tables() -> None:
    SQLModel.metadata.create_all(engine)
    _ensure_columns()


def get_session():
    # expire_on_commit=False: um request pode commitar mais de uma vez (ex.: gravar
    # o log de auditoria após a operação principal). Sem isso, o 2º commit expira os
    # objetos ORM já carregados e a serialização da resposta falha.
    with Session(engine, expire_on_commit=False) as session:
        yield session
