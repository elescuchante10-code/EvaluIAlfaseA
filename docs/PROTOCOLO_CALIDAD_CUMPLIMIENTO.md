# Cumplimiento del protocolo de calidad (fases A · B · C + pruebas)

**Referencia normativa:** [`MODELO_PRUEBA_CALIDAD_IA.md`](MODELO_PRUEBA_CALIDAD_IA.md) (ejes C1–C4, baterías M / F / E / R, registro de corridas, criterio “listo cliente” sección 7).  
**Matriz de producto:** [`matriz de funciones.md`](../matriz%20de%20funciones.md) (fases y Punto 6).

**Objetivo de calidad buscado:** evaluable de forma **repetible** (tests + corridas documentadas con commit), sin prometer perfección en todo texto posible, sí **techo de diseño** según criterios del MODELO.

**Última verificación automatizada (C4.4):** `cd backend && python -m pytest` → **75 passed** (HEAD de referencia: `e91bfb8` — re-ejecutar y actualizar commit tras cambios). **C4.3:** `test_teacher_context_pack_isolation.py`.

---

## 1. Por fase: qué exige el protocolo y qué queda demostrado

| Fase | Ejes MODELO (principal) | Implementación (motor / UI acordada) | Prueba automática (obligatoria en CI local) | Corrida / humo (protocolo) | Estado frente al estándar |
|------|-------------------------|----------------------------------------|---------------------------------------------|-----------------------------|----------------------------|
| **A** | C1, C2, C4 + reponderación si solo chat | Chat Asistente + contextual: retrieval léxico, políticas por superficie, `chat_agent`, copy `AsistenteIA.js` | `test_teacher_context_retrieval.py`, `test_teacher_context_response_policy.py` (+ suite completa) | A: [`CORRIDA_CALIDAD_FASE_A_2026-04-27.md`](CORRIDA_CALIDAD_FASE_A_2026-04-27.md) (M1, F1–F3 vía `corrida_calidad_fase_a_api.py`); M2–M4 y R1/R2: [`CORRIDA_CALIDAD_MF_R_2026-04-28.md`](CORRIDA_CALIDAD_MF_R_2026-04-28.md) · scripts `m2`, `m3_m4_r` (ver §4) | **Código + tests + batería M1–M4 (según ficha) y R1–R2;** batería **F1–F3** en script A. |
| **B** | C3, C4 | Evaluación formal: `PEDAGOGICAL_FEEDBACK_CONTRACT`, `evaluation_prompt_context`, `extend_feedback_prompt_lines`, `evaluation_context_bundle` (encuadre rúbrica) | `test_evaluation_prompt_context.py`, `test_evaluation_context_bundle.py`, `test_evaluation_coverage_policy.py` (+ suite) | Batería **E1, E2, E3** registrada: [`CORRIDA_CALIDAD_FASE_B_2026-04-28.md`](CORRIDA_CALIDAD_FASE_B_2026-04-28.md) (`scripts/corrida_calidad_fase_b_e123.py`) | **Código + tests + corrida E* Sí** (C3 ~0,90 en ficha; repetir tras commits grandes). |
| **C** | C1–C4 según huecos | Manifiesto/pack/servidor, observabilidad, copy, Punto 6, según matriz | Tests de `teacher_context_pipeline` / documentos + C4.3 aisl. + regresión | Ficha: [`CORRIDA_CALIDAD_FASE_C_2026-04-28.md`](CORRIDA_CALIDAD_FASE_C_2026-04-28.md); consolidada: [`CORRIDA_CALIDAD_CONSOLIDADA_2026-04-28.md`](CORRIDA_CALIDAD_CONSOLIDADA_2026-04-28.md) | **Checklist** [`FASE_C_TAREAS.md`](FASE_C_TAREAS.md) (cerrado 2026-04-28). |

---

## 2. Baterías de protocolo (M / F / E / R) — cierre mínimo recomendado

| Conjunto | Casos | Rol en el estándar | Estado en el repo (evidencia) |
|----------|-------|-------------------|--------------------------------|
| **M** | M1–M4 | C1, C2 | M1–M4: [`CORRIDA_CALIDAD_FASE_A_2026-04-27.md`](CORRIDA_CALIDAD_FASE_A_2026-04-27.md) (M1) y [`CORRIDA_CALIDAD_MF_R_2026-04-28.md`](CORRIDA_CALIDAD_MF_R_2026-04-28.md) (M2–M4, M2 requiere subida de protocolo o 2 guías reales). |
| **F** | F1–F3 | C2, C1 en flujo | F1–F3: `scripts/corrida_calidad_fase_a_api.py` + ficha A (re-ejecutar y pegar muestreo de **F2** al auditar). |
| **E** | E1–E3 | C3 | **Hecho** 2026-04-28: [`CORRIDA_CALIDAD_FASE_B_2026-04-28.md`](CORRIDA_CALIDAD_FASE_B_2026-04-28.md). Re-ejecutar al cambiar prompts de evaluación. |
| **R** | R1–R3 | C4 | R1, R2: [`CORRIDA_CALIDAD_MF_R_2026-04-28.md`](CORRIDA_CALIDAD_MF_R_2026-04-28.md) · R3: `pytest` 75. |

---

## 3. Criterio “listo para cliente” (MODELO sección 7) — trazabilidad

Condiciones propuestas en el MODELO (p. ej. puntuación global ≥ **0,85**, mínimo por eje > **0,70**, cero P0 C4.5):

| Condición | Evidencia actual |
|-----------|------------------|
| Corrida con pesos y ejes registrados | [`CORRIDA_CALIDAD_CONSOLIDADA_2026-04-28.md`](CORRIDA_CALIDAD_CONSOLIDADA_2026-04-28.md) (síntesis global MODELO) + corridas parciales enlazadas. |
| Ejes C1–C4 no por debajo del umbral mínimo | Síntesis en ficha consolidada; **C4.3:** tests + [`corrida_calidad_c43_two_accounts.py`](../scripts/corrida_calidad_c43_two_accounts.py) (humo con dos cuentas). |
| Sin P0 (C4.5) | No documentado en fichas como incidente bloqueante; **mantener** registro en futuras corridas. |

E1–E3 están registrados en [`CORRIDA_CALIDAD_FASE_B_2026-04-28.md`](CORRIDA_CALIDAD_FASE_B_2026-04-28.md). Tras cambios sustantivos en el motor, repetir `pytest` y, si aplica, el script E123.

---

## 4. Comandos de regresión (obligatorios en cada cierre de sprint que toque motor)

```bash
cd backend
pip install -r requirements.txt   # o entorno ya resuelto
python -m pytest
```

- Fallo en `pytest` → **no cumple C4.4**; corregir antes de declarar fase.

**Scripts de corrida (API, credenciales por entorno):**

- `scripts/corrida_calidad_fase_a_api.py` — M1, M1 intro, F1, F3  
- `scripts/corrida_calidad_fase_b_e123.py` — E1, E2, E3  
- `scripts/corrida_calidad_m3_m4_r_api.py` — M3, M4, R1, R2 (comprueba M2: conteo)  
- `scripts/corrida_calidad_m2_two_guides.py` — M2: sube 2.º .txt (salvo 2+ `ready` ya) y chat comparativo  
- `scripts/corrida_calidad_c43_two_accounts.py` — C4.3: dos logins, intersección de `document_id` vacía  

---

## 5. Mantenimiento tras el cierre de fases (2026-04-28)

1. Re-ejecutar `pytest` y corridas API tras cambios al motor o al modelo LLM.
2. **Punto 6 (idioma):** cuando haya rúbrica+entrega de referencia, añadir una corrida breve y enlazar desde [`CORRIDA_CALIDAD_FASE_C_2026-04-28.md`](CORRIDA_CALIDAD_FASE_C_2026-04-28.md) (Punto 6).
3. `corrida_calidad_c43_two_accounts.py` con dos cuentas reales al auditar un entorno nuevo o tras cambios en `documents` router.
4. Actualizar commit HEAD en las fichas `CORRIDA_*` al publicar.

*Documento vivo: actualizar tras cada corrida o cambio de criterio de producto.*
