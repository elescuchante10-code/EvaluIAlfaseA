# 09. Sistema Contextual Especializado

## Objetivo
Convertir `Mi Espacio IB` en la base de contexto del profesor y usar ese contexto para fortalecer:
- `Asistente IA`
- chat contextual
- evaluacion principal
- retroalimentacion especializada

Sin romper el motor actual y sin introducir complejidad innecesaria.

## Regla Critica
La politica de feedback:
- `formal`
- `menor`
- `relevante`
- `critico`

queda reservada para:
- evaluacion general del boton `Evaluar documento`
- salidas evaluativas estructuradas

No debe imponerse al chat contextual.

El chat contextual debe seguir funcionando como herramienta tactica, abierta y precisa, pero ahora con mejor grounding contextual.

## Regla Rectora
No conectar "todo el contexto" a "toda la evaluacion".

La arquitectura debe filtrar y orquestar el contexto correcto segun:
- profesor
- asignatura
- tipo documental
- unidad o tema
- tarea activa

## Compatibilidad Obligatoria Con Metodo Karpathy
Esta fase debe implementarse ya con estructura compatible con el metodo Karpathy.

Eso significa:
- sin embeddings
- sin base de datos vectorial
- sin retrieval opaco
- con documentos convertidos a Markdown
- con metadata minima pero util
- con manifiestos e indices legibles
- con recuperacion simple, controlada y auditable

Regla:
no construir una capa intermedia que luego haya que rehacer para llegar a ese modelo.

## Capas Del Sistema

### Capa 1. Teacher Context Pack
Es la memoria base del profesor por asignatura.

Se alimenta desde `Mi Espacio IB` con:
- guias
- examenes modelo
- rubricas
- unidades
- referencias
- notas docentes

Cada documento debe tener:
- archivo original
- version en Markdown
- metadata minima
- categoria documental
- prioridad contextual
- asignatura
- tema o unidad si existe
- referencia en manifiesto o indice

## Estructura sugerida
```json
{
  "teacher_context_pack": {
    "teacher_id": "user_123",
    "subject": "Filosofia",
    "documents": [
      {
        "id": "ctx_doc_001",
        "title": "Guia IB Filosofia",
        "type": "guide",
        "category": "guias",
        "markdown_ready": true,
        "priority": "high",
        "unit": "Etica",
        "tags": ["criterios", "argumentacion", "paper_1"]
      }
    ]
  }
}
```

### Capa 2. Document Intelligence Profile
Es la lectura inteligente del documento que se va a evaluar.

Debe inferir:
- `document_role`
- `content_mode`
- `source_type`
- presencia de:
  - imagenes
  - graficas
  - tablas
  - formulas
  - diagramas
  - manuscrito

## Estructura sugerida
```json
{
  "document_intelligence_profile": {
    "document_role": "student_submission",
    "content_mode": "mixed",
    "source_type": "native_text",
    "has_images": false,
    "has_charts": false,
    "has_tables": false,
    "has_formulas": false,
    "has_diagrams": false,
    "has_handwriting": false,
    "visual_evidence_relevant": false
  }
}
```

### Capa 3. Evaluation Context Bundle
Es el filtro que decide que contexto si entra en la evaluacion.

Nunca debe pasar toda la biblioteca del profesor al prompt evaluativo.

Debe seleccionar solo:
- contexto de la misma asignatura
- contexto del mismo tipo de trabajo
- contexto de la misma unidad o tema si existe
- contexto prioritario para esa tarea

## Estructura sugerida
```json
{
  "evaluation_context_bundle": {
    "subject": "Filosofia",
    "rubric_id": "rub_01",
    "document_role": "student_submission",
    "methodology": "phrase_by_phrase",
    "selected_context_docs": [
      {
        "id": "ctx_doc_001",
        "type": "guide",
        "reason": "same_subject_same_unit"
      }
    ]
  }
}
```

### Capa 4. Feedback Policy Layer
Es la capa que gobierna la retroalimentacion final segun severidad y valor pedagogico.

Aplica solo a:
- evaluacion general
- sintesis evaluativa estructurada
- salidas donde si conviene clasificar peso o gravedad

No aplica al chat contextual.

Categorias oficiales:
- `formal`
- `menor`
- `relevante`
- `critico`

## Intencion de cada categoria
- `formal`: problemas de forma, estilo, presentacion, redaccion, formato o convencion.
- `menor`: detalle que no altera de forma importante el desempeño central.
- `relevante`: falla o acierto que impacta de forma clara el criterio o la comprension.
- `critico`: problema central que compromete seriamente el criterio evaluado, la validez de la respuesta o la lectura del trabajo.

## Politica sugerida
- usar `formal` cuando la observacion mejora limpieza o precision pero no cambia la nota principal
- usar `menor` para detalles secundarios
- usar `relevante` para hallazgos que si deben pesar en la valoracion
- usar `critico` solo cuando la falla compromete seriamente la calidad de la respuesta

## Flujo Operativo Deseado

### Flujo 1. Ingesta desde Mi Espacio IB
1. El profesor sube documentos.
2. El sistema persiste el original.
3. El sistema clasifica tipo documental.
4. El sistema convierte a Markdown.
5. El sistema genera metadata minima e indice.
6. El documento entra al `teacher_context_pack`.

### Flujo 2. Uso en Asistente IA
1. El profesor abre `Asistente IA`.
2. El sistema detecta asignatura activa.
3. El sistema consulta el `teacher_context_pack`.
4. Recupera solo documentos relevantes para la consulta.
5. El asistente responde con grounding contextual.

### Flujo 3. Uso en chat contextual
1. El profesor selecciona un fragmento o pega una captura.
2. El sistema detecta la asignatura y la rubrica activa.
3. Consulta contexto filtrado del `teacher_context_pack`.
4. Usa `document_intelligence_profile` para entender mejor el tipo de evidencia.
5. El chat responde con mas precision, autenticidad y especializacion.

Regla:
- no clasifica la respuesta como `formal`, `menor`, `relevante` o `critico`
- no pierde su tono tactico y rapido
- si gana grounding contextual

### Flujo 4. Uso en Evaluar
1. El profesor abre `Evaluar`.
2. El sistema construye `document_intelligence_profile`.
3. Detecta rol documental y señales multimodales.
4. Filtra contexto relevante desde `teacher_context_pack`.
5. Arma el `evaluation_context_bundle`.
6. Ejecuta evaluacion con:
   - rubrica activa
   - metodologia
   - señales documentales
   - contexto filtrado
   - politica de feedback

## Lo Que Debe Entender El Sistema Del Documento Evaluado

### Roles documentales objetivo
- `student_submission`
- `official_exam`
- `teacher_worksheet`
- `rubric`
- `guide`
- `essay`
- `report`
- `lab_response`
- `formula_sheet`
- `generic`

### Señales documentales objetivo
- `has_images`
- `has_charts`
- `has_tables`
- `has_formulas`
- `has_diagrams`
- `has_handwriting`
- `content_mode = text_only | mixed | visual_heavy | formula_heavy`
- `source_type = native_text | scanned_printed | scanned_handwritten | mixed`

## Orden Seguro De Implementacion

### Sprint 1. Contrato contextual
Entregables:
- schema de `teacher_context_pack`
- schema de `document_intelligence_profile`
- schema de `evaluation_context_bundle`
- taxonomia de feedback oficial

### Sprint 2. Estructura compatible con Karpathy
Entregables:
- contrato de archivo Markdown por documento
- manifiesto por asignatura
- indice de documentos del profesor
- metadata minima estable
- reglas de recuperacion simple sin vectores

### Sprint 3. Asistente IA consume contexto visible
Entregables:
- `Asistente IA` lista y reconoce documentos del profesor
- contexto visible por asignatura
- primeras consultas con grounding simple

### Sprint 4. Pipeline Markdown
Entregables:
- conversion a Markdown
- metadata minima
- manifiesto por asignatura
- archivos indice

### Sprint 5. Retrieval selectivo
Entregables:
- filtro por asignatura
- filtro por tipo documental
- filtro por unidad o tema
- recuperacion para `Asistente IA`

### Sprint 6. Evaluacion contextual enriquecida
Entregables:
- `document_role` fino
- señales documentales multimodales
- chat contextual enriquecido con grounding
- contexto filtrado dentro de evaluacion
- politica de feedback conectada

## Archivos Del Sistema Que Probablemente Intervengan

### Frontend
- `frontend/src/components/MiEspacioIB.js`
- `frontend/src/components/AsistenteIA.js`
- `frontend/src/App.js`

### Backend
- `backend/app/routers/documents.py`
- `backend/app/routers/evaluate.py`
- `backend/app/services/document_router.py`
- `backend/app/services/document_multimodal.py`

## Riesgos A Evitar
- meter toda la biblioteca del profesor en todos los prompts
- conectar retrieval al evaluador antes de validarlo en `Asistente IA`
- mezclar clasificacion documental con scoring en un solo cambio
- usar contexto irrelevante que introduzca ruido
- fingir memoria activa sin pipeline real de Markdown y metadata

## Criterio De Exito
El sistema contextual se considerara bien montado solo si:
- `Mi Espacio IB` deja de ser solo biblioteca y pasa a ser fuente de contexto
- `Asistente IA` mejora con grounding real
- `Evaluar` recibe contexto filtrado, no ruido
- el sistema entiende mejor si el documento tiene texto, graficas, imagenes o formulas
- la retroalimentacion mejora en precision y especializacion sin degradar lo que ya funciona
