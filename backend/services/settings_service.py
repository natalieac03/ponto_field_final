from sqlmodel import Session, select
from models import Settings
from schemas import AdminPasswordUpdate, SettingsRead, SettingsUpdate
from services.auth_service import hash_pin


def _to_read(s: Settings) -> SettingsRead:
    return SettingsRead(
        id=s.id,
        std_minutes=s.std_minutes,
        has_admin_password=s.admin_pin_hash is not None,
    )


def _get_or_create(session: Session) -> Settings:
    s = session.exec(select(Settings)).first()
    if not s:
        s = Settings(std_minutes=480)
        session.add(s)
        session.commit()
        session.refresh(s)
    return s


def get(session: Session) -> SettingsRead:
    return _to_read(_get_or_create(session))


def update(session: Session, data: SettingsUpdate) -> SettingsRead:
    s = _get_or_create(session)
    s.std_minutes = data.std_minutes
    session.add(s)
    session.commit()
    session.refresh(s)
    return _to_read(s)


def update_admin_password(session: Session, data: AdminPasswordUpdate) -> SettingsRead:
    s = _get_or_create(session)
    s.admin_pin_hash = hash_pin(data.password)
    session.add(s)
    session.commit()
    session.refresh(s)
    return _to_read(s)
