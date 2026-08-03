"""Mapeamento entidade → DTO de resposta (parse de anexos JSON)."""
import json

from app.application.dtos import RecordRead
from app.domain.models import DailyRecord


def record_to_read(rec: DailyRecord) -> RecordRead:
    d = rec.model_dump()
    try:
        att = json.loads(rec.attachments) if rec.attachments else []
    except json.JSONDecodeError:
        att = []
    d["attachments"] = att if isinstance(att, list) else []
    return RecordRead(**d)
