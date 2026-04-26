"""
Rutas para gestión de rúbricas.
"""
import re
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime
from pydantic import BaseModel

from app.core.database import get_db
from app.services.auth import get_current_active_user
from app.models.models import User, Rubric

router = APIRouter(prefix="/api/rubrics", tags=["rubrics"])


def extract_rubric_config(markdown: str) -> dict:
    if not markdown:
        return {
            "metodologia_evaluacion": "general_document",
            "instruccion_ia": "",
        }

    match = re.match(r"^---\s*\n([\s\S]*?)\n---\s*\n?", markdown)
    frontmatter = {}
    if match:
        for line in match.group(1).splitlines():
            if ":" not in line:
                continue
            key, value = line.split(":", 1)
            frontmatter[key.strip()] = value.strip().strip("\"'")

    metodologia = frontmatter.get("metodologia_evaluacion", "general_document") or "general_document"
    instruccion = frontmatter.get("instruccion_ia", "") or ""
    if metodologia != "custom":
        instruccion = ""

    return {
        "metodologia_evaluacion": metodologia,
        "instruccion_ia": instruccion,
    }

class RubricCreate(BaseModel):
    markdown: str
    nombre: str | None = None
    asignatura: str | None = None


@router.get("/")
async def list_rubrics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Lista las rúbricas del usuario usando SQLAlchemy."""
    user_rubrics = db.query(Rubric).filter(Rubric.user_id == current_user.id).order_by(Rubric.created_at.desc()).all()
    
    rubrics_list = []
    for r in user_rubrics:
        config = extract_rubric_config(r.markdown)
        rubrics_list.append({
            "id": r.id,
            "user_id": r.user_id,
            "nombre": r.nombre,
            "asignatura": r.asignatura,
            "markdown": r.markdown,
            **config,
            "created_at": r.created_at.isoformat() if r.created_at else None
        })
        
    return {
        "success": True,
        "rubrics": rubrics_list
    }


@router.post("/")
async def create_rubric(
    rubric_data: RubricCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Crea una nueva rúbrica desde Markdown en la BD local."""
    markdown = rubric_data.markdown
    if not markdown:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El campo 'markdown' es requerido"
        )
    
    # Usar valores proporcionados o parsear el markdown como fallback
    nombre = rubric_data.nombre or "Rúbrica sin nombre"
    asignatura = rubric_data.asignatura or "Sin asignatura"
    
    if not rubric_data.nombre or not rubric_data.asignatura:
        lines = markdown.split('\n')
        for line in lines:
            if not rubric_data.nombre and line.startswith('# ') and nombre == "Rúbrica sin nombre":
                nombre = line.replace('# ', '').strip()
            if not rubric_data.asignatura and ('asignatura:' in line.lower() or 'curso:' in line.lower() or '**asignatura**' in line.lower()):
                asignatura = line.split(':')[-1].strip().replace('*', '').replace('-', '').strip()
    
    # Crear rúbrica en base de datos
    new_rubric = Rubric(
        user_id=current_user.id,
        nombre=nombre,
        asignatura=asignatura,
        markdown=markdown
    )
    
    db.add(new_rubric)
    db.commit()
    db.refresh(new_rubric)
    
    return {
        "success": True,
        "rubric": {
            "id": new_rubric.id,
            "user_id": new_rubric.user_id,
            "nombre": new_rubric.nombre,
            "asignatura": new_rubric.asignatura,
            "markdown": new_rubric.markdown,
            **extract_rubric_config(new_rubric.markdown),
            "created_at": new_rubric.created_at.isoformat() if new_rubric.created_at else None
        },
        "message": "Rúbrica guardada exitosamente"
    }


@router.get("/{rubric_id}")
async def get_rubric(
    rubric_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Obtiene una rúbrica de la BD por su ID."""
    rubric = db.query(Rubric).filter(Rubric.id == rubric_id, Rubric.user_id == current_user.id).first()
    
    if not rubric:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rúbrica no encontrada"
        )
    
    return {
        "success": True,
        "rubric": {
            "id": rubric.id,
            "user_id": rubric.user_id,
            "nombre": rubric.nombre,
            "asignatura": rubric.asignatura,
            "markdown": rubric.markdown,
            **extract_rubric_config(rubric.markdown),
            "created_at": rubric.created_at.isoformat() if rubric.created_at else None
        }
    }


@router.delete("/{rubric_id}")
async def delete_rubric(
    rubric_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Elimina una rúbrica de la BD."""
    rubric = db.query(Rubric).filter(Rubric.id == rubric_id, Rubric.user_id == current_user.id).first()
    
    if not rubric:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rúbrica no encontrada"
        )
    
    db.delete(rubric)
    db.commit()
    
    return {
        "success": True,
        "message": "Rúbrica eliminada"
    }
