"""Caso de uso da trilha de auditoria (log de atividades).

O `log(...)` é chamado pela camada de apresentação após cada ação que altera
dados — mantém o domínio puro e captura o autor a partir da identidade do token.
"""
from datetime import date as date_cls, datetime, timedelta

from app.application import identity as idt
from app.application.dtos import ActivityLogRead
from app.application.ports import ActivityLogRepository
from app.domain.models import ActivityLog


def log(logs: ActivityLogRepository, actor: dict, *, action: str, description: str,
        entity_type: str, entity_id: int | None = None,
        employee_id: int | None = None) -> None:
    """Grava uma entrada de auditoria. Nunca deixa um erro de log quebrar a ação."""
    is_admin = idt.is_admin(actor)
    actor_id = None if is_admin else actor.get("sub")
    actor_name = actor.get("name") or ("Administrador" if is_admin else f"#{actor_id}")
    try:
        logs.add(ActivityLog(
            created_at=datetime.now().isoformat(timespec="seconds"),
            actor_type="admin" if is_admin else "employee",
            actor_id=actor_id if isinstance(actor_id, int) else None,
            actor_name=str(actor_name),
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            employee_id=employee_id,
            description=description[:300],
        ))
    except Exception:  # noqa: BLE001 — auditoria é best-effort, não bloqueia a operação
        pass


def _to_read(row: ActivityLog) -> ActivityLogRead:
    return ActivityLogRead.model_validate(row)


def list_recent(logs: ActivityLogRepository, days: int = 90) -> list[ActivityLogRead]:
    since = (datetime.now() - timedelta(days=days)).isoformat(timespec="seconds")
    return [_to_read(r) for r in logs.list_since(since)]


def list_for_employee_month(logs: ActivityLogRepository, employee_id: int,
                            year: int, month: int) -> list[ActivityLogRead]:
    since = f"{year:04d}-{month:02d}-01T00:00:00"
    nxt = date_cls(year + (month == 12), (month % 12) + 1, 1)
    until = f"{nxt.isoformat()}T00:00:00"
    return [_to_read(r) for r in logs.list_for_employee(employee_id, since, until)]
