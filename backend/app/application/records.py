"""Casos de uso de registros de ponto. Orquestram domínio + repositórios."""
from datetime import date as date_cls, datetime
from pathlib import Path

from app.application import identity as idt
from app.application.dtos import (
    RecordCreate, RecordPatchBreak, RecordPatchExit, RecordPatchNote,
    RecordPatchTimes, RecordRequestEdit, RecordReview,
)
from app.application.employees import schedule_tuple
from app.application.errors import ConflictError, ForbiddenError, NotFoundError, ValidationError
from app.application.ports import (
    AttachmentStorage, EmployeeRepository, RecordRepository, SettingsRepository,
)
from app.domain import accounting
from app.domain.models import DailyRecord
from app.domain.time_utils import calc_break_minutes

MAX_ATTACHMENTS = 2
MAX_FILE_SIZE = 5 * 1024 * 1024
ALLOWED_EXTS = {".png", ".jpg", ".jpeg", ".gif", ".pdf", ".webp", ".heic"}


def _ensure_owner(record: DailyRecord, identity: dict | None) -> None:
    if identity is None:
        return
    if idt.is_admin(identity) or idt.owns(identity, record.employee_id):
        return
    raise ForbiddenError("Você só pode alterar os seus próprios registros.")


def backfill_missing_calculations(session) -> int:
    """Recalcula registros vindos de versões antigas (effective_minutes NULL
    mas já fechados). Roda no startup; idempotente e barato."""
    from sqlmodel import select
    from app.domain.models import Employee, Settings

    st = session.exec(select(Settings)).first()
    h1 = st.h1_minutes if st else 480
    h2 = st.h2_minutes if st else 240
    emps = {e.id: e for e in session.exec(select(Employee)).all()}

    rows = session.exec(select(DailyRecord).where(
        DailyRecord.effective_minutes == None,  # noqa: E711
    )).all()
    fixed = 0
    for rec in rows:
        if not (rec.exit_time or rec.abono_code):
            continue
        emp = emps.get(rec.employee_id)
        schedule = schedule_tuple(emp) if emp else None
        _recalc(rec, h1, h2, schedule)
        if not rec.status:
            rec.status = "aprovado"
        session.add(rec)
        fixed += 1
    if fixed:
        session.commit()
    return fixed


def _recalc(record: DailyRecord, h1: int, h2: int, schedule: tuple | None = None) -> None:
    """Recalcula tudo pelo modelo banco de horas (tipo de dia + abono + jornada).

    Um dia "fecha" quando tem saída OU abono. Só entrada aberta → calculados None.
    `schedule` é a jornada personalizada do colaborador (7-tupla seg..dom | None).
    """
    record.day_type = accounting.day_type(record.date)
    closed = bool(record.exit_time) or bool(record.abono_code)
    override = accounting.weekday_reference_override(schedule, record.date)

    if not closed:
        record.standard_minutes = accounting.employee_reference(
            record.employee_id, record.date, None, h1, h2, override,
            on_leave=accounting.is_on_leave(record.employee_id, record.date))
        record.break_minutes = None
        record.worked_minutes = None
        record.effective_minutes = None
        record.overtime_minutes = None
        record.normal_minutes = None
        record.shortfall_minutes = None
        record.extra50_minutes = None
        record.extra100_minutes = None
        record.night_minutes = None
        record.night_bonus_minutes = None
        record.over_limit = False
        return

    res = accounting.compute_day(
        record.date, record.entry_time, record.break_start, record.break_end,
        record.exit_time, abono=record.abono_code, h1=h1, h2=h2, schedule=schedule,
        on_leave=accounting.is_on_leave(record.employee_id, record.date),
        employee_id=record.employee_id,
    )
    record.standard_minutes    = res.reference
    record.break_minutes       = calc_break_minutes(record.break_start, record.break_end)
    record.worked_minutes      = res.worked
    record.effective_minutes   = res.effective
    record.overtime_minutes    = res.balance
    record.normal_minutes      = res.normal
    record.shortfall_minutes   = res.shortfall
    record.extra50_minutes     = res.extra50
    record.extra100_minutes    = res.extra100
    record.night_minutes       = res.night
    record.night_bonus_minutes = res.night_bonus
    record.over_limit          = res.over_limit


def get_all(records: RecordRepository) -> list[DailyRecord]:
    return records.list_all()


def get_by_employee(records: RecordRepository, employee_id: int) -> list[DailyRecord]:
    return records.list_by_employee(employee_id)


def list_pending(records: RecordRepository) -> list[DailyRecord]:
    """Fila do gestor: lançamentos pendentes + pedidos de exclusão do colaborador."""
    pend = records.list_by_status("pendente")
    seen = {r.id for r in pend}
    removals = [r for r in records.list_all() if r.removal_requested and r.id not in seen]
    return pend + removals


def create(records: RecordRepository, employees: EmployeeRepository,
           settings: SettingsRepository, data: RecordCreate) -> DailyRecord:
    emp = employees.get(data.employee_id)
    if not emp:
        raise NotFoundError("Colaborador não encontrado.")
    if records.get_for_day(data.employee_id, data.date):
        raise ConflictError("Já existe registro para este colaborador nesta data.")

    h1, h2 = settings.journey_params()
    is_retro = data.date < date_cls.today().isoformat()

    record = DailyRecord(
        employee_id=data.employee_id, date=data.date,
        entry_time=data.entry_time, break_start=data.break_start,
        break_end=data.break_end, exit_time=data.exit_time,
        abono_code=data.abono_code, note=data.note,
        is_retroactive=is_retro, status="pendente" if is_retro else "aprovado",
    )
    _recalc(record, h1, h2, schedule_tuple(emp))
    return records.add(record)


def register_break(records: RecordRepository, employees: EmployeeRepository,
                   settings: SettingsRepository, record_id: int, data: RecordPatchBreak,
                   identity: dict | None = None) -> DailyRecord:
    record = records.get(record_id)
    if not record:
        raise NotFoundError("Registro não encontrado.")
    _ensure_owner(record, identity)
    if record.exit_time:
        raise ConflictError("Registro já encerrado.")

    if data.break_start is not None:
        record.break_start = data.break_start
    if data.break_end is not None:
        record.break_end = data.break_end

    h1, h2 = settings.journey_params()
    _recalc(record, h1, h2, schedule_tuple(employees.get(record.employee_id)))
    return records.update(record)


def register_exit(records: RecordRepository, employees: EmployeeRepository,
                  settings: SettingsRepository, record_id: int, data: RecordPatchExit,
                  identity: dict | None = None) -> DailyRecord:
    record = records.get(record_id)
    if not record:
        raise NotFoundError("Registro não encontrado.")
    _ensure_owner(record, identity)
    if record.exit_time:
        raise ConflictError("Saída já registrada.")

    record.exit_time = data.exit_time
    if data.note is not None:
        record.note = data.note

    h1, h2 = settings.journey_params()
    _recalc(record, h1, h2, schedule_tuple(employees.get(record.employee_id)))
    return records.update(record)


def edit_times(records: RecordRepository, employees: EmployeeRepository,
               settings: SettingsRepository, record_id: int, data: RecordPatchTimes) -> DailyRecord:
    record = records.get(record_id)
    if not record:
        raise NotFoundError("Registro não encontrado.")

    if data.entry_time is not None:
        if data.entry_time == "":
            raise ValidationError("Horário de entrada é obrigatório.")
        record.entry_time = data.entry_time

    for field in ("break_start", "break_end", "exit_time"):
        value = getattr(data, field)
        if value is not None:
            setattr(record, field, value if value else None)

    if record.break_end and not record.break_start:
        raise ValidationError("Fim do intervalo exige início.")

    if data.abono_code is not None:
        record.abono_code = data.abono_code or None

    h1, h2 = settings.journey_params()
    _recalc(record, h1, h2, schedule_tuple(employees.get(record.employee_id)))
    return records.update(record)


def patch_note(records: RecordRepository, record_id: int,
               data: RecordPatchNote, identity: dict | None = None) -> DailyRecord:
    record = records.get(record_id)
    if not record:
        raise NotFoundError("Registro não encontrado.")
    _ensure_owner(record, identity)
    record.note = data.note
    return records.update(record)


def request_edit(records: RecordRepository, employees: EmployeeRepository,
                 settings: SettingsRepository, record_id: int, data: RecordRequestEdit,
                 identity: dict) -> DailyRecord:
    """Colaborador (ou admin) altera o próprio registro → volta para 'pendente'."""
    record = records.get(record_id)
    if not record:
        raise NotFoundError("Registro não encontrado.")
    _ensure_owner(record, identity)

    if data.entry_time is not None:
        record.entry_time = data.entry_time or None
    for field in ("break_start", "break_end", "exit_time"):
        value = getattr(data, field)
        if value is not None:
            setattr(record, field, value or None)
    if data.abono_code is not None:
        record.abono_code = data.abono_code or None
    if data.note is not None:
        record.note = data.note or None

    if not record.entry_time and not record.abono_code:
        raise ValidationError("Informe o horário de entrada ou um abono para o dia.")
    if record.break_end and not record.break_start:
        raise ValidationError("Fim do intervalo exige início.")

    record.status = "pendente"
    record.removal_requested = False
    record.reviewed_by = None
    record.reviewed_at = None
    record.review_note = None

    h1, h2 = settings.journey_params()
    _recalc(record, h1, h2, schedule_tuple(employees.get(record.employee_id)))
    return records.update(record)


def request_removal(records: RecordRepository, record_id: int, identity: dict) -> DailyRecord:
    """Colaborador (ou admin) pede exclusão do próprio registro → fila do gestor."""
    record = records.get(record_id)
    if not record:
        raise NotFoundError("Registro não encontrado.")
    _ensure_owner(record, identity)
    record.removal_requested = True
    return records.update(record)


def review(records: RecordRepository, storage: AttachmentStorage, record_id: int,
           data: RecordReview, reviewer: dict) -> DailyRecord:
    """Gestor decide sobre um item da fila.

    Pedido de exclusão: aprovar apaga o registro; reprovar limpa a solicitação.
    Lançamento/edição pendente: aprovar → aprovado; reprovar → reprovado.
    Retorna o registro (destacado da sessão quando apagado — ainda mapeável).
    """
    record = records.get(record_id)
    if not record:
        raise NotFoundError("Registro não encontrado.")

    now = datetime.now().isoformat(timespec="seconds")
    reviewer_name = reviewer.get("name") or str(reviewer.get("sub", "admin"))

    if record.removal_requested:
        if data.action == "approve":
            for fname in _attachments_list(record):
                storage.delete(fname)
            records.delete(record)
            return record  # objeto ainda em memória → mapeável para resposta
        record.removal_requested = False
        record.reviewed_by = reviewer_name
        record.reviewed_at = now
        record.review_note = data.note
        return records.update(record)

    record.status = "aprovado" if data.action == "approve" else "reprovado"
    record.reviewed_by = reviewer_name
    record.reviewed_at = now
    record.review_note = data.note
    return records.update(record)


def add_attachment(records: RecordRepository, storage: AttachmentStorage,
                   record_id: int, filename: str, content: bytes,
                   identity: dict | None = None) -> DailyRecord:
    record = records.get(record_id)
    if not record:
        raise NotFoundError("Registro não encontrado.")
    _ensure_owner(record, identity)

    existing = _attachments_list(record)
    if len(existing) >= MAX_ATTACHMENTS:
        raise ValidationError(f"Limite de {MAX_ATTACHMENTS} anexos atingido.")

    ext = Path(filename or "arquivo").suffix.lower()
    if ext not in ALLOWED_EXTS:
        raise ValidationError(f"Tipo de arquivo não permitido. Use: {', '.join(sorted(ALLOWED_EXTS))}.")
    if len(content) > MAX_FILE_SIZE:
        raise ValidationError("Arquivo muito grande (máx. 5 MB).")
    if len(content) == 0:
        raise ValidationError("Arquivo vazio.")

    stored = storage.save(record_id, filename, content)
    existing.append(stored)
    _attachments_save(record, existing)
    return records.update(record)


def remove_attachment(records: RecordRepository, storage: AttachmentStorage,
                      record_id: int, filename: str, identity: dict | None = None) -> DailyRecord:
    record = records.get(record_id)
    if not record:
        raise NotFoundError("Registro não encontrado.")
    _ensure_owner(record, identity)
    existing = _attachments_list(record)
    if filename not in existing:
        raise NotFoundError("Anexo não encontrado.")
    storage.delete(filename)
    existing.remove(filename)
    _attachments_save(record, existing)
    return records.update(record)


def delete(records: RecordRepository, storage: AttachmentStorage, record_id: int) -> None:
    record = records.get(record_id)
    if not record:
        raise NotFoundError("Registro não encontrado.")
    for fname in _attachments_list(record):
        storage.delete(fname)
    records.delete(record)


# ── helpers de anexos (JSON string ↔ list) ───────────────────────────────────
import json  # noqa: E402


def _attachments_list(record: DailyRecord) -> list[str]:
    if not record.attachments:
        return []
    try:
        data = json.loads(record.attachments)
        return data if isinstance(data, list) else []
    except json.JSONDecodeError:
        return []


def _attachments_save(record: DailyRecord, files: list[str]) -> None:
    record.attachments = json.dumps(files) if files else None
