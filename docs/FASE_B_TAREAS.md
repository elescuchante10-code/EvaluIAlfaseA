# Fase B — lista de tareas (evaluación formal con rúbrica + documento del estudiante)

**Objetivo de producto:** mejores notas al pie y matriz de evaluación: **más alineación con la rúbrica, menos ruido**, anclaje al texto entregado, con el contexto formal (bundle / Mi Espacio / perfil de documento) usado de forma **subordinada** — sin sustituir rúbrica ni inventar criterios.

**Criterios de calidad a cubrir (MODELO, eje C3):** C3.1 criterios de rúbrica, C3.2 anclaje al texto, C3.3 densidad de retro, C3.4 tono IB.

**Cumplimiento frente a todas las fases (qué está probado y qué falta):** [`PROTOCOLO_CALIDAD_CUMPLIMIENTO.md`](PROTOCOLO_CALIDAD_CUMPLIMIENTO.md).

**Regla heredada de Fase A:** cambios **quirúrgicos**; no tocar shell de pagos ni rutas ajenas a `/api/evaluate/*` salvo acople necesario con `App.js` si el contrato de `document_context` se ajusta.

---

## 1. Mapeo y trazas (lectura, sin tocar aún)

- [x] Trazar flujo completo: `POST /api/evaluate/` (HTML legacy) y `POST /api/evaluate/footnotes` → `build_evaluation_context_bundle` → `build_formal_evaluation_prompt_context` → `evaluate_document_with_strategy` → `evaluate_short_document` / `evaluate_long_document` (cómo se inyecta `formal_ib_block` y el user prompt con rúbrica + párrafos). *Nota: `_legacy_shadow_context_bundle` es un try/except delgado sobre `build_evaluation_context_bundle`; no hay dos lógicas distintas de bundle.*
- [ ] Localizar dónde se fija **métodología, disciplina, tipo de documento, coverage** (`evaluation_coverage_policy`, `build_methodology_prompt`, `detect_discipline`, etc.) y su impacto en longitud/ruido de notas. *(Pendiente siguiente iteración.)*
- [x] Revisar `_legacy_shadow_context_bundle` vs `build_evaluation_context_bundle` (cuándo cada uno) para no mejorar un camino y dejar el otro desalineado.
- [ ] Revisar contrato que envía el front (`App.js` / `CentralEvaluator`) en `document_context` y rúbrica, según `EvaluateRequest` / payloads reales.

---

## 2. `evaluation_context_bundle.py` (bundle auditable y contenido mínimo útil)

- [ ] Auditar: campos `subject`, `document_role`, `teacher_context_snippets`, `retrieval_used`, exclusión del documento bajo evaluación (`_filter_pack_exclude_self`), y límites de rúbrica.
- [ ] Ajustar **qué** entra al bundle si Fase B detecta huecos: p. ej. criterios explícitos o resumen estructurado *solo* si baja riesgo de fuga o contradicción (sin duplicar la rúbrica entera al LLM otra vía distinta a la del prompt principal).
- [ ] Validar con tests: extender o ajustar `test_evaluation_context_bundle.py` por cada regla nueva.

---

## 3. `evaluation_prompt_context.py` (lo que *sí* se deriva al prompt formal)

- [x] Releer y endurecer/afilar `_FORMAL_CONTEXT_POLICY` (C3: criterios de rúbrica sin inventar; `snippet` anclado al texto; tono IB; severidades solo en evaluación formal).
- [x] Inyectar **encuadre mínimo** desde `rubric_active_summary` (título + preview acotado) para que el bloque formal se emita aunque no haya asignatura/snippets — sin duplicar la rúbrica completa del prompt principal.
- [ ] Revisar límites: `MAX_FORMAL_SNIPPETS`, `MAX_SNIPPET_CHARS`, resumen de perfil (tablas, gráficos, etc.) — *sin cambio en esta iteración.*
- [x] Asegurar coherencia con Fase A: el chat usa políticas de copiloto; **aquí** las etiquetas FORMAL/MENOR/RELEVANTE/CRÍTICO son solo evaluación formal.
- [x] Validar con `test_evaluation_prompt_context.py` (+1 test de encuadre solo con `rubric_active_summary`).

---

## 4. `evaluate.py` — evaluación (estrategia corta/larga y prompts)

- [x] Reforzar `PEDAGOGICAL_FEEDBACK_CONTRACT` (C3: nombres de criterio en matriz alineados a la rúbrica; tono IB; `snippet` con lenguaje del párrafo). Aplica a documento corto, chunks y pasada global vía el mismo bloque inyectado.
- [ ] Revisar inyección de `formal_evaluation_context_prompt` y bloques de contexto visual (orden y peso) — *sin cambio estructural en esta iteración.*
- [x] Sin tocar créditos, `request_id` ni contrato JSON de respuesta.
- [x] Regresión: suite `backend/tests` en verde.

---

## 5. Política de cobertura y anclaje

- [x] `extend_feedback_prompt_lines`: línea de **síntesis C3** para `evaluation_matrix` (evitar fortalezas/debilidades genéricas de relleno; anclaje a rúbrica y notas).
- [ ] `footnote_anchor_quality.py` / severidades: pendiente si la batería E1–E3 muestra anclas flojas.
- [x] `test_evaluation_coverage_policy.py` — aserciones sobre la nueva línea en el presupuesto de feedback.

---

## 6. Front (solo si aplica el contrato)

- [ ] `App.js` (y flujo hacia el evaluador): verificar `document_context` (ids, rúbrica, hints de página) alineado con lo que B espera.
- [ ] `CentralEvaluator.js` o equivalente: no cambiar UX salvo copy o un campo faltante que B requiera explícitamente.
- [ ] Nada de tocar Wompi/shell salvo que un bug bloquee la evaluación (fuera de alcance típico B).

---

## 7. Calidad y regresión (MODELO)

- [x] Corrida de calidad con **batería E** (E1, E2, E3) + registro — [`CORRIDA_CALIDAD_FASE_B_2026-04-28.md`](CORRIDA_CALIDAD_FASE_B_2026-04-28.md); script: `scripts/corrida_calidad_fase_b_e123.py`.
- [x] `pytest` completo en `backend/` en verde (última comprobación: 73 passed).
- [ ] Opcional: re-ejecutar o ampliar **Punto 6** (smoke por asignatura) cuando B estabilice.

---

## 8. Cierre de Fase B

- [x] [`matriz de funciones.md`](../matriz%20de%20funciones.md) y [`PROTOCOLO_CALIDAD_CUMPLIMIENTO.md`](PROTOCOLO_CALIDAD_CUMPLIMIENTO.md) actualizados con E1–E3.
- [x] Handoff a Fase C y M restantes: ver [`PROTOCOLO_CALIDAD_CUMPLIMIENTO.md`](PROTOCOLO_CALIDAD_CUMPLIMIENTO.md) (M2, C4.3, Punto 6) y [`FASE_C_TAREAS.md`](FASE_C_TAREAS.md).

---

*Creada como lista de trabajo para Fase B; afinar el orden y el alcance en el primer sprint de implementación.*

### Registro de iteraciones

| Fecha (aprox.) | Qué se hizo | C3 / pruebas |
|----------------|-------------|----------------|
| 2026-04-27 | Política formal reforzada; línea de encuadre desde `rubric_active_summary`; `test_formal_prompt_includes_rubric_encadre_when_only_rubric_summary` | `pytest` `test_evaluation_prompt_context` + suite `backend/tests` en verde (73). |
| 2026-04-27 | `PEDAGOGICAL_FEEDBACK_CONTRACT` + alineación C3; `extend_feedback_prompt_lines` con síntesis `evaluation_matrix` | `pytest` 73 passed. |

---

## Próximos pasos (orden sugerido: implementación + calidad)

1. **Calidad primero (MODELO, Fase B = C3 + C4):** ejecutar batería **E1–E3** (rúbrica + entregas; al menos un caso con tabla/gráfico si el material existe). Registrar puntuación C3.x en `docs/CORRIDA_CALIDAD_FASE_B_<fecha>.md` (plantilla sección 5 de [`MODELO_PRUEBA_CALIDAD_IA.md`](MODELO_PRUEBA_CALIDAD_IA.md)). Añadir **commit/rama** en la ficha. Sin corrida C3, Fase B no está “demostrable” frente al protocolo.

2. **Implementación pendiente en código (según riesgo):**
   - **§1** — Documentar o ajustar tras E*: cómo `methodology` + `discipline` + `build_feedback_budget` interactúan (solo si E* muestra ruido o incomodidad de tono).
   - **§2** — Bundle: auditoría de campos; tests extra en `test_evaluation_context_bundle.py` *solo* si al medir C3.1 faltan señales en el bundle o hay fugas.
   - **§4** — Reordenar o acortar bloque visual vs. `formal_ib_block` *solo* si E* o revisión de prompt muestra abrumo del modelo.
   - **§5** — `footnote_anchor_quality`: iterar *solo* si E* marca anclas flojas o severidad mal calibrada.
   - **§6** — Front: verificar `document_context` / payload del evaluador *solo* si E* falla por datos no llegando al backend.

3. **C4** — Tras cambios: `pytest` completo; opcional R1–R2 (auth/créditos) en la misma ventana de corrida.

4. **Cierre** — Sección 8: actualizar `matriz de funciones.md` (Fase B) + handoff a **Fase C** (manifiesto, observabilidad) cuando C3 y regresión estén verdes.

5. **Punto 6 (matriz)** — Humo multi-asignatura **después** de E* estable, no antes.
