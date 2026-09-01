import sys
from dataclasses import dataclass
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest

from app.domain import accounting


@pytest.fixture(autouse=True)
def reset_domain_globals():
    """Cada teste parte de escalas/férias/calendário limpos (globais do módulo)."""
    accounting.set_shifts({})
    accounting.set_leaves({})
    accounting.set_calendar(set(), {})
    yield
    accounting.set_shifts({})
    accounting.set_leaves({})
    accounting.set_calendar(set(), {})


@dataclass
class Rec:
    """Implementa RecordLike (backend/app/domain/banking.py) p/ testes."""
    date: str
    entry_time: str | None = None
    break_start: str | None = None
    break_end: str | None = None
    exit_time: str | None = None
    abono_code: str | None = None
    status: str = "aprovado"
    day_type: str | None = None
    overtime_minutes: int | None = 0   # não-None => is_closed()
    effective_minutes: int | None = 0
    normal_minutes: int | None = 0
    shortfall_minutes: int | None = 0
    extra50_minutes: int | None = 0
    extra100_minutes: int | None = 0
    night_bonus_minutes: int | None = 0
    over_limit: bool = False


@pytest.fixture
def make_rec():
    return Rec
