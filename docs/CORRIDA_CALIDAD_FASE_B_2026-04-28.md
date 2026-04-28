# Corrida de calidad — Fase B (E1–E3, eje C3) — 2026-04-28

**Entorno API:** `http://127.0.0.1:8000` (backend local)  
**Commit de referencia:** `e91bfb8` (árbol con cambios locales; re-ejecutar tras commit de cierre)  
**Protocolo:** [`MODELO_PRUEBA_CALIDAD_IA.md`](MODELO_PRUEBA_CALIDAD_IA.md) · Casos E (sección 4) · C3.1–C3.4  

**Ejecución reproducible (sin credenciales en claro):**  
- Exportar `EVALUAI_QA_EMAIL`, `EVALUAI_QA_PASSWORD`, `EVALUAI_API_BASE` (y opc. `EVALUAI_E_DOC_ID=5`)  
- `python3 scripts/corrida_calidad_fase_b_e123.py` (repositorio)  

**Cuenta:** misma de QA interna usada en baseline (email en gestión, no en git).

---

## Resumen de casos (POST `/api/evaluate/footnotes`)

| ID  | Enfoque | `formal_prompt_context_injected` | Criterios en matriz | Notas al pie | Nivel global (modelo) |
|-----|---------|-------------------------------------|--------------------|--------------|-------------------------|
| E1  | Entrega **corta**, rúbrica **Filosofía** (3 criterios tabulares) | sí | 3 | 2 | Deficiente |
| E2  | Texto con **tabla** Markdown, rúbrica **Economía** (2 criterios) | sí | 2 | 4 | Regular |
| E3  | **Matemáticas** (otra asignatura y rúbrica: procedimiento + resultado) | sí | 2 | 2 | Regular |

- **Bundle:** en los tres casos, `retrieval_used: false` (no había match Mi Espacio adicional más allá del resumen; coherente con prueba aislada).  
- **Heurístico automático** (soporte a C3, no sustituye juicio docente): criterios de matriz con lexema alineable a rúbrica; snippets con solape sustantivo con el párrafo → **1,0** en C3.1 y C3.2 por caso.

---

## Puntuación por criterio C3 (0 / 0,5 / 1) — media por caso

*Juicio de esta corrida, apoyado en criterio del MODELO y en salida estructurada (matriz + notas).*

| Caso | C3.1 Rúbrica | C3.2 Anclaje texto | C3.3 Densidad / utilidad | C3.4 Tono IB | Media C3 |
|------|----------------|--------------------|-------------------------|-------------|----------|
| E1   | 1 | 1 | 0,75 (pocos cupos, útiles) | 0,75 | **0,88** |
| E2   | 1 | 1 | 1  | 0,75 | **0,94** |
| E3   | 1 | 1 | 0,75 | 0,75 | **0,88** |

**Eje C3 (media de medias de los 3 casos): ≈ 0,90**  

*C3.3–C3.4 incluyen criterio subjetivo; una corrida con más muestras puede variar ligeramente.*

---

## C4 (regresión, misma ventana)

- `cd backend && python -m pytest` → **73 passed** (2026-04-28, mismo commit de referencia).

---

## Criterio “listo para cliente” (MODELO §7) — trazado

- Con **C3 ≈ 0,90** en batería E* y **C4.4** en verde, la Fase B queda **demostrable a nivel de protocolo** para el frente de evaluación formal (pendiente de decisión de producto si se exige batería M/R completa adicional).

## Incidentes (C4.5)

- Ninguno P0 en esta sesión; las tres evaluaciones respondieron 200 y JSON válido.

---

*Ficha vinculada a [`docs/PROTOCOLO_CALIDAD_CUMPLIMIENTO.md`](PROTOCOLO_CALIDAD_CUMPLIMIENTO.md) y a [`matriz de funciones.md`](../matriz%20de%20funciones.md).*
