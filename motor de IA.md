# Motor de IA — matriz de mejoras (EvaluaIA)

Esta matriz resume los **componentes del motor de IA** que impactan directamente la **retroalimentación** (evaluación formal + chat), con foco en lo implementado/mejorado recientemente: **marco multi‑asignatura** y **retrieval local TF‑IDF** (sin embeddings) y cómo se integra con el **pipeline visual/multimodal** existente.

## Matriz (componentes → aporte a la retroalimentación)

| Área | Componente / función | Archivo(s) | Qué hace | Aporte / mejora | Señales / salida |
|---|---|---|---|---|---|
| Evaluación formal (prompt) | `build_formal_evaluation_prompt_context` + `_REFERENCE_CONTEXT_POLICY` (actualizado) | `backend/app/services/evaluation_prompt_context.py` | Construye el bloque de contexto formal a partir del bundle auditable (rúbrica resumida, asignatura, perfil, snippets del profesor). | **Marco multi‑asignatura**: el evaluador no presupone IB ni una materia fija; se guía por **rúbrica + trabajo + material del profesor**. Reduce sesgo de “IB por defecto” y mejora consistencia entre asignaturas. | Texto del bloque formal incluye **MARCO MULTI‑ASIGNATURA** y recordatorio en `=== DATOS DE LA EVALUACIÓN ===`. |
| Evaluación formal (router) | Encabezado neutro del bloque formal (`formal_ib_block` → “referencia del profesor”) | `backend/app/routers/evaluate.py` | Inserta el bloque formal en prompts de evaluación (incl. documento largo / cobertura). | Evita contradicción semántica (“IB complementario”) cuando el sistema opera multi‑asignatura. | Prompt muestra `CONTEXTO DE REFERENCIA DEL PROFESOR (evaluación formal)` si hay bloque formal. |
| Retrieval (chat + evaluación formal) | `build_teacher_context_snippets_bundle` + TF‑IDF rerank | `backend/app/services/teacher_context_retrieval.py` `backend/app/services/teacher_context_tfidf.py` | Selecciona y arma fragmentos desde Markdown del profesor (Mi Espacio IB) y reordena candidatos con **TF‑IDF** cuando hay 2+ resultados. | **Mejora de ranking local y barata**: mejor ordenamiento de fragmentos relevantes (sin embeddings), especialmente útil cuando hay varios párrafos/documents candidatos. | `retrieval_mode`: `markdown_selective_tfidf` cuando aplica; flag `tfidf_rerank_applied: true`. |
| Retrieval (TF‑IDF core) | `tfidf_cosine_similarities` | `backend/app/services/teacher_context_tfidf.py` | Calcula similitud coseno TF‑IDF (consulta vs fragmentos) con `TfidfVectorizer` (1–2 grams). | Señal estadística más robusta que simple solape de tokens; mejora orden en empates o coincidencias débiles. | Vector de similitudes \([0,1]\) por fragmento; usado para reordenar. |
| Retrieval (fusión scores) | `blend_lexical_and_tfidf` + `rerank_scored_snippets` | `backend/app/services/teacher_context_tfidf.py` | Combina score léxico existente (`_sort`) con coseno TF‑IDF (numpy) y reordena establemente. | Mantiene heurísticas de seguridad (ownership/pack/doc bonus) pero añade ranking más fino sin cambiar el pipeline de extracción. | Orden reescrito y `tfidf_rerank_applied`. |
| Evaluación formal (bundle auditable) | `build_evaluation_context_bundle` (marca TF‑IDF en debug) | `backend/app/services/evaluation_context_bundle.py` | Produce el bundle “shadow” para evaluación formal, incluyendo snippets y debug de retrieval. | Aumenta trazabilidad: deja constancia de si TF‑IDF fue aplicado. | `tfidf_rerank_applied`, `teacher_context_retrieval_debug.tfidf_rerank_applied`, `retrieval_confidence=heuristic_keyword_tfidf`. |
| Evaluación formal (fallback opcional) | `build_evaluation_context_with_retrieval` (rerank solo snippets si hace falta) | `backend/app/services/evaluation_prompt_context.py` | Formatea el bloque formal y, si el bundle no marca TF‑IDF pero hay varios snippets y hay `query/subject`, puede reordenar **solo** por TF‑IDF. | Protege contra integraciones futuras donde el bundle llegue sin el flag: conserva calidad del ranking sin re‑leer disco. | Reordena `bundle["teacher_context_snippets"]` en memoria si aplica. |
| Visión / OCR (existente) | `_vision_request_for_candidates` + `_ocr_request_for_candidates` + `_transcription_request_for_candidates` | `backend/app/services/document_multimodal.py` | Envía imágenes (data URL base64) al **modelo multimodal** (`VISION_MODEL` vía Groq) para: resumen de figura, OCR simple, o transcripción conservadora (incl. manuscrito). | Permite retroalimentación sobre exámenes con **gráficas / fórmulas / manuscrito** sin instalar PyTorch/TensorFlow local. | `visual_context` (resúmenes/relevancia) + `transcribed_paragraphs` y `source_type` (`scanned_handwritten|mixed|...`). |
| Visión → prompt de evaluación (existente) | `build_visual_context_prompt` | `backend/app/routers/evaluate.py` | Convierte `visual_context` en un bloque breve y controlado (“usar solo como complemento”). | Reduce alucinación: fuerza a que lo visual complemente el texto, no lo reemplace. | Bloque `CONTEXTO VISUAL` en prompts cuando hay evidencia visual. |
| Costeo / control (existente) | `get_action_cost(..., has_image=...)` | `backend/app/services/credits.py` | Ajusta costo/acción cuando hay imagen. | Control operativo de uso cuando se activa visión. | Costos por acción con `has_image`. |

## Dependencias agregadas (retrieval TF‑IDF)

- `numpy==2.2.4`
- `scikit-learn==1.6.1`

Archivo: `backend/requirements.txt`

## Notas y límites (para decisiones de producto)

- **TF‑IDF no reemplaza embeddings**: mejora **moderada** en reformulaciones, metáforas o sinónimos; su fortaleza es ranking barato cuando hay múltiples candidatos léxicamente relacionados.
- **Visión/OCR actual no requiere PyTorch/TensorFlow**: la lectura visual se realiza vía **modelo multimodal** (Groq `VISION_MODEL`), y el backend actúa como orquestador (extrae imágenes, arma prompts y normaliza resultados).
- **PDF “solo imagen”**: si un PDF no trae capa de texto, el flujo depende de visión/transcripción; si trae texto seleccionable, suele bastar con texto + contexto visual como complemento.

