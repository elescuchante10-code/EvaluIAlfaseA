"""
Migraciones ligeras sin Alembic: añade columnas nuevas si faltan (SQLite / Postgres).
"""
from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine


def ensure_document_teacher_context_columns(engine: Engine) -> None:
    """Añade columnas del pipeline contextual Markdown/manifiesto a `documents`."""
    insp = inspect(engine)
    if not insp.has_table("documents"):
        return
    cols = {c["name"] for c in insp.get_columns("documents")}

    statements = []
    if "file_size_bytes" not in cols:
        statements.append("ALTER TABLE documents ADD COLUMN file_size_bytes INTEGER NOT NULL DEFAULT 0")
    if "context_markdown_status" not in cols:
        statements.append(
            "ALTER TABLE documents ADD COLUMN context_markdown_status VARCHAR(20) NOT NULL DEFAULT 'pending'"
        )
    if "context_markdown_relpath" not in cols:
        statements.append("ALTER TABLE documents ADD COLUMN context_markdown_relpath VARCHAR(500)")

    if not statements:
        return

    with engine.begin() as conn:
        for stmt in statements:
            conn.execute(text(stmt))
