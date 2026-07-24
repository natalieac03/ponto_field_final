from fastapi import APIRouter, Depends
from sqlmodel import Session
from database import get_session
from schemas import AdminPasswordUpdate, SettingsRead, SettingsUpdate
import services.settings_service as svc

router = APIRouter(prefix="/settings", tags=["settings"])

@router.get("", response_model=SettingsRead)
def get_settings(session: Session = Depends(get_session)):
    return svc.get(session)

@router.put("", response_model=SettingsRead)
def update_settings(data: SettingsUpdate, session: Session = Depends(get_session)):
    return svc.update(session, data)

@router.put("/admin-password", response_model=SettingsRead)
def update_admin_password(data: AdminPasswordUpdate, session: Session = Depends(get_session)):
    return svc.update_admin_password(session, data)
