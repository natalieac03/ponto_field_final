"""Casos de uso de colaboradores."""
from pathlib import Path

from app.application.dtos import (
    EmployeeCreate, EmployeePasswordChange, EmployeePasswordSet, EmployeeProfileUpdate,
    EmployeePublicRead, EmployeeRead, WeeklySchedule,
)
from app.application.errors import ConflictError, NotFoundError, UnauthorizedError, ValidationError
from app.application.passwords import hash_password, verify_password
from app.application import cpf as cpf_utils
from app.application.ports import AttachmentStorage, EmployeeRepository
from app.domain.models import Employee

MAX_EMPLOYEES = 10
WEEKDAY_FIELDS = ("mon_minutes", "tue_minutes", "wed_minutes", "thu_minutes",
                  "fri_minutes", "sat_minutes", "sun_minutes")
PROFILE_FIELDS = ("role", "hire_date", "department", "registration", "email", "phone", "contract_type")

# Foto de perfil (avatar)
PHOTO_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".heic"}
PHOTO_MAX_BYTES = 5 * 1024 * 1024


def _looks_like_image(content: bytes) -> bool:
    """Confere a assinatura real do arquivo (evita executável renomeado p/ .png)."""
    if len(content) < 12:
        return False
    if content.startswith(b"\x89PNG\r\n\x1a\n"):        # PNG
        return True
    if content.startswith(b"\xff\xd8\xff"):              # JPEG
        return True
    if content[:6] in (b"GIF87a", b"GIF89a"):            # GIF
        return True
    if content[:4] == b"RIFF" and content[8:12] == b"WEBP":  # WEBP
        return True
    if content[4:8] == b"ftyp":                          # HEIC/HEIF (container ISO-BMFF)
        return True
    return False


def schedule_tuple(emp) -> tuple | None:
    """7-tupla (seg..dom) da jornada personalizada, ou None se o colaborador não
    tiver nenhuma sobreposição definida (usa o padrão global)."""
    if emp is None:
        return None
    sched = tuple(getattr(emp, f, None) for f in WEEKDAY_FIELDS)
    return sched if any(v is not None for v in sched) else None


def to_read(emp: Employee) -> EmployeeRead:
    return EmployeeRead(
        id=emp.id, name=emp.name, has_password=emp.pin_hash is not None, photo=emp.photo,
        cpf_masked=cpf_utils.mask(emp.cpf), has_cpf=bool(emp.cpf),
        is_admin=bool(emp.is_admin),
        active=bool(getattr(emp, "active", True)),
        termination_date=getattr(emp, "termination_date", None),
        role=emp.role, hire_date=emp.hire_date, department=emp.department,
        registration=emp.registration, email=emp.email, phone=emp.phone,
        contract_type=emp.contract_type,
        mon_minutes=emp.mon_minutes, tue_minutes=emp.tue_minutes, wed_minutes=emp.wed_minutes,
        thu_minutes=emp.thu_minutes, fri_minutes=emp.fri_minutes, sat_minutes=emp.sat_minutes,
        sun_minutes=emp.sun_minutes,
    )


def get_all(employees: EmployeeRepository) -> list[EmployeeRead]:
    return [to_read(e) for e in employees.list_all()]


def get_one(employees: EmployeeRepository, employee_id: int) -> EmployeeRead:
    return to_read(_require(employees, employee_id))


def get_all_public(employees: EmployeeRepository) -> list[EmployeePublicRead]:
    """Lista mínima p/ a landing (id, nome, tem senha). Sem dados sensíveis."""
    return [
        EmployeePublicRead(id=e.id, name=e.name, has_password=e.pin_hash is not None)
        for e in employees.list_all()
        if getattr(e, "active", True)      # desligado não aparece no login
    ]


def _apply_cpf(employees: EmployeeRepository, emp: Employee, raw: str | None) -> None:
    """cpf None = não mexe; "" = limpa; senão valida dígitos e unicidade."""
    if raw is None:
        return
    if raw.strip() == "":
        emp.cpf = None
        return
    digits = cpf_utils.normalize(raw)
    if digits is None or not cpf_utils.is_valid(digits):
        raise ValidationError("CPF inválido.")
    for other in employees.list_all():
        if other.cpf == digits and other.id != emp.id:
            raise ConflictError("Este CPF já está cadastrado.")
    emp.cpf = digits


def _valid_date(raw: str | None, label: str) -> str | None:
    """"" → None; senão valida ISO."""
    if raw is None or raw.strip() == "":
        return None
    from datetime import date as _d
    try:
        _d.fromisoformat(raw.strip())
    except ValueError:
        raise ValidationError(f"{label} inválida (use AAAA-MM-DD).")
    return raw.strip()


def deactivate(employees: EmployeeRepository, employee_id: int,
               termination_date: str | None) -> EmployeeRead:
    """Inativa o colaborador: sai do login e dos relatórios ativos, mas os
    registros ficam no banco e ele pode ser reativado."""
    from datetime import date as _d
    emp = _require(employees, employee_id)
    emp.active = False
    emp.termination_date = _valid_date(termination_date, "Data de desligamento") or _d.today().isoformat()
    emp.is_admin = False          # desligado perde acesso ao painel
    employees.update(emp)
    return to_read(emp)


def reactivate(employees: EmployeeRepository, employee_id: int) -> EmployeeRead:
    emp = _require(employees, employee_id)
    emp.active = True
    emp.termination_date = None
    employees.update(emp)
    return to_read(emp)


def _require(employees: EmployeeRepository, employee_id: int) -> Employee:
    emp = employees.get(employee_id)
    if not emp:
        raise NotFoundError("Colaborador não encontrado.")
    return emp


def create(employees: EmployeeRepository, data: EmployeeCreate) -> EmployeeRead:
    if employees.count() >= MAX_EMPLOYEES:
        raise ValidationError("Limite de 10 colaboradores atingido.")
    if employees.find_by_name(data.name.strip().lower()):
        raise ConflictError("Colaborador já cadastrado.")
    emp = Employee(name=data.name.strip(), pin_hash=hash_password(data.pin) if data.pin else None)
    for field in PROFILE_FIELDS:
        setattr(emp, field, getattr(data, field))
    _apply_cpf(employees, emp, data.cpf)
    return to_read(employees.add(emp))


def update_profile(employees: EmployeeRepository, employee_id: int,
                   data: EmployeeProfileUpdate) -> EmployeeRead:
    """Atualiza os dados de RH do colaborador (gerido pelo gestor)."""
    emp = _require(employees, employee_id)
    for field in PROFILE_FIELDS:
        setattr(emp, field, getattr(data, field))
    _apply_cpf(employees, emp, data.cpf)
    if data.termination_date is not None:
        emp.termination_date = _valid_date(data.termination_date, "Data de desligamento")
    if data.is_admin is not None:
        if data.is_admin and not getattr(emp, "active", True):
            raise ValidationError("Colaborador desligado não pode ter acesso de admin.")
        if data.is_admin and not emp.pin_hash:
            raise ValidationError(
                "O colaborador precisa definir a senha no 1º acesso antes de virar admin.")
        emp.is_admin = data.is_admin
    return to_read(employees.update(emp))


def rename(employees: EmployeeRepository, employee_id: int, new_name: str) -> EmployeeRead:
    emp = _require(employees, employee_id)
    other = employees.find_by_name(new_name.lower())
    if other and other.id != employee_id:
        raise ConflictError("Já existe um colaborador com esse nome.")
    emp.name = new_name
    return to_read(employees.update(emp))


def set_password_first_time(employees: EmployeeRepository, employee_id: int,
                            data: EmployeePasswordSet) -> EmployeeRead:
    emp = _require(employees, employee_id)
    if emp.pin_hash is not None:
        raise ConflictError("Colaborador já possui senha. Use 'alterar senha'.")
    emp.pin_hash = hash_password(data.password)
    return to_read(employees.update(emp))


def change_password(employees: EmployeeRepository, employee_id: int,
                    data: EmployeePasswordChange) -> EmployeeRead:
    emp = _require(employees, employee_id)
    if not emp.pin_hash:
        raise ValidationError("Colaborador ainda não definiu uma senha.")
    if not verify_password(data.current_password, emp.pin_hash):
        raise UnauthorizedError("Senha atual incorreta.")
    emp.pin_hash = hash_password(data.new_password)
    return to_read(employees.update(emp))


def update_schedule(employees: EmployeeRepository, employee_id: int,
                    data: WeeklySchedule) -> EmployeeRead:
    emp = _require(employees, employee_id)
    for field in WEEKDAY_FIELDS:
        setattr(emp, field, getattr(data, field))
    return to_read(employees.update(emp))


def set_photo(employees: EmployeeRepository, storage: AttachmentStorage,
              employee_id: int, filename: str, content: bytes) -> EmployeeRead:
    emp = _require(employees, employee_id)
    ext = Path(filename or "").suffix.lower()
    if ext not in PHOTO_EXTS:
        raise ValidationError("Formato inválido. Envie uma imagem (png, jpg, webp, gif ou heic).")
    if not content:
        raise ValidationError("Arquivo vazio.")
    if len(content) > PHOTO_MAX_BYTES:
        raise ValidationError("Imagem muito grande (máx. 5 MB).")
    if not _looks_like_image(content):
        raise ValidationError("O arquivo não é uma imagem válida.")
    old = emp.photo
    stored = storage.save(employee_id, filename, content)
    emp.photo = stored
    result = to_read(employees.update(emp))
    if old:
        storage.delete(old)  # remove a foto antiga só depois de trocar com sucesso
    return result


def remove_photo(employees: EmployeeRepository, storage: AttachmentStorage,
                 employee_id: int) -> EmployeeRead:
    emp = _require(employees, employee_id)
    old = emp.photo
    emp.photo = None
    result = to_read(employees.update(emp))
    if old:
        storage.delete(old)
    return result


def delete(employees: EmployeeRepository, storage: AttachmentStorage, employee_id: int) -> None:
    emp = employees.get(employee_id)
    if not emp:
        raise NotFoundError("Colaborador não encontrado.")
    photo = emp.photo
    employees.delete(emp)  # repo cuida dos registros associados
    if photo:
        storage.delete(photo)
