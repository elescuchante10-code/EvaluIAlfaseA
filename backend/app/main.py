"""
Aplicación principal FastAPI - EvaluAI Backend.

Configuración con CORS habilitado para el frontend en localhost:3000
"""
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.core.config import get_settings
from app.core.database import engine, Base, SessionLocal
from app.core.schema_patch import ensure_document_teacher_context_columns
from app.services.auth import ensure_admin_bootstrap
from app.routers import auth, documents, rubrics, evaluate, wompi, admin, storage

settings = get_settings()


def _run_alembic_upgrade() -> None:
    """Aplica migraciones Alembic (esquema comercial / roles)."""
    # Import perezoso: el directorio de scripts del repo se llama `migrations/` (no `alembic/`)
    # para no sombrear el paquete PyPI al ejecutar `pytest` desde `backend/`.
    from alembic import command
    from alembic.config import Config

    backend_root = Path(__file__).resolve().parent.parent
    alembic_ini = backend_root / "alembic.ini"
    if not alembic_ini.is_file():
        print("[WARN] alembic.ini no encontrado; se omiten migraciones Alembic")
        return
    cfg = Config(str(alembic_ini))
    cfg.set_main_option("script_location", str(backend_root / "migrations"))
    cfg.set_main_option("sqlalchemy.url", settings.DATABASE_URL)
    command.upgrade(cfg, "head")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Gestión del ciclo de vida de la aplicación.
    Crea las tablas de la base de datos al iniciar.
    """
    # Startup: tablas base + migraciones Alembic + parches de columnas legacy
    Base.metadata.create_all(bind=engine)
    _run_alembic_upgrade()
    ensure_document_teacher_context_columns(engine)
    db = SessionLocal()
    try:
        ensure_admin_bootstrap(db)
    except Exception as exc:
        print(f"[WARN] Admin bootstrap omitido: {exc}")
        db.rollback()
    finally:
        db.close()
    print("[OK] Database tables created/verified")
    yield
    # Shutdown
    print("Application shutting down")


# Crear aplicación FastAPI
app = FastAPI(
    title=settings.APP_NAME,
    description="""
    Backend de EvaluAI - Sistema de evaluación académica con IA.
    
    ## Características:
    * 🔐 Autenticación JWT
    * 📝 Gestión de documentos
    * 🤖 Anotaciones con IA
    * 🎯 Data Flywheel (correcciones humanas)
    * 📊 Estadísticas y métricas
    """,
    version="1.0.0",
    lifespan=lifespan
)

# ============================================
# CONFIGURACIÓN CORS - CRÍTICO PARA EL FRONTEND
# ============================================
# Permitir múltiples puertos para desarrollo local
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],  # GET, POST, PUT, DELETE, OPTIONS, etc.
    allow_headers=["*"],  # Authorization, Content-Type, etc.
    expose_headers=["*"],
    max_age=600,  # Cache preflight requests for 10 minutes
)

# ============================================
# ROUTERS
# ============================================
app.include_router(auth.router)
app.include_router(documents.router)
app.include_router(rubrics.router)
app.include_router(evaluate.router)
app.include_router(wompi.router)
app.include_router(admin.router)
app.include_router(storage.router)


# ============================================
# ENDPOINTS DE SALUD
# ============================================
@app.get("/")
def root():
    """Endpoint raíz - información de la API."""
    return {
        "name": settings.APP_NAME,
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs",
        "openapi": "/openapi.json"
    }


@app.get("/health")
def health_check():
    """Endpoint de health check."""
    return {
        "status": "healthy",
        "database": "connected"
    }


@app.get("/api/test-cors")
def test_cors():
    """
    Endpoint para probar que CORS funciona correctamente.
    Llama a este desde el frontend para verificar la conexión.
    """
    return {
        "message": "CORS is working!",
        "cors_enabled": True,
        "allowed_origins": settings.allowed_origins_list,
    }


# ============================================
# INICIALIZACIÓN
# ============================================
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG
    )
