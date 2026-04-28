# Fase C — cierre de protocolo (2026-04-28)

**Metodología:** [`MODELO_PRUEBA_CALIDAD_IA.md`](MODELO_PRUEBA_CALIDAD_IA.md) · tareas: [`FASE_C_TAREAS.md`](FASE_C_TAREAS.md) (esta ficha **cierra** la lista con evidencia en repo).

**HEAD de referencia (re-ejecutar y actualizar tras commit):** `e91bfb8` (o el vigente al auditar).  
**Regresión automatizada (C4.4):** `cd backend && python -m pytest` — **75 passed** (incluye aislamiento de pack, ver abajo).

---

## 1. Manifiesto / `documents` / `teacher_context_pipeline`

- **Criterio:** listados `GET /api/documents/teacher-context/pack` y `.../manifest` acotados por `user_id` (cambio intencional; ver docstring en `documents.py`).
- **Evidencia de código / tests:** `test_teacher_context_pack_isolation.py` — comprobación C4.3 en dos usuarios con documentos `ready` disjuntos.
- **Humo de pendientes reales (P1):** “doc pending forever” o límites de alambre: seguimiento ad hoc si un entorno concreto lo muestra; no requiere parche mientras el pipeline y tests estén en verde.

---

## 2. Observabilidad (soporte)

- **Decisión:** no se añade hoy tráfico de retrieval extra en la API pública; el contrato de chat **ya** puede incluir metadatos de retrieval (p. ej. `documents_read`, `snippets`) usados en corridas. Ampliar solo con requisito de producto (sin PII).

---

## 3. Copy y expectativas (UI)

- **AsistenteIA:** comentario de cabecera actualizado para alinear con integración real de `teacher_context_pack` (evita mensaje de “futuro” contradictorio con Fase A).
- **Textos de recuperación:** `SettingsView`, `AsistenteIA` y `teacherContextPack` describen índice local + Markdown en servidor; coherentes con [`PROTOCOLO_CALIDAD_CUMPLIMIENTO.md`](PROTOCOLO_CALIDAD_CUMPLIMIENTO.md).

---

## 4. Punto 6 (matriz) — mapeo multi-asignatura

No sustituye una campaña con datos reales por **cada** disciplina; fija trazabilidad con la **misma** plantilla MODELO (M/F/E/R) reutilizando el motor unificado.

| Tipo (matriz) | Asignaturas de ejemplo en corridas anteriores | Dónde está cubierto |
|-----------------|-----------------------------------------------|----------------------|
| Humanidades | **Filosofía** (guía indexada) | A: M1, F1, F3; B: E1; MF&R: M3/M4, R1/R2 |
| Ciencias | **Biología** (txt M2), **Química** (contexto M4) | [`CORRIDA_CALIDAD_MF_R_2026-04-28.md`](CORRIDA_CALIDAD_MF_R_2026-04-28.md) |
| Idioma (ej. Inglés B, Español A) | *Sin PDF dedicado en esta tanda* | Misma mecánica: subir guía + rúbrica IB, ejecutar batería M1/F/E1 con asignatura activa coherente cuando existan datos. |

**Criterio de producto:** cuando haya material e idioma en Mi Espacio, repetir M1 + F1 + E1 en una sola sesión y enlazar ficha o anexo a esta sección.

---

## 5. C4.3 — Privacidad multiusuario (API)

- **Tests:** `test_teacher_context_pack_isolation.py` (obligatorio en CI).
- **Humo con dos cuentas reales:** `scripts/corrida_calidad_c43_two_accounts.py` con `EVALUAI_QA_*` y `EVALUAI_QA_*_B`. Criterio: `document_id` de A ∩ B = ∅.
- *Si no se dispone de segunda cuenta de QA, no se bloquea el cierre: C4.3 queda cubierta a nivel de tests + procedimiento documentado.*

---

*Fase C: cerrada a nivel de protocolo de documentación, tests añadidos y checklist actualizado. Ampliar Punto 6 con runs por idioma cuando el producto tenga entregas de referencia.*
