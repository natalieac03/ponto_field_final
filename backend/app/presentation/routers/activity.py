from fastapi import APIRouter, Depends, Query

from app.application import activity as uc
from app.application.dtos import ActivityLogRead
from app.application.identity import ensure_self_or_admin
from app.presentation.deps import activity_repo, get_identity, require_admin

router = APIRouter(prefix="/activity", tags=["activity"])


@router.get("", response_model=list[ActivityLogRead])
def recent_activity(days: int = Query(90, ge=1, le=365),
                    logs=Depends(activity_repo), _admin: dict = Depends(require_admin)):
    """Auditoria do gestor — ações dos últimos N dias (padrão 90), mais recentes no topo."""
    return uc.list_recent(logs, days)


@router.get("/employee/{employee_id}", response_model=list[ActivityLogRead])
def employee_activity(employee_id: int,
                      year: int = Query(..., ge=2000, le=2100),
                      month: int = Query(..., ge=1, le=12),
                      logs=Depends(activity_repo), identity: dict = Depends(get_identity)):
    """Histórico do próprio colaborador no mês corrente (self-or-admin)."""
    ensure_self_or_admin(identity, employee_id)
    return uc.list_for_employee_month(logs, employee_id, year, month)
