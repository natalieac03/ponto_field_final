from fastapi import APIRouter, Depends, File, UploadFile
from fastapi.responses import FileResponse
from sqlmodel import Session

from database import get_session
from schemas import RecordCreate, RecordPatchBreak, RecordPatchExit, RecordPatchNote, RecordPatchTimes, RecordRead
import services.record_service as svc

router = APIRouter(prefix="/records", tags=["records"])


@router.get("", response_model=list[RecordRead])
def list_records(session: Session = Depends(get_session)):
    return svc.get_all(session)


@router.get("/employee/{employee_id}", response_model=list[RecordRead])
def list_by_employee(employee_id: int, session: Session = Depends(get_session)):
    return svc.get_by_employee(session, employee_id)


@router.post("", response_model=RecordRead, status_code=201)
def add_record(data: RecordCreate, session: Session = Depends(get_session)):
    return svc.create(session, data)


@router.patch("/{record_id}/break", response_model=RecordRead)
def register_break(record_id: int, data: RecordPatchBreak, session: Session = Depends(get_session)):
    return svc.patch_break(session, record_id, data)


@router.patch("/{record_id}/exit", response_model=RecordRead)
def register_exit(record_id: int, data: RecordPatchExit, session: Session = Depends(get_session)):
    return svc.patch_exit(session, record_id, data)


@router.patch("/{record_id}/times", response_model=RecordRead)
def edit_times(record_id: int, data: RecordPatchTimes, session: Session = Depends(get_session)):
    """Admin edita horários (entrada/saída/intervalo). Recalcula HE automaticamente."""
    return svc.patch_times(session, record_id, data)


@router.patch("/{record_id}/note", response_model=RecordRead)
def update_note(record_id: int, data: RecordPatchNote, session: Session = Depends(get_session)):
    return svc.patch_note(session, record_id, data)


@router.post("/{record_id}/attachments", response_model=RecordRead, status_code=201)
async def upload_attachment(record_id: int, file: UploadFile = File(...), session: Session = Depends(get_session)):
    return await svc.add_attachment(session, record_id, file)


@router.delete("/{record_id}/attachments/{filename}", response_model=RecordRead)
def delete_attachment(record_id: int, filename: str, session: Session = Depends(get_session)):
    return svc.remove_attachment(session, record_id, filename)


@router.get("/attachments/{filename}")
def download_attachment(filename: str):
    path = svc.get_attachment_path(filename)
    return FileResponse(path)


@router.delete("/{record_id}", status_code=204)
def remove_record(record_id: int, session: Session = Depends(get_session)):
    svc.delete(session, record_id)
