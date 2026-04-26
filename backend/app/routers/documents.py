"""
Rutas para gestión de documentos - Extracción de texto real.
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
# from app.services.auth import get_current_active_user
from app.models.models import Document
from app.services.document_multimodal import (
    cache_document_processing,
    extract_document_payload,
    get_cached_document_processing,
)
from app.services.document_router import detect_document_type
from app.services.document_intelligence import build_document_intelligence_profile
from app.services.teacher_context_pipeline import (
    TEACHER_CONTEXT_ROOT,
    build_manifest_payload,
    regenerate_teacher_context_artifacts,
    write_teacher_markdown_file,
)

router = APIRouter(prefix="/api/documents", tags=["documents"])


def _teacher_markdown_api_path(document_id: int, markdown_status: str, relpath: Optional[str]) -> Optional[str]:
    if markdown_status == "ready" and relpath:
        return f"/api/documents/{document_id}/teacher-markdown"
    return None


def _markdown_public_fields(doc: Document) -> dict:
    st = getattr(doc, "context_markdown_status", None) or "pending"
    rel = getattr(doc, "context_markdown_relpath", None)
    return {
        "markdown_status": st,
        "markdown_path": _teacher_markdown_api_path(doc.id, st, rel),
        "markdown_relpath": rel,
    }


def extract_text_from_docx(file_content: bytes):
    """Compatibilidad retroactiva: conserva la extracción de párrafos."""
    return extract_document_payload("documento.docx", file_content)["paragraphs"]


def extract_text_from_pdf(file_content: bytes):
    """Compatibilidad retroactiva: conserva la extracción de párrafos."""
    return extract_document_payload("documento.pdf", file_content)["paragraphs"]


def extract_text_from_txt(file_content: bytes):
    """Compatibilidad retroactiva: conserva la extracción de párrafos."""
    return extract_document_payload("documento.txt", file_content)["paragraphs"]


@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    # current_user: User = Depends(get_current_active_user)
):
    """
    Sube y procesa un documento (.docx, .pdf, .txt).
    Extrae el texto y lo divide en párrafos.
    """
    # Validar extensión
    filename = file.filename.lower()
    
    if not any(filename.endswith(ext) for ext in [".docx", ".pdf", ".txt"]):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Solo se permiten archivos .docx, .pdf o .txt"
        )
    
    # Leer contenido del archivo
    content = await file.read()
    
    if len(content) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El archivo está vacío"
        )
    
    # Extraer texto según el tipo de archivo
    try:
        extracted = extract_document_payload(file.filename, content)
        paragraphs = extracted["paragraphs"]
        processing = extracted["processing"]
        document_router = detect_document_type(file.filename, "\n\n".join(paragraphs))
        processing["document_router"] = document_router
        processing["document_type"] = document_router["type"]
        processing["document_type_confidence"] = document_router["confidence"]
        full_text = "\n\n".join(paragraphs)
        processing["document_intelligence_profile"] = build_document_intelligence_profile(
            file.filename,
            full_text,
            processing,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error procesando archivo: {str(e)}"
        )
    
    # Validate extraction result — abort if no text was extracted
    non_empty = [p for p in paragraphs if p.strip()]
    if not non_empty:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                f"Extracción fallida: el documento '{file.filename}' no contiene texto legible. "
                "Puede estar escaneado (imagen sin OCR), protegido con contraseña o corrupto. "
                "Por favor usa un PDF con texto seleccionable o un archivo .docx."
            ),
        )
    paragraphs = non_empty

    # Guardar en base de datos
    document = Document(
        user_id=1,  # Asignar un ID de usuario fijo para pruebas
        filename=file.filename,
        original_text="\n\n".join(paragraphs),
        status="pending"
    )
    db.add(document)
    db.commit()
    db.refresh(document)

    md_status, md_rel = write_teacher_markdown_file(document.id, file.filename, paragraphs)
    document.context_markdown_status = md_status
    document.context_markdown_relpath = md_rel
    db.add(document)
    db.commit()
    db.refresh(document)

    cache_document_processing(document.id, processing)
    regenerate_teacher_context_artifacts(db)

    md = _markdown_public_fields(document)
    return {
        "success": True,
        "document_id": document.id,
        "filename": file.filename,
        "paragraphs": paragraphs,
        "paragraph_count": len(paragraphs),
        "status": "ready",
        "message": f"Documento procesado exitosamente. {len(paragraphs)} párrafos encontrados.",
        "multimodal": processing,
        "document_router": processing.get("document_router"),
        "document_intelligence_profile": processing.get("document_intelligence_profile"),
        **md,
        "teacher_context_manifest_url": "/api/documents/teacher-context/manifest",
    }


@router.get("/teacher-context/manifest")
async def get_teacher_context_manifest(db: Session = Depends(get_db)):
    """Manifiesto JSON legible (auditable) del registro Markdown contextual por documento."""
    docs = db.query(Document).order_by(Document.id.asc()).all()
    return build_manifest_payload(docs)


@router.get("/{document_id}/teacher-markdown")
async def download_teacher_markdown(
    document_id: int,
    db: Session = Depends(get_db),
):
    """Sirve el Markdown mínimo derivado del texto extraído (pipeline Karpathy, sin embeddings)."""
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Documento no encontrado",
        )
    st = getattr(document, "context_markdown_status", None) or "pending"
    rel = getattr(document, "context_markdown_relpath", None)
    if st != "ready" or not rel:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Markdown contextual no disponible para este documento",
        )
    path = TEACHER_CONTEXT_ROOT.joinpath(*rel.split("/"))
    if not path.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Archivo Markdown no encontrado en disco",
        )
    return FileResponse(
        path,
        media_type="text/markdown; charset=utf-8",
        filename=f"teacher_context_{document_id}.md",
    )


@router.get("/{document_id}")
async def get_document(
    document_id: int,
    db: Session = Depends(get_db),
    # current_user: User = Depends(get_current_active_user)
):
    """Obtiene un documento por su ID."""
    document = db.query(Document).filter(
        Document.id == document_id
        # Document.user_id == current_user.id  # Comentar esta línea si es necesario
    ).first()
    
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Documento no encontrado"
        )
    
    paragraphs = document.original_text.split("\n\n") if document.original_text else []

    cached = get_cached_document_processing(document.id)
    multimodal = dict(cached) if isinstance(cached, dict) else cached
    if isinstance(multimodal, dict) and "document_intelligence_profile" not in multimodal:
        multimodal["document_intelligence_profile"] = build_document_intelligence_profile(
            document.filename,
            document.original_text or "",
            multimodal,
        )

    return {
        "success": True,
        "document_id": document.id,
        "filename": document.filename,
        "paragraphs": paragraphs,
        "status": document.status,
        "created_at": document.created_at,
        "multimodal": multimodal,
        "document_router": (multimodal or {}).get("document_router") if isinstance(multimodal, dict) else None,
        "document_intelligence_profile": multimodal.get("document_intelligence_profile")
        if isinstance(multimodal, dict)
        else None,
        **_markdown_public_fields(document),
        "teacher_context_manifest_url": "/api/documents/teacher-context/manifest",
    }


@router.get("/")
async def list_documents(
    db: Session = Depends(get_db),
    # current_user: User = Depends(get_current_active_user),
    limit: int = 50,
    offset: int = 0
):
    """Lista los documentos del usuario."""
    documents = db.query(Document).filter(
        # Document.user_id == current_user.id  # Comentar esta línea si es necesario
    ).order_by(Document.created_at.desc()).offset(offset).limit(limit).all()
    
    return {
        "success": True,
        "documents": [
            {
                "id": doc.id,
                "filename": doc.filename,
                "status": doc.status,
                "created_at": doc.created_at,
                "paragraph_count": len(doc.original_text.split("\n\n")) if doc.original_text else 0,
                **_markdown_public_fields(doc),
            }
            for doc in documents
        ],
        "total": len(documents)
    }


@router.delete("/{document_id}")
async def delete_document(
    document_id: int,
    db: Session = Depends(get_db),
    # current_user: User = Depends(get_current_active_user)
):
    """Elimina un documento."""
    document = db.query(Document).filter(
        Document.id == document_id
        # Document.user_id == current_user.id  # Comentar esta línea si es necesario
    ).first()
    
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Documento no encontrado"
        )
    
    db.delete(document)
    db.commit()
    regenerate_teacher_context_artifacts(db)

    return {
        "success": True,
        "message": "Documento eliminado exitosamente"
    }