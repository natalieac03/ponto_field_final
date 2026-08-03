"""Armazenamento de anexos/fotos.

Usa um bucket S3-compatível (Railway Storage, Cloudflare R2, MinIO, AWS S3…)
QUANDO as variáveis S3_* estão configuradas — assim os arquivos sobrevivem a
deploys em containers efêmeros. Sem essas variáveis, cai no disco local
(ideal para desenvolvimento).

Variáveis (as do bucket do Railway):
    S3_ENDPOINT_URL   ex.: https://xxx.storageapi.dev
    S3_BUCKET
    S3_ACCESS_KEY_ID
    S3_SECRET_ACCESS_KEY
    S3_REGION         (opcional, padrão "auto")
"""
import uuid
from pathlib import Path

from app.application.errors import NotFoundError, ValidationError
from app.infrastructure.config import (
    UPLOAD_DIR, S3_ENDPOINT_URL, S3_BUCKET, S3_ACCESS_KEY_ID,
    S3_SECRET_ACCESS_KEY, S3_REGION,
)


def _stored_name(record_id: int, filename: str) -> str:
    ext = Path(filename or "arquivo").suffix.lower()
    return f"{record_id}_{uuid.uuid4().hex[:10]}{ext}"


def _safe(stored_name: str) -> str:
    if "/" in stored_name or "\\" in stored_name or ".." in stored_name:
        raise ValidationError("Nome de arquivo inválido.")
    return stored_name


def _guess_type(name: str) -> str:
    ext = Path(name).suffix.lower()
    return {
        ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
        ".webp": "image/webp", ".gif": "image/gif", ".heic": "image/heic",
        ".pdf": "application/pdf",
    }.get(ext, "application/octet-stream")


class FileAttachmentStorage:
    """Disco local (dev / quando não há S3)."""
    kind = "disk"

    def __init__(self, base_dir: str = UPLOAD_DIR):
        self.dir = Path(base_dir)
        self.dir.mkdir(parents=True, exist_ok=True)

    def save(self, record_id: int, filename: str, content: bytes) -> str:
        stored = _stored_name(record_id, filename)
        (self.dir / stored).write_bytes(content)
        return stored

    def delete(self, stored_name: str) -> None:
        try:
            (self.dir / stored_name).unlink(missing_ok=True)
        except OSError:
            pass

    def path(self, stored_name: str) -> Path:
        p = self.dir / _safe(stored_name)
        if not p.exists() or not p.is_file():
            raise NotFoundError("Arquivo não encontrado.")
        return p

    def read(self, stored_name: str) -> tuple[bytes, str]:
        p = self.path(stored_name)
        return p.read_bytes(), _guess_type(stored_name)


class S3AttachmentStorage:
    """Bucket S3-compatível (Railway Storage / R2 / MinIO / AWS)."""
    kind = "s3"

    def __init__(self):
        import boto3  # import tardio: só quando S3 está configurado
        from botocore.config import Config
        self.bucket = S3_BUCKET
        self.client = boto3.client(
            "s3",
            endpoint_url=S3_ENDPOINT_URL,
            aws_access_key_id=S3_ACCESS_KEY_ID,
            aws_secret_access_key=S3_SECRET_ACCESS_KEY,
            region_name=S3_REGION or "auto",
            config=Config(
                signature_version="s3v4",          # Railway/Tigris exige v4
                s3={"addressing_style": "path"},   # path-style: bucket/key em vez de bucket.host/key
            ),
        )

    def save(self, record_id: int, filename: str, content: bytes) -> str:
        stored = _stored_name(record_id, filename)
        self.client.put_object(
            Bucket=self.bucket, Key=stored, Body=content,
            ContentType=_guess_type(stored),
        )
        return stored

    def delete(self, stored_name: str) -> None:
        try:
            self.client.delete_object(Bucket=self.bucket, Key=_safe(stored_name))
        except Exception:
            pass

    def read(self, stored_name: str) -> tuple[bytes, str]:
        try:
            obj = self.client.get_object(Bucket=self.bucket, Key=_safe(stored_name))
        except Exception:
            raise NotFoundError("Arquivo não encontrado.")
        return obj["Body"].read(), obj.get("ContentType") or _guess_type(stored_name)


def build_storage():
    """Escolhe S3 se configurado; senão disco local."""
    if S3_ENDPOINT_URL and S3_BUCKET and S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY:
        try:
            return S3AttachmentStorage()
        except Exception as e:  # boto3 ausente/credencial ruim → não derruba o app
            print(f"[storage] S3 indisponível ({e}); usando disco local.")
    return FileAttachmentStorage()
