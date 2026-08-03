from fastapi import APIRouter, Depends

from app.application import activity, settings as uc
from app.application.dtos import AdminPasswordUpdate, SettingsRead, SettingsUpdate
from app.presentation.deps import activity_repo, require_admin, settings_repo

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("", response_model=SettingsRead)
def get_settings(settings=Depends(settings_repo)):
    """Público — o app lê std/h1/h2 (nada sensível)."""
    return uc.get(settings)


@router.put("", response_model=SettingsRead)
def update_settings(data: SettingsUpdate, settings=Depends(settings_repo),
                    logs=Depends(activity_repo), admin: dict = Depends(require_admin)):
    result = uc.update(settings, data)
    activity.log(logs, admin, action="config_alterada",
                 description="Alterou os parâmetros de jornada/configuração", entity_type="settings")
    return result


@router.put("/admin-password", response_model=SettingsRead)
def update_admin_password(data: AdminPasswordUpdate, settings=Depends(settings_repo),
                          logs=Depends(activity_repo), admin: dict = Depends(require_admin)):
    result = uc.update_admin_password(settings, data)
    activity.log(logs, admin, action="senha_admin_alterada",
                 description="Alterou a senha do administrador", entity_type="settings")
    return result
