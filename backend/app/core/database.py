"""
Configuración de base de datos con SQLAlchemy.
"""
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from app.core.config import get_settings

settings = get_settings()


def _normalize_database_url(url: str) -> str:
    """
    Railway/Postgres URLs are commonly `postgresql://...`, which defaults to psycopg2 in SQLAlchemy.

    In slim containers, psycopg2 often requires system libpq (`libpq.so.5`). We standardize on
    SQLAlchemy's psycopg (v3) driver via `postgresql+psycopg://...`.
    """
    raw = str(url or "").strip()
    if not raw:
        return raw

    # Heroku-style URLs
    if raw.startswith("postgres://"):
        raw = "postgresql://" + raw[len("postgres://") :]

    if raw.startswith("postgresql://") and not raw.startswith("postgresql+"):
        return "postgresql+psycopg://" + raw[len("postgresql://") :]

    return raw


# Crear engine
engine = create_engine(
    _normalize_database_url(settings.DATABASE_URL),
    connect_args={"check_same_thread": False} if "sqlite" in settings.DATABASE_URL else {},
    echo=settings.DEBUG
)

# Session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base para modelos
Base = declarative_base()


def get_db() -> Session:
    """Dependency para obtener sesión de base de datos."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
