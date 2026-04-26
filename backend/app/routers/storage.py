from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.models.models import Document, User
from app.services.auth import get_current_active_user

router = APIRouter(prefix="/api/storage", tags=["storage"])


@router.get("/quota")
def get_storage_quota(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Cupo de almacenamiento para Wiki docente / Teacher Context.
    Fuente de verdad: base de datos (suma de file_size_bytes de documentos del usuario).
    """
    settings = get_settings()
    used = (
        db.query(func.coalesce(func.sum(Document.file_size_bytes), 0))
        .filter(Document.user_id == int(current_user.id))
        .scalar()
    )
    total_bytes_used = int(used or 0)
    max_bytes = int(settings.MAX_USER_STORAGE_BYTES)
    remaining_bytes = max(0, max_bytes - total_bytes_used)
    return {
        "total_bytes_used": total_bytes_used,
        "max_bytes": max_bytes,
        "remaining_bytes": remaining_bytes,
    }

