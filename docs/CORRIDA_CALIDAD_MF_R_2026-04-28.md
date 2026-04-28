# Corrida — batería M3, M4 y R1, R2 (API) — 2026-04-28

**Protocolo:** [`MODELO_PRUEBA_CALIDAD_IA.md`](MODELO_PRUEBA_CALIDAD_IA.md) (C1, C2, C4)  
**Reproducción:** `python3 scripts/corrida_calidad_m3_m4_r_api.py` (mismas variables de entorno que otras corridas, sin publicar credenciales).  
**Entorno verificado:** API local `http://127.0.0.1:8000` · commit de referencia `e91bfb8` (o el vigente al repetir).  

**M2 (actualizado, misma fecha de protocolo, segunda ejecución):**  
- Subida automática de un segundo material (`guia_biologia_protocolo_m2.txt`) vía `POST /api/documents/upload` (script `scripts/corrida_calidad_m2_two_guides.py`).  
- Con **2** documentos `ready`, `documents_read: 2`, `snippets: 2`, respuesta comparando **Biología** (nueva guía) y la guía de **Filosofía** (PDF existente) en límite de 8 frases. **C1.1–C1.2** y **C2** verificados por muestreo.  
*No repetir en producción la subida de prueba sin criterio; es material de protocolo.*

---

## R — Regresión

| ID | Comprobación | Resultado (run 2026-04-28) | C4 |
|----|--------------|----------------------------|------|
| **R1** | Doble `login` + `GET /api/auth/me` | OK; `me` con mismo `user_id` en ambas sesiones | C4.1 |
| **R2** | `me` con campo de saldo (créditos) | 200; `credits_balance` presente; consumo coherente con evaluaciones y chats previos | C4.2 |

---

## M — Mi Espacio + Asistente (chat asistente_ia)

| ID | Comprobación | Resultado (run) | C1 / C2 |
|----|--------------|-----------------|--------|
| **M3** | `teacher_context_pack.documents: []` + pregunta “según guía en Mi Espacio” | 200, `success`; retrieval sin `documents_read` inútil (0) — revisión manual: respuesta no invoca criterio falso (longitud OK) | C1.3 honestidad |
| **M4** | Asignatura en contexto (Química) **disonante** con PDF indexado (Filosofía) + pregunta sobre “guía de Química” | 200, `success`; 1 doc leído; heurística de texto a favor de respuesta prudente (`honest=True` en términos vagues: no, filosof, asignatur) | C2.2, límites |

*M4 es sensible al modelo: conservar criterio humano en puntuación MODELO.*

---

## Cierre parcial batería M

- **M2** completado con script; **M1, F1, F3** en [`CORRIDA_CALIDAD_FASE_A_2026-04-27.md`](CORRIDA_CALIDAD_FASE_A_2026-04-27.md).

---

*Sin secretos de cuenta en claro. Actualizar al repetir con otro entorno o commit relevante.*
