"""Casos de uso de configurações."""
from app.application.dtos import AdminPasswordUpdate, SettingsRead, SettingsUpdate
from app.application.passwords import hash_pin
from app.application.ports import SettingsRepository
from app.domain.models import Settings


def to_read(s: Settings) -> SettingsRead:
    return SettingsRead(
        id=s.id, std_minutes=s.std_minutes, h1_minutes=s.h1_minutes,
        h2_minutes=s.h2_minutes, has_admin_password=s.admin_pin_hash is not None,
        company_cnpj=s.company_cnpj, company_name=s.company_name,
        company_address=s.company_address, rep_number=s.rep_number,
    )


def get(settings: SettingsRepository) -> SettingsRead:
    return to_read(settings.get_or_create())


def update(settings: SettingsRepository, data: SettingsUpdate) -> SettingsRead:
    s = settings.get_or_create()
    if data.h1_minutes is not None:
        s.h1_minutes = data.h1_minutes
    if data.h2_minutes is not None:
        s.h2_minutes = data.h2_minutes
    # std_minutes é herança do modelo antigo — o motor usa h1/h2 (journey_params).
    # Mantém em sincronia com a jornada de dia útil (h1) para compatibilidade.
    s.std_minutes = s.h1_minutes
    # Campos do empregador (usados só no AFD) — parciais, como h1/h2: None
    # significa "não veio neste PUT", não "limpar o campo" (ex.: o card de
    # Jornada salva só h1/h2 e não deve apagar o cadastro da empresa).
    if data.company_cnpj is not None:
        s.company_cnpj = data.company_cnpj
    if data.company_name is not None:
        s.company_name = data.company_name
    if data.company_address is not None:
        s.company_address = data.company_address
    if data.rep_number is not None:
        s.rep_number = data.rep_number
    return to_read(settings.update(s))


def update_admin_password(settings: SettingsRepository, data: AdminPasswordUpdate) -> SettingsRead:
    s = settings.get_or_create()
    s.admin_pin_hash = hash_pin(data.password)
    return to_read(settings.update(s))
