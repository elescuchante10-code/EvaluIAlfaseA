"""
Configuración de la aplicación FastAPI.
"""
from pydantic_settings import BaseSettings
from functools import lru_cache
from typing import List, Optional

from pydantic import field_validator


class Settings(BaseSettings):
    """Configuración centralizada de la aplicación."""
    
    # App
    APP_NAME: str = "EvaluAI Backend"
    DEBUG: bool = True
    # Entorno (local|production). En producción se endurecen checks de seguridad.
    APP_ENV: str = "local"
    
    # AI Providers
    GROQ_API_KEY: str = ""
    
    # Database
    DATABASE_URL: str = "sqlite:///./evaluai.db"
    # Para PostgreSQL: "postgresql://user:password@localhost/evaluai"
    
    # Bootstrap admin (opcional): crea o promueve a admin si coincide el email (README / init_db).
    ADMIN_BOOTSTRAP_EMAIL: str = "juliolopez4p@gmail.com"
    ADMIN_BOOTSTRAP_PASSWORD: str = "password123"
    # En producción el bootstrap admin está deshabilitado salvo override explícito.
    ADMIN_BOOTSTRAP_ALLOW_IN_PROD: bool = False

    # Wompi / billing
    WOMPI_ENVIRONMENT: str = "sandbox"
    WOMPI_API_BASE_URL: Optional[str] = None
    WOMPI_CHECKOUT_BASE_URL: str = "https://checkout.wompi.co/l"
    WOMPI_PRIVATE_KEY: Optional[str] = None
    WOMPI_PUBLIC_KEY: Optional[str] = None
    WOMPI_EVENT_SECRET:  str = "https://evaluadorib-production.up.railway.app/api/billing/wompi/webhook"
    WOMPI_TIMEOUT_SECONDS: int = 20
    WOMPI_SKIP_SIGNATURE_VALIDATION: bool = False
    WOMPI_PAYMENT_SUCCESS_PATH: str = "/payment-success"
    WOMPI_PAYMENT_CANCEL_PATH: str = "/payment-cancelled"
    WOMPI_INDIVIDUAL_AMOUNT_CENTS: int = 3500000
    WOMPI_INSTITUTIONAL_AMOUNT_CENTS: int = 200000000
    WOMPI_DEFAULT_PAYMENT_TTL_MINUTES: int = 120

    # JWT
    SECRET_KEY: str = "1234"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 horas

    @field_validator("SECRET_KEY", mode="after")
    @classmethod
    def _validate_secret_key(cls, value: str, info):  # type: ignore[no-untyped-def]
        """
        Fail-fast en producción si se dejó un SECRET_KEY inseguro por defecto.
        En local se permite para no romper DX.
        """
        env = str((getattr(info, "data", {}) or {}).get("APP_ENV") or "").strip().lower()
        if env in {"production", "prod"}:
            v = str(value or "").strip()
            if not v or v in {"1234", "change_me", "changeme"} or len(v) < 32:
                raise ValueError(
                    "SECRET_KEY inseguro. En producción debe venir de env y tener al menos 32 caracteres."
                )
        return value
    
    # CORS
    FRONTEND_URL: str = "https://evaluador-ib.vercel.app"
    # Comma-separated list, e.g. "https://app.vercel.app,http://localhost:3000"
    ALLOWED_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001,http://127.0.0.1:3001,http://localhost:3005,http://127.0.0.1:3005,https://evaluador-ib.vercel.app"

    # Storage quota (wiki docente / teacher context)
    MAX_UPLOAD_FILE_BYTES: int = 20 * 1024 * 1024
    MAX_USER_STORAGE_BYTES: int = 100 * 1024 * 1024

    @field_validator("ALLOWED_ORIGINS", mode="before")
    @classmethod
    def _normalize_allowed_origins(cls, value: object) -> str:
        # Accept CSV string; ignore accidental JSON-ish lists from some hosts by flattening to CSV upstream.
        if value is None:
            return ""
        if isinstance(value, (list, tuple)):
            return ",".join(str(v).strip() for v in value if str(v).strip())
        return str(value).strip()

    @property
    def allowed_origins_list(self) -> List[str]:
        return [o.strip() for o in str(self.ALLOWED_ORIGINS or "").split(",") if o.strip()]
    
    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    """Retorna instancia cacheada de settings."""
    return Settings()
