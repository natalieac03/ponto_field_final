from fastapi import APIRouter, Depends, File, UploadFile
from fastapi.responses import FileResponse

from app.application import activity, records as uc
from app.application.dtos import (
    RecordCreate, RecordPatchBreak, RecordPatchExit, RecordPatchNote,
    RecordPatchTimes, RecordRead, RecordRequestEdit, RecordReview,
)
from app.application.identity import ensure_self_or_admin
from app.domain.models import DailyRecord
from app.presentation.deps import (
    activity_repo, attachment_storage, employee_repo, get_identity, record_repo,
    require_admin, settings_repo,
)
from app.presentation.mappers import record_to_read

router = APIRouter(prefix="/records", tags=["records"])


def _dm(iso: str) -> str:
    """'2026-06-05' → '05/06' (uso em descrições de auditoria)."""
    p = iso.split("-")
    return f"{p[2]}/{p[1]}" if len(p) == 3 else iso


def _log_record(logs, actor: dict, rec: DailyRecord, action: str, desc: str) -> None:
    activity.log(logs, actor, action=action, description=desc,
                 entity_type="record", entity_id=rec.id, employee_id=rec.employee_id)


@router.get("", response_model=list[RecordRead])
def list_records(records=Depends(record_repo), _admin: dict = Depends(require_admin)):
    return [record_to_read(r) for r in uc.get_all(records)]


@router.get("/pending", response_model=list[RecordRead])
def list_pending(records=Depends(record_repo), _admin: dict = Depends(require_admin)):
    """Fila de lançamentos aguardando aprovação do gestor."""
    return [record_to_read(r) for r in uc.list_pending(records)]


@router.get("/employee/{employee_id}", response_model=list[RecordRead])
def list_by_employee(employee_id: int, records=Depends(record_repo), identity: dict = Depends(get_identity)):
    ensure_self_or_admin(identity, employee_id)
    return [record_to_read(r) for r in uc.get_by_employee(records, employee_id)]


@router.post("", response_model=RecordRead, status_code=201)
def add_record(data: RecordCreate, records=Depends(record_repo), employees=Depends(employee_repo),
               settings=Depends(settings_repo), logs=Depends(activity_repo),
               identity: dict = Depends(get_identity)):
    ensure_self_or_admin(identity, data.employee_id)
    rec = uc.create(records, employees, settings, data)
    if rec.is_retroactive:
        desc = f"Lançou dia {_dm(rec.date)} (retroativo) — aguardando aprovação"
        _log_record(logs, identity, rec, "lancamento_retroativo", desc)
    else:
        _log_record(logs, identity, rec, "ponto_entrada", f"Registrou entrada {rec.entry_time or '—'} em {_dm(rec.date)}")
    return record_to_read(rec)


@router.patch("/{record_id}/break", response_model=RecordRead)
def register_break(record_id: int, data: RecordPatchBreak, records=Depends(record_repo),
                   employees=Depends(employee_repo), settings=Depends(settings_repo),
                   logs=Depends(activity_repo), identity: dict = Depends(get_identity)):
    rec = uc.register_break(records, employees, settings, record_id, data, identity)
    _log_record(logs, identity, rec, "ponto_intervalo", f"Registrou intervalo em {_dm(rec.date)}")
    return record_to_read(rec)


@router.patch("/{record_id}/exit", response_model=RecordRead)
def register_exit(record_id: int, data: RecordPatchExit, records=Depends(record_repo),
                  employees=Depends(employee_repo), settings=Depends(settings_repo),
                  logs=Depends(activity_repo), identity: dict = Depends(get_identity)):
    rec = uc.register_exit(records, employees, settings, record_id, data, identity)
    _log_record(logs, identity, rec, "ponto_saida", f"Registrou saída {rec.exit_time or '—'} em {_dm(rec.date)}")
    return record_to_read(rec)


@router.patch("/{record_id}/review", response_model=RecordRead)
def review_record(record_id: int, data: RecordReview, records=Depends(record_repo),
                  storage=Depends(attachment_storage), logs=Depends(activity_repo),
                  admin: dict = Depends(require_admin)):
    """Gestor aprova/reprova um lançamento ou pedido de exclusão."""
    was_removal = getattr(records.get(record_id), "removal_requested", False)
    rec = uc.review(records, storage, record_id, data, admin)
    if was_removal and data.action == "approve":
        _log_record(logs, admin, rec, "exclusao_aprovada", f"Aprovou exclusão do dia {_dm(rec.date)}")
    elif was_removal:
        _log_record(logs, admin, rec, "exclusao_reprovada", f"Negou exclusão do dia {_dm(rec.date)}")
    elif data.action == "approve":
        _log_record(logs, admin, rec, "aprovacao", f"Aprovou o lançamento do dia {_dm(rec.date)}")
    else:
        _log_record(logs, admin, rec, "reprovacao", f"Reprovou o lançamento do dia {_dm(rec.date)}")
    return record_to_read(rec)


@router.patch("/{record_id}/times", response_model=RecordRead)
def edit_times(record_id: int, data: RecordPatchTimes, records=Depends(record_repo),
               employees=Depends(employee_repo), settings=Depends(settings_repo),
               logs=Depends(activity_repo), admin: dict = Depends(require_admin)):
    rec = uc.edit_times(records, employees, settings, record_id, data)
    _log_record(logs, admin, rec, "edicao", f"Editou horários do dia {_dm(rec.date)}")
    return record_to_read(rec)


@router.patch("/{record_id}/request-edit", response_model=RecordRead)
def request_edit(record_id: int, data: RecordRequestEdit, records=Depends(record_repo),
                 employees=Depends(employee_repo), settings=Depends(settings_repo),
                 logs=Depends(activity_repo), identity: dict = Depends(get_identity)):
    """Colaborador solicita edição do próprio registro — volta para aprovação."""
    rec = uc.request_edit(records, employees, settings, record_id, data, identity)
    _log_record(logs, identity, rec, "solicitacao_edicao",
                f"Solicitou edição do dia {_dm(rec.date)} — aguardando aprovação")
    return record_to_read(rec)


@router.post("/{record_id}/request-removal", response_model=RecordRead)
def request_removal(record_id: int, records=Depends(record_repo), logs=Depends(activity_repo),
                    identity: dict = Depends(get_identity)):
    """Colaborador solicita exclusão do próprio registro — entra na fila do gestor."""
    rec = uc.request_removal(records, record_id, identity)
    _log_record(logs, identity, rec, "solicitacao_exclusao",
                f"Solicitou exclusão do dia {_dm(rec.date)} — aguardando aprovação")
    return record_to_read(rec)


@router.patch("/{record_id}/note", response_model=RecordRead)
def update_note(record_id: int, data: RecordPatchNote, records=Depends(record_repo),
                logs=Depends(activity_repo), identity: dict = Depends(get_identity)):
    rec = uc.patch_note(records, record_id, data, identity)
    _log_record(logs, identity, rec, "observacao", f"Atualizou a observação do dia {_dm(rec.date)}")
    return record_to_read(rec)


@router.post("/{record_id}/attachments", response_model=RecordRead, status_code=201)
async def upload_attachment(record_id: int, file: UploadFile = File(...), records=Depends(record_repo),
                            storage=Depends(attachment_storage), logs=Depends(activity_repo),
                            identity: dict = Depends(get_identity)):
    content = await file.read()
    rec = uc.add_attachment(records, storage, record_id, file.filename or "arquivo", content, identity)
    _log_record(logs, identity, rec, "anexo_add", f"Anexou arquivo no dia {_dm(rec.date)}")
    return record_to_read(rec)


@router.delete("/{record_id}/attachments/{filename}", response_model=RecordRead)
def delete_attachment(record_id: int, filename: str, records=Depends(record_repo),
                      storage=Depends(attachment_storage), logs=Depends(activity_repo),
                      identity: dict = Depends(get_identity)):
    rec = uc.remove_attachment(records, storage, record_id, filename, identity)
    _log_record(logs, identity, rec, "anexo_remove", f"Removeu um anexo do dia {_dm(rec.date)}")
    return record_to_read(rec)


@router.get("/attachments/{filename}")
def download_attachment(filename: str, storage=Depends(attachment_storage)):
    """Público — servido direto via <img>/<a> (nome é UUID aleatório)."""
    return FileResponse(storage.path(filename))


@router.delete("/{record_id}", status_code=204)
def remove_record(record_id: int, records=Depends(record_repo), storage=Depends(attachment_storage),
                  logs=Depends(activity_repo), admin: dict = Depends(require_admin)):
    rec = records.get(record_id)
    date_iso = rec.date if rec else "?"
    emp_id = rec.employee_id if rec else None
    uc.delete(records, storage, record_id)
    activity.log(logs, admin, action="exclusao", description=f"Excluiu o registro do dia {_dm(date_iso)}",
                 entity_type="record", entity_id=record_id, employee_id=emp_id)
