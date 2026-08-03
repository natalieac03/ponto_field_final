"""Configuração de infraestrutura (env + defaults)."""
import os

# Ambiente: "development" (padrão) | "production". Em produção, segredos/senha-mestra
# NÃO têm fallback inseguro — precisam vir de variáveis de ambiente.
APP_ENV = os.getenv("APP_ENV", "development")
IS_PROD = APP_ENV.strip().lower() in ("production", "prod")

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./che.db")
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./uploads")

# Bucket S3-compatível (Railway Storage / R2 / MinIO / AWS). Se vazio → disco local.
S3_ENDPOINT_URL = os.getenv("S3_ENDPOINT_URL", "").strip()
S3_BUCKET = os.getenv("S3_BUCKET", "").strip()
S3_ACCESS_KEY_ID = os.getenv("S3_ACCESS_KEY_ID", "").strip()
S3_SECRET_ACCESS_KEY = os.getenv("S3_SECRET_ACCESS_KEY", "").strip()
S3_REGION = os.getenv("S3_REGION", "auto").strip()

# Senha-mestra do admin — bootstrap/recuperação, apenas via env.
# Backdoor "1989" NÃO existe mais em produção: só é oferecido como conveniência de
# desenvolvimento quando a env não está definida e APP_ENV != production.
_master = os.getenv("MASTER_ADMIN_PASSWORD")
if not _master and not IS_PROD:
    _master = "1989"  # somente desenvolvimento local
MASTER_ADMIN_PASSWORD = _master  # None em produção se a env não for definida

CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",") if o.strip()]
