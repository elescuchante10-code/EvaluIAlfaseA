"""Rutas en disco teacher-context (P2 namespacing + resolución dual)."""

from types import SimpleNamespace

from app.services import teacher_context_pipeline as tcp


def test_resolve_uses_relpath_when_file_exists(tmp_path, monkeypatch):
    monkeypatch.setattr(tcp, "TEACHER_CONTEXT_ROOT", tmp_path)
    (tmp_path / "users" / "2" / "md").mkdir(parents=True)
    namespaced = tmp_path / "users" / "2" / "md" / "9.md"
    namespaced.write_text("ns", encoding="utf-8")
    (tmp_path / "md").mkdir(parents=True)
    (tmp_path / "md" / "9.md").write_text("legacy", encoding="utf-8")
    doc = SimpleNamespace(id=9, user_id=2, context_markdown_relpath="users/2/md/9.md")
    assert tcp.resolve_teacher_markdown_abs_path(doc) == namespaced


def test_resolve_falls_back_to_legacy_md(tmp_path, monkeypatch):
    monkeypatch.setattr(tcp, "TEACHER_CONTEXT_ROOT", tmp_path)
    (tmp_path / "md").mkdir(parents=True)
    legacy = tmp_path / "md" / "5.md"
    legacy.write_text("legacy", encoding="utf-8")
    doc_bad_rel = SimpleNamespace(id=5, user_id=1, context_markdown_relpath="missing/path/x.md")
    assert tcp.resolve_teacher_markdown_abs_path(doc_bad_rel) == legacy


def test_resolve_namespaced_without_legacy(tmp_path, monkeypatch):
    monkeypatch.setattr(tcp, "TEACHER_CONTEXT_ROOT", tmp_path)
    (tmp_path / "users" / "3" / "md").mkdir(parents=True)
    p = tmp_path / "users" / "3" / "md" / "12.md"
    p.write_text("x", encoding="utf-8")
    doc = SimpleNamespace(id=12, user_id=3, context_markdown_relpath=None)
    assert tcp.resolve_teacher_markdown_abs_path(doc) == p


def test_build_teacher_context_pack_only_ready():
    ready = SimpleNamespace(
        id=1,
        filename="a.pdf",
        context_markdown_status="ready",
        context_markdown_relpath="users/1/md/1.md",
    )
    pending = SimpleNamespace(
        id=2,
        filename="b.pdf",
        context_markdown_status="pending",
        context_markdown_relpath=None,
    )
    pack = tcp.build_teacher_context_pack_from_documents([pending, ready])
    assert pack["pack_kind"] == "teacher_context_pack"
    assert len(pack["documents"]) == 1
    assert pack["documents"][0]["document_id"] == 1
    assert pack["documents"][0]["markdown_relpath"] == "users/1/md/1.md"


def test_write_teacher_markdown_namespaced(tmp_path, monkeypatch):
    monkeypatch.setattr(tcp, "TEACHER_CONTEXT_ROOT", tmp_path)
    st, rel = tcp.write_teacher_markdown_file(44, "f.pdf", ["Hola"], owner_user_id=7)
    assert st == "ready"
    assert rel == "users/7/md/44.md"
    path = tmp_path / "users" / "7" / "md" / "44.md"
    assert path.is_file()
    text = path.read_text(encoding="utf-8")
    assert "Hola" in text
    assert "owner_user_id: 7" in text
