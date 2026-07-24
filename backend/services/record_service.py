import json
import os
import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile
from sqlmodel import Session, select

from models import DailyRecord, Employee
from schemas import (
    RecordCreate, RecordPatchBreak, RecordPatchExit,
    RecordPatchNote, RecordPatchTimes,
)
from services.employee_service import get_standard_minutes_for_date
from services.workweek import daily_expected
from services.time_utils import calc_break_minutes, calc_worked_minutes, calc_overtime


UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "./uploads"))
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

MAX_ATTACHMENTS = 2
MAX_FILE_SIZE = 5 * 1024 * 1024
ALLOWED_EXTS = {".png", ".jpg", ".jpeg", ".gif", ".pdf", ".webp", ".heic"}


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


def _read(session: Session, record: DailyRecord) -> dict:
    """Serializa o registro aplicando a regra semanal na exibição."""
    emp = session.get(Employee, record.employee_id)
    return _to_read_dict(record, emp)


def _to_read_dict(record: DailyRecord, emp: Employee | None = None) -> dict:
    # Regra SEMANAL aplicada só na exibição — o banco fica intocado
    # Regra SEMANAL: sem saldo por dia (fechamento é semanal). Banco intocado.
    std = daily_expected(emp, record.date)
    ot = None
    return {
        "id": record.id,
        "employee_id": record.employee_id,
        "date": record.date,
        "entry_time": record.entry_time,
        "break_start": record.break_start,
        "break_end": record.break_end,
        "exit_time": record.exit_time,
        "standard_minutes": std,
        "break_minutes": record.break_minutes,
        "worked_minutes": record.worked_minutes,
        "overtime_minutes": ot,
        "note": record.note,
        "attachments": _attachments_list(record),
    }


def _recalc_totals(record: DailyRecord) -> None:
    """Recalcula break/worked/overtime baseado nos horários atuais. Se não há saída, zera os calculados."""
    if record.exit_time:
        brk = calc_break_minutes(record.break_start, record.break_end)
        worked = calc_worked_minutes(record.entry_time, record.exit_time, brk)
        record.break_minutes = brk
        record.worked_minutes = worked
        record.overtime_minutes = calc_overtime(worked, record.standard_minutes)
    else:
        record.break_minutes = None
        record.worked_minutes = None
        record.overtime_minutes = None


def get_all(session: Session) -> list[dict]:
    records = list(session.exec(select(DailyRecord).order_by(DailyRecord.date.desc())).all())
    emps = {e.id: e for e in session.exec(select(Employee)).all()}
    return [_to_read_dict(r, emps.get(r.employee_id)) for r in records]


def get_by_employee(session: Session, employee_id: int) -> list[dict]:
    records = list(
        session.exec(
            select(DailyRecord)
            .where(DailyRecord.employee_id == employee_id)
            .order_by(DailyRecord.date.desc())
        ).all()
    )
    emp = session.get(Employee, employee_id)
    return [_to_read_dict(r, emp) for r in records]


def create(session: Session, data: RecordCreate) -> dict:
    emp = session.get(Employee, data.employee_id)
    if not emp:
        raise HTTPException(status_code=404, detail="Colaborador não encontrado.")

    dup = session.exec(
        select(DailyRecord)
        .where(DailyRecord.employee_id == data.employee_id)
        .where(DailyRecord.date == data.date)
    ).first()
    if dup:
        raise HTTPException(status_code=409, detail="Já existe registro para este colaborador nesta data.")

    # Jornada do dia: prioriza schedule personalizada, fallback p/ data.standard_minutes (global)
    std = get_standard_minutes_for_date(emp, data.date, data.standard_minutes)

    record = DailyRecord(
        employee_id=data.employee_id,
        date=data.date,
        entry_time=data.entry_time,
        standard_minutes=std,
        note=data.note,
    )
    session.add(record)
    session.commit()
    session.refresh(record)
    return _read(session, record)


def patch_break(session: Session, record_id: int, data: RecordPatchBreak) -> dict:
    record = session.get(DailyRecord, record_id)
    if not record:
        raise HTTPException(status_code=404, detail="Registro não encontrado.")
    if record.exit_time:
        raise HTTPException(status_code=409, detail="Registro já encerrado.")

    if data.break_start is not None:
        record.break_start = data.break_start
    if data.break_end is not None:
        record.break_end = data.break_end

    session.add(record)
    session.commit()
    session.refresh(record)
    return _read(session, record)


def patch_exit(session: Session, record_id: int, data: RecordPatchExit) -> dict:
    record = session.get(DailyRecord, record_id)
    if not record:
        raise HTTPException(status_code=404, detail="Registro não encontrado.")
    if record.exit_time:
        raise HTTPException(status_code=409, detail="Saída já registrada.")

    std = data.standard_minutes if data.standard_minutes is not None else record.standard_minutes
    record.exit_time = data.exit_time
    record.standard_minutes = std
    if data.note is not None:
        record.note = data.note

    _recalc_totals(record)
    session.add(record)
    session.commit()
    session.refresh(record)
    return _read(session, record)


def patch_times(session: Session, record_id: int, data: RecordPatchTimes) -> dict:
    """Admin edita os horários de um registro. Recalcula tudo.
    Campo == "" significa LIMPAR o campo (exceto entry_time, que é obrigatório)."""
    record = session.get(DailyRecord, record_id)
    if not record:
        raise HTTPException(status_code=404, detail="Registro não encontrado.")

    # entry_time é obrigatório — se vier vazio rejeita
    if data.entry_time is not None:
        if data.entry_time == "":
            raise HTTPException(status_code=400, detail="Horário de entrada é obrigatório.")
        record.entry_time = data.entry_time

    # Os outros aceitam string vazia como "limpar"
    for field in ("break_start", "break_end", "exit_time"):
        value = getattr(data, field)
        if value is not None:
            setattr(record, field, value if value else None)

    # Validações de coerência mínimas: se break_end existe, break_start tb precisa
    if record.break_end and not record.break_start:
        raise HTTPException(status_code=400, detail="Fim do intervalo exige início.")

    # Jornada do dia editável (afeta o saldo)
    if data.standard_minutes is not None:
        record.standard_minutes = data.standard_minutes

    _recalc_totals(record)
    session.add(record)
    session.commit()
    session.refresh(record)
    return _read(session, record)


def patch_note(session: Session, record_id: int, data: RecordPatchNote) -> dict:
    record = session.get(DailyRecord, record_id)
    if not record:
        raise HTTPException(status_code=404, detail="Registro não encontrado.")
    record.note = data.note
    session.add(record)
    session.commit()
    session.refresh(record)
    return _read(session, record)


async def add_attachment(session: Session, record_id: int, upload: UploadFile) -> dict:
    record = session.get(DailyRecord, record_id)
    if not record:
        raise HTTPException(status_code=404, detail="Registro não encontrado.")

    existing = _attachments_list(record)
    if len(existing) >= MAX_ATTACHMENTS:
        raise HTTPException(status_code=400, detail=f"Limite de {MAX_ATTACHMENTS} anexos atingido.")

    filename = upload.filename or "arquivo"
    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED_EXTS:
        raise HTTPException(status_code=400, detail=f"Tipo de arquivo não permitido. Use: {', '.join(sorted(ALLOWED_EXTS))}.")

    content = await upload.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="Arquivo muito grande (máx. 5 MB).")
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Arquivo vazio.")

    stored_name = f"{record_id}_{uuid.uuid4().hex[:10]}{ext}"
    dest = UPLOAD_DIR / stored_name
    dest.write_bytes(content)

    existing.append(stored_name)
    _attachments_save(record, existing)
    session.add(record)
    session.commit()
    session.refresh(record)
    return _read(session, record)


def remove_attachment(session: Session, record_id: int, filename: str) -> dict:
    record = session.get(DailyRecord, record_id)
    if not record:
        raise HTTPException(status_code=404, detail="Registro não encontrado.")
    existing = _attachments_list(record)
    if filename not in existing:
        raise HTTPException(status_code=404, detail="Anexo não encontrado.")
    try:
        (UPLOAD_DIR / filename).unlink(missing_ok=True)
    except Exception:
        pass
    existing.remove(filename)
    _attachments_save(record, existing)
    session.add(record)
    session.commit()
    session.refresh(record)
    return _read(session, record)


def get_attachment_path(filename: str) -> Path:
    if "/" in filename or "\\" in filename or ".." in filename:
        raise HTTPException(status_code=400, detail="Nome de arquivo inválido.")
    path = UPLOAD_DIR / filename
    if not path.exists() or not path.is_file():
        raise HTTPException(status_code=404, detail="Anexo não encontrado.")
    return path


def delete(session: Session, record_id: int) -> None:
    record = session.get(DailyRecord, record_id)
    if not record:
        raise HTTPException(status_code=404, detail="Registro não encontrado.")
    for fname in _attachments_list(record):
        try:
            (UPLOAD_DIR / fname).unlink(missing_ok=True)
        except Exception:
            pass
    session.delete(record)
    session.commit()
