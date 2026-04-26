from app.services import teacher_context_response_policy as pol


def test_resolve_chat_superficie():
    assert pol.resolve_chat_superficie(None) == "default"
    assert pol.resolve_chat_superficie({}) == "default"
    assert pol.resolve_chat_superficie({"superficie": "asistente_ia"}) == "asistente_ia"
    assert pol.resolve_chat_superficie({"superficie": "chat_contextual"}) == "chat_contextual"
    assert pol.resolve_chat_superficie({"superficie": "chat-contextual"}) == "chat_contextual"


def test_snippets_footer_differs_by_superficie():
    a = pol.build_teacher_context_snippets_prompt_footer("asistente_ia")
    c = pol.build_teacher_context_snippets_prompt_footer("chat_contextual")
    assert "copiloto" in a.lower() or "pedagógica" in a.lower()
    assert "FORMAL" in c and "CRÍTICO" in c
    assert a != c


def test_mi_espacio_policy_section_covers_surfaces():
    assert "Asistente IA" in pol.build_chat_mi_espacio_policy_section("asistente_ia")
    assert "chat contextual" in pol.build_chat_mi_espacio_policy_section("chat_contextual").lower()
    assert "Fragmentos recuperados" in pol.build_chat_mi_espacio_policy_section("default")
