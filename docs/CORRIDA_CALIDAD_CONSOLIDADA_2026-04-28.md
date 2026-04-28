# Corrida consolidada — protocolo completo (2026-04-28)

**Metodología:** [`MODELO_PRUEBA_CALIDAD_IA.md`](MODELO_PRUEBA_CALIDAD_IA.md) (secciones 1–2: ejes, pesos; sección 7: umbral “listo cliente”).

**Commit / HEAD (actualizar al commitear cambios de esta tanda):** `e91bfb8` o HEAD vigente.

**Puntuación global MODELO (sección 1):**  
\(\text{Global} = 0{,}35\,\text{C1} + 0{,}20\,\text{C2} + 0{,}25\,\text{C3} + 0{,}20\,\text{C4}\) con cada eje en \([0,1]\) según criterios §3 del MODELO.

---

## 1. Fichas y scripts por fase (trazabilidad)

| Fase / bloque | Evidencia en repo |
|---------------|-------------------|
| Baseline | [`CORRIDA_CALIDAD_BASELINE_2026-04-28.md`](CORRIDA_CALIDAD_BASELINE_2026-04-28.md) |
| **A** (M1, M1 intro, F1, **F2**, F3) | [`CORRIDA_CALIDAD_FASE_A_2026-04-27.md`](CORRIDA_CALIDAD_FASE_A_2026-04-27.md) · `scripts/corrida_calidad_fase_a_api.py` incluye **F2** (criterio de rúbrica sin nota) |
| M2–M4, R1–R2 | [`CORRIDA_CALIDAD_MF_R_2026-04-28.md`](CORRIDA_CALIDAD_MF_R_2026-04-28.md) · `scripts/corrida_calidad_m2_two_guides.py`, `corrida_calidad_m3_m4_r_api.py` |
| **B** (E1–E3) | [`CORRIDA_CALIDAD_FASE_B_2026-04-28.md`](CORRIDA_CALIDAD_FASE_B_2026-04-28.md) · `scripts/corrida_calidad_fase_b_e123.py` |
| **C** (huecos, copy, Punto 6, C4.3) | [`CORRIDA_CALIDAD_FASE_C_2026-04-28.md`](CORRIDA_CALIDAD_FASE_C_2026-04-28.md) |
| C4.4 (tests) | `cd backend && python -m pytest` — **75 passed** |

---

## 2. Puntuación por eje (síntesis; juicio a partir de corridas enlazadas)

Valores en \([0,1]\) según criterios MODELO. Donde no hubo run único, se unifica criterio humano a partir de las mismas pruebas documentadas.

| Eje | Valor (síntesis) | Base principal |
|-----|------------------|----------------|
| **C1** | **0,90** | A (M1, F3) + M2 (dos `ready`); M3 (honestidad) |
| **C2** | **0,90** | F1, **F2**, M4, políticas de chat |
| **C3** | **0,90** | B (E1–E3) |
| **C4** | **0,90** | R1–R2, R3=`pytest` **75**; C4.3 vía `test_teacher_context_pack_isolation.py` + script opcional de dos cuentas |

**Cálculo global (ilustrativo):**  
0,35×0,90 + 0,20×0,90 + 0,25×0,90 + 0,20×0,90 = **0,90** (≈ **90%** de la fórmula del MODELO).

*Nota:* Si algún eje baja por cambio de commits o de modelo LLM, repetir corridas API y ajustar solo con evidencia en nuevas fichas.

---

## 3. Criterio “listo para cliente” (MODELO §7)

| Condición MODELO | Estado (esta consolidación) |
|------------------|----------------------------|
| Global **≥ 0,85** | **Sí** (síntesis 0,90) |
| Ningún eje C1–C4 **&lt; 0,70** en la misma medición | **Sí** (todos 0,90 en síntesis) |
| Cero P0 (C4.5) en la ventana auditada | **Sí** (ningún fallo bloqueante registrado en fichas) |

Ajuste de producto reservado (umbrales distintos, o más casos) sin invalidar el protocolo: actualizar `MODELO_PRUEBA_CALIDAD_IA.md` y repetir registro en una nueva ficha `CORRIDA_CALIDAD_*`.

---

*Documento de cierre: una sola tabla de puntuación global; las corridas parciales conservan matices (p. ej. C1/C2/C4 en ficha A renormalizados solo a C1–C2–C4 de esa fase).*
