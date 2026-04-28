# Corrida de calidad — Fase A (2026-04-27)

**Entorno:** API `http://127.0.0.1:8000` (backend local en ejecución)  
**Referencia de metodología:** [`MODELO_PRUEBA_CALIDAD_IA.md`](MODELO_PRUEBA_CALIDAD_IA.md) (ejes C1–C4, casos M/F)  
**Alcance:** Fase A mide principalmente **C1 (contexto Mi Espacio), C2 (copiloto) y C4 (fiabilidad parcial)**. **C3** (evaluación formal con rúbrica) queda **fuera de foco** hasta Fase B.

**Commit** (HEAD al momento de la corrida): `e91bfb8`  
**Nota de trabajo:** había **cambios sin commitear** en el árbol (Fase A + archivos ajenos); el resultado aplica a ese estado del workspace.

**Reproducción de llamadas API (sin credenciales en claro):** `scripts/corrida_calidad_fase_a_api.py` con `EVALUAI_QA_EMAIL` y `EVALUAI_QA_PASSWORD` exportados. La misma **cuenta de prueba y documento** que en la ficha [`CORRIDA_CALIDAD_BASELINE_2026-04-28.md`](CORRIDA_CALIDAD_BASELINE_2026-04-28.md) (PDF Filosofía NM, `document_id: 5`, `markdown ready`).

---

## R3 — Tests automatizados (C4.4)

- **Suite completa (actualizar al auditar):** `cd backend && python -m pip install -r requirements.txt && python -m pytest` — **75 passed** (incl. aislamiento pack C4.3, HEAD de referencia vigente).
- **Arreglo aplicado en el repo:** la carpeta de *revisiones* Alembic dejó de llamarse `alembic/` (conflictúa con el paquete PyPI `alembic` al importar `app.main` bajo `pytest`); ahora vive en `backend/migrations/`. `from alembic import command` es **perezoso** dentro de `_run_alembic_upgrade()`.

## Casos vía `POST /api/evaluate/chat` (M1, M1 intro, F1, F2, F3)

Todas las peticiones devolvieron **`success: true`**, HTTP 200, sin 500. Se registró `teacher_context_retrieval.retrieval_mode: markdown_selective` y al menos un snippet con texto del `.md` salvo lógica contraria (abajo, detalle).

*Actualización protocolo: **F2** (criterio de rúbrica que aplica a un párrafo) está en* `scripts/corrida_calidad_fase_a_api.py` *— re-ejecutar el script y, si se audita comercialmente, añadir aquí un extracto de la salida de la clave* `F2` *del JSON.*

| ID  | Qué se probó | C1 (fragmento) | C2 (fragmento) |
|-----|----------------|-----------------|-----------------|
| **M1** | `asistente_ia` — estímulo/riesgo ético según guía | Respuesta alineada a Telepathy/Neuralink/ética; `documents_read: 1`, snippet desde introducción. | Tono de copiloto, sin nota rúbrica. |
| **M1 intro** | Misma superficie — introducción y Telepathy | Consistente con M1; intención «introducción/estímulo»; retrieval con mismo anclaje. | Igual. |
| **F1** | `chat_contextual` — mejora de párrafo **sin** pedir nota | Snippet traído de tramo con «dispositivo»/Telepathy (útil; no exige cita literal del párrafo de prueba) | **Sin** nota; sugerencias tácticas; no se vio taxonomía FORMAL/MENOR/… |
| **F2** | `chat_contextual` — qué criterio de rúbrica aplica a un párrafo dado (sin nota) | (Ver script) — Alinea criterio A/B al texto; retrieval opcional. | C2.2: no contradicción forzada con criterios inventados. |
| **F3** | Cuerpo central — Hardt/Negri, Imperio, biopolítica | Snippet centrado en tensión Singer/Hardt (Cap. 3); la respuesta sintetiza Imperio/biopolítica acorde al texto | Contraste con utilitarismo sin forzar puntuación rúbrica; sin taxonomía formal prohibida en chat |

**Otras baterías en otras fichas:** M2–M4, R1, R2 — [`CORRIDA_CALIDAD_MF_R_2026-04-28.md`](CORRIDA_CALIDAD_MF_R_2026-04-28.md). Batería **E\*** (Fase B) — ver ficha B.

---

## Puntuación por eje (0 a 1; criterio MODELO, juicio de esta corrida)

| Eje | Valor | Comentario breve |
|-----|-------|------------------|
| **C1** | **0,95** | Recuperación y uso del material comprobado en M1, M1 intro y F3; F1 útil aunque el match léxico vino de otro párrafo. |
| **C2** | **0,95** | F1 y F3 sin nota de rúbrica; sin actuar como “evaluador de entrega final” en el sentido prohibido. |
| **C3** | *N/C* | No medido (fuera de alcance Fase A). |
| **C4** | **0,90** | `pytest` **72/72** en `backend/` con `requirements.txt`; login + API OK en corrida manual; humo de auth multi-usuario y UI no re-ejecutados en esta ficha. |

**Puntuación compuesta de esta sesión (solo C1+C2+C4, con pesos del MODELO 35% / 20% / 20% sobre 75%):** renormalizando:  
0,35×0,95 + 0,20×0,95 + 0,20×0,90 ≈ **0,89** (≈**89%** de la batería parcial ejecutada, con C4.4 reforzado).

---

## Criterio “listo producto” (sección 7 del MODELO)

- Umbral sugerido ≥ 0,85: **sí a nivel de batería parcial C1–C2–C4** indicada.  
- **Pendiente:** reforzar C4 (pytest completo en entorno con `app` importable; humo de créditos) y ampliar M2–M4, R1–R2, cuando haya **dos** documentos `ready` o segunda cuenta de QA.

---

*Ficha: corrida Fase A posterior a mejoras de retrieval y políticas de chat en `teacher_context_retrieval` / `teacher_context_response_policy` y copy en `AsistenteIA.js`.*
