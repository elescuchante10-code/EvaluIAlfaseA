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
    
    # AI Providers
    GROQ_API_KEY: str = ""
    
    # Database
    DATABASE_URL: str = "sqlite:///./evaluai.db"
    # Para PostgreSQL: "postgresql://user:password@localhost/evaluai"
    
    # Bootstrap admin (opcional): crea un usuario admin si el email no existe.
    ADMIN_BOOTSTRAP_EMAIL: str = "julio@gmail.com"
    ADMIN_BOOTSTRAP_PASSWORD: str = "password123"

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
    
    # CORS
    FRONTEND_URL: str = "https://evaluador-ib.vercel.app"
    # Comma-separated list, e.g. "https://app.vercel.app,http://localhost:3000"
    ALLOWED_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001,http://127.0.0.1:3001,http://localhost:3005,http://127.0.0.1:3005,https://evaluador-ib.vercel.app"

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
