# Modelo de prueba y calidad — motor IA e instrumentación (EvaluAI)

**Propósito:** medir de forma repetible el salto de calidad en el uso del modelo y de toda la cadena que lo alimenta (Mi Espacio IB, Asistente, chat contextual, evaluación con rúbrica), **sin renunciar** al objetivo de producto: máximo profesionalismo para el docente, en cualquier asignatura o tipo de documento/rúbrica IB, dentro de límites técnicos y pedagógicos realistas.

**Lectura del “100%”:** no es una promesa de perfección matemática en todos los textos posibles; es el **techo de diseño**: cumplimiento pleno de los criterios de esta matriz en el conjunto de casos de referencia. La **cifra global** es una **puntuación ponderada** sobre esos criterios (y, si se desea, el **mínimo** por eje para no ocultar un fallo grave en un solo frente).

**Uso:** línea base **antes** de Fase A; repetir **después** de cada fase (A, B, C) y registrar versión/commit.

---

## 1. Ejes de calidad y pesos (recomendados)

| Eje | Peso sugerido | Qué mide |
|-----|----------------|----------|
| **C1 — Contexto Mi Espacio en chat** | 35 % | Que Asistente y chat del flujo usen **contenido** recuperable de los documentos del profesor cuando corresponda. |
| **C2 — Rol copiloto (no clon del evaluador)** | 20 % | Que el chat **no sustituya** la evaluación formal ni invente calificaciones/criterios no pedidos. |
| **C3 — Evaluación formal (rúbrica + texto)** | 25 % | Anclaje al texto del estudiante, alineación a rúbrica, tono pedagógico, **densidad** de retro (útil, no muro de texto). |
| **C4 — Fiabilidad y no regresión** | 20 % | Créditos, auth, privacidad multiusuario, tests automatizados relevantes, ausencia de errores bloqueantes en humo. |

Los pesos se pueden ajustar por sprint; si una fase solo toca C1–C2, **reponderar** la sesión de medición a esos ejes (p. ej. C1+C2+C4 = 100 % de esa sesión).

---

## 2. Escala por criterio (cada ítem 0, 0.5 o 1 punto dentro del eje)

Para cada **caso de prueba** y cada **criterio** del eje:

| Valor | Significado |
|-------|-------------|
| **1** | Cumple claramente; evidencia en la respuesta o en el comportamiento. |
| **0.5** | Cumple parcialmente o con matices aceptables. |
| **0** | No cumple o hay regresión / riesgo serio. |

**Puntuación del eje** para un caso: media de los criterios de ese eje que apliquen al caso (o suma normalizada si definís más criterios por caso).

**Puntuación global de una corrida:**  
`Σ (puntuación_eje × peso_eje)` con ejes normalizados a 0–1 antes de multiplicar por el peso (ver tabla de pesos en la sección 1).

---

## 3. Criterios detallados por eje

### C1 — Contexto Mi Espacio en chat (Asistente + flujo)

Aplicable cuando exista al menos un documento **indexado / ready** en Mi Espacio para la asignatura activa.

- **C1.1 Pertinencia:** la respuesta aborda la **pregunta concreta** del usuario; no es un discurso genérico sustituible sin leer Mi Espacio.
- **C1.2 Evidencia de uso del material:** aparece al menos una de: cita breve, paráfrasis claramente ligada al doc, referencia explícita al título o idea central del material, o **negación honesta** (“en tus documentos indexados no hay X”) si no aplica.
- **C1.3 Sin invención de contenido del profesor:** no atribuye al material del espacio afirmaciones que no puedan defenderse con lo indexado.
- **C1.4 Límites y coste:** la interacción respeta el flujo de la app (sin errores 500 por contexto desmesurado); tiempo de respuesta razonable para el caso.

### C2 — Rol copiloto

- **C2.1 No evalúa como entrega final** salvo que el usuario pida explícitamente ayuda tipo “¿cómo calificarías con esta rúbrica?” (entonces debe anclarse en rúbrica + evidencia, sin inventar nota oficial).
- **C2.2 No contradice la rúbrica activa** cuando el usuario menciona criterios; si no hay rúbrica en contexto, lo declara.
- **C2.3 Tono docente:** útil para planeación, conceptos, apoyo IB; evita tono de “veredicto judicial” en el chat libre.

### C3 — Evaluación formal (principalmente Fase B)

- **C3.1 Alineación a rúbrica:** los criterios tratados coinciden con los de la rúbrica provista; no aparecen criterios inventados.
- **C3.2 Anclaje al texto del estudiante:** las observaciones remiten a fragmentos o ideas del documento evaluado.
- **C3.3 Densidad de retro:** retro útil sin redundancia excesiva; no “relleno” repetitivo (subjetivo: usar escala 0/0.5/1 con ancla escrita por producto).
- **C3.4 Tono y IB:** apropiado para contexto escolar IB (sin infantilizar ni ser opaco).

### C4 — Fiabilidad y no regresión

- **C4.1 Autenticación y sesión:** login, `me`, expiración manejada sin estado corrupto.
- **C4.2 Créditos:** consumo coherente con política actual; mensajes claros si no hay créditos.
- **C4.3 Privacidad multiusuario:** usuario A no ve datos de Mi Espacio / manifiesto de usuario B (humo con dos cuentas si aplica).
- **C4.4 Tests automatizados:** `pytest` (o subset acordado) en verde en lo tocado por la fase.
- **C4.5 Registro de incidentes:** cero bloqueantes P0 en la corrida (definición: imposibilita flujo principal docente).

---

## 4. Batería mínima de casos (plantilla)

Ajustar textos a vuestros documentos reales. Numerar cada corrida (fecha, commit, responsable).

### Conjunto M — Mi Espacio + Asistente IA

| ID | Precondición | Prompt / acción | Qué observar (C1, C2) |
|----|----------------|-----------------|------------------------|
| M1 | 1 doc `ready`, asignatura X | Pregunta que **solo** se responde bien leyendo ese doc (ej. “¿Qué criterio de evaluación aparece en mi guía subida sobre …?”) | C1.1–C1.3 |
| M2 | 2 docs distintos, misma asignatura | Pregunta que obligue a **elegir o sintetizar** entre ambos | C1.1, C1.2 |
| M3 | Sin docs o ninguno `ready` | Misma familia de pregunta que en M1 | C1.3 (honestidad), C2 |
| M4 | Asignatura distinta a la del doc | Pregunta sobre el doc “equivocado” | C2.2, honestidad de límites |

### Conjunto F — Flujo (chat contextual + documento/rúbrica)

| ID | Precondición | Prompt / acción | Qué observar |
|----|----------------|-----------------|---------------|
| F1 | Rúbrica activa + documento cargado | Pedir **sugerencia de mejora** de un párrafo sin pedir nota | C2.1, C2.3 |
| F2 | Misma sesión | Pedir explícitamente “¿qué criterio de la rúbrica aplica aquí?” | C2.2, C1 si aplica pack |
| F3 | Documento largo | Pregunta sobre **sección media o final** (no solo introducción) | C1.2 anclaje al contenido del trabajo |

### Conjunto E — Evaluación formal (activar tras Fase B o línea base previa)

| ID | Precondición | Acción | Qué observar (C3) |
|----|----------------|--------|-------------------|
| E1 | Rúbrica + entrega corta | Evaluar | C3.1–C3.4 |
| E2 | Rúbrica + entrega con tabla o gráfico (si disponible) | Evaluar | C3.2, C3.4 |
| E3 | Rúbrica distinta (otra asignatura) | Evaluar | C3.1, generalización |

### Conjunto R — Regresión (cada fase)

| ID | Acción | Qué observar (C4) |
|----|--------|-------------------|
| R1 | Login + logout + login | C4.1 |
| R2 | Acción que consume créditos (según política) | C4.2 |
| R3 | `pytest` acordado | C4.4 |

---

## 5. Hoja de registro (plantilla)

Copiar por corrida.

```
Fecha:
Commit / rama:
Fase medida (A / B / C / baseline):

Puntuaciones por eje (0–1):
  C1: __   C2: __   C3: __   C4: __

Puntuación global (pesos tabla sección 1): __ %

Notas (fallos concretos, capturas, IDs de caso M/F/E/R):
```

---

## 6. Relación con las fases del roadmap

| Fase | Ejes que deben moverse principalmente |
|------|--------------------------------------|
| **A** | C1, C2, C4 (C4 por regresión). |
| **B** | C3, C4. |
| **C** | C1–C4 según observabilidad, pipeline, copy; C4 siempre. |

**Punto 6** de la matriz (humo por asignatura) puede alimentar **nuevos casos E*** y ampliar M/F con más disciplinas sin cambiar la lógica de puntuación.

---

## 7. Criterio de “listo para cliente” (propuesta)

- Puntuación global **≥ 0,85** en la batería M+F+R con los pesos de la sección 1, **y**
- **Ningún** eje C1–C4 por debajo de **0,70** en esa misma corrida, **y**
- Sin incidentes P0 en C4.5.

Ajustable por decisión de producto.

---

*Documento vivo: actualizar pesos, casos y umbrales según aprendizaje tras cada fase.*
