# Fase C — tareas (alineación operativa y cierre de huecos)

**Origen en matriz:** manifiesto/pack/servidor, observabilidad, copy, Punto 6.  
**Precondición:** A y B con entregas probadas; **E1–E3** y correcciones de C3 aceptables ([`PROTOCOLO_CALIDAD_CUMPLIMIENTO.md`](PROTOCOLO_CALIDAD_CUMPLIMIENTO.md)).

**Objetivo:** Cerrar huecos **medidos** tras A/B, sin reescribir el motor por capricho.  
**Cierre de protocolo 2026-04-28:** ficha operativa [`CORRIDA_CALIDAD_FASE_C_2026-04-28.md`](CORRIDA_CALIDAD_FASE_C_2026-04-28.md) y consolidada [`CORRIDA_CALIDAD_CONSOLIDADA_2026-04-28.md`](CORRIDA_CALIDAD_CONSOLIDADA_2026-04-28.md).

---

## 1. Manifiesto / `documents` / `teacher_context_pipeline`

- [x] Inventariar: listados filtrados por `user_id` (pack/manifest) — *decisión y tests en* `test_teacher_context_pack_isolation.py` *y comentario en* `routers/documents.py`.
- [x] Ruta de P2 “pending forever” / wire: *sin fallo medido; seguimiento si un entorno lo exhibe; pipeline + pytest en verde.*

## 2. Observabilidad (soporte / trazas)

- [x] Exposición en API de resumen de retrieval: *no añadida como endpoint nuevo; metadatos en chat ya usados en corridas. Ampliar solo con requisito de producto.*
- [x] Alinear con `request_id` / logs: *estado heredado del backend; sin cambio obligatorio en Fase C.*

## 3. Copy y expectativas (Configuración / material interno)

- [x] Revisar textos desalineados con A/B: **AsistenteIA** cabecera (integración real Mi Espacio).
- [x] Unificar con [`PROTOCOLO_CALIDAD_CUMPLIMIENTO.md`](PROTOCOLO_CALIDAD_CUMPLIMIENTO.md).

## 4. Punto 6 (matriz) — humo multi-asignatura

- [x] Mapeo **Humanidades / Ciencias / Idioma** a corridas y gaps documentados (tabla en ficha C).
- [x] **Run de idioma dedicado:** pendiente *solo* cuando haya rúbrica+entrega de referencia en el entorno (criterio explícito en ficha C; no bloquea cierre).

## 5. Cierre

- [x] Fase C en `matriz de funciones.md` con enlaces a evidencia.
- [x] “Listo cliente” MODELO §7: [`CORRIDA_CALIDAD_CONSOLIDADA_2026-04-28.md`](CORRIDA_CALIDAD_CONSOLIDADA_2026-04-28.md).

---

*Lista viva: reabrir ítems si un sprint introduce regresión o nuevos requisitos de producto.*
