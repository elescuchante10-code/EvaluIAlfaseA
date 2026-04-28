# Matriz de funciones (Plan por fases)

Este documento sirve para **diagnosticar** lo que ya existe y **registrar tareas pendientes** hasta llegar a un despliegue estable en producción (Coolify + Docker).

## Convenciones

- **Estado**
  - ✅ Hecho
  - 🟡 Parcial
  - ⬜ Pendiente
  - 🔴 Riesgo
- **Owner**
  - **Dev**: desarrollo (código, APIs, env vars, integración)
  - **Infra**: infraestructura (VPS, Coolify, dominios, backups)
  - **Producto**: definición funcional, reglas de negocio, flujos y validaciones

---

## Fase 0 — Diagnóstico local

**Objetivo**: confirmar stack, credenciales y ejecución en local.

- ✅ **[Dev] Frontend + Backend corriendo en local**
  - **Evidencia**: frontend `:3000` y backend `:8000` (`/health` OK).
  - **Siguiente paso**: validar flujo real (login → subir → evaluar → guardar).

- ✅ **[Producto] Usuario/contraseña de prueba documentados**
  - **Evidencia**: `juliolopez4p@gmail.com` / `password123` (por `backend/init_db.py`).
  - **Siguiente paso**: definir usuarios/roles reales para producción.

- ✅ **[Dev] Variables de entorno mínimas (local)**
  - **Evidencia**: `backend/.env` y `frontend/.env.development`.
  - **Siguiente paso**: inventario completo de envs para prod (Wompi/Groq/etc.).

### Tareas pendientes (agregar aquí)

- ✅ **[Dev/Producto] Registro 2026-04-25 — Landing + demo video + auditoría**
  - **Landing (solo UI, sin tocar motor)**:
    - Hero actualizado (nuevo título/subtítulo).
    - Navegación: eliminado tab **Resumen** (quedan Flujo, Capacidades, Workspace, Precios, FAQ).
    - Copy “sin tecnicismos”: eliminadas menciones visibles de endpoints tipo `/api/...`, JWT y rutas admin en la landing.
    - Pricing reescrito a 3 opciones:
      - Estándar $40.000 COP/mes — 500 créditos IA.
      - Institucional $2.000.000 COP/mes (aprox) — bolsa 20.000 créditos IA.
      - Pago por uso: recargas $20.000=200 créditos, $50.000=500 créditos, sin vencimiento.
    - FAQ: agregada explicación del sistema de créditos (5/10/1–2 créditos).
    - Animaciones: reveals por scroll con `IntersectionObserver` + soporte `prefers-reduced-motion`.
    - Estética: textura/grain/mesh/glows sutiles para evitar look “plano”.
  - **Demo video (compatibilidad web/Safari)**:
    - Se dejó video en `frontend/public/assets/` con MP4 liviano + poster + WebM.
    - Nota: en Safari/iOS el MP4 es el formato crítico (WebM no siempre reproduce).
  - **Auditoría de motor (sin Git)**:
    - `frontend/src/services/**` y `frontend/src/components/editor/**` sin cambios en las últimas 24h.
    - Backend importa y compila OK (`from app.main import app` OK).
    - IA: Groq implementado en `backend/app/routers/evaluate.py` y `backend/app/services/document_multimodal.py`, leyendo `GROQ_API_KEY`.
    - Alertas para producción (pendiente): `SECRET_KEY` hardcoded (`"1234"`), `ADMIN_BOOTSTRAP_PASSWORD` hardcoded, y revisar semántica de `WOMPI_EVENT_SECRET`.

- ✅ **[Dev/Producto] Landing definitiva (solo UI) — 2026-04-26**
  - **Qué quedó listo**: hero con captura raster del workspace en `public/assets/dashboard-screenshot.webp` + `.png` (generados desde maqueta de alta fidelidad), `<picture>` + `alt` largo en español, secciones Valor / Cómo funciona / Funciones / Workspace / vídeo demo opcional / Precios / FAQ, foco y `prefers-reduced-motion` reforzados; `npm run build` en `frontend/` OK; mismos callbacks `onGoLogin`, `onGoRegister`, `onSubscribe` desde la landing (`App.js` sin cambios de negocio).

---

## Fase 1 — Empaquetado Docker

**Objetivo**: “Si funciona en tu compu, funciona en el servidor”.

- ✅ **[Dev] Dockerfile backend (FastAPI)**
  - **Evidencia**: `backend/Dockerfile` (uvicorn `app.main:app`).
  - **Siguiente paso**: definir healthcheck y estrategia de workers (1 vs multiproceso).

- ✅ **[Dev] Dockerfile frontend (build + nginx)**
  - **Evidencia**: `frontend/Dockerfile` (CRA build → nginx).
  - **Siguiente paso**: ajustar API URL de producción (dominio backend / proxy).

- ✅ **[Infra] docker-compose (frontend + backend + postgres)**
  - **Evidencia**: `docker-compose.yml` validado.
  - **Siguiente paso**: decidir si usar Postgres gestionado (recomendado) vs contenedor.

### Tareas pendientes (agregar aquí)

- ✅ **[Dev] 2026-04-27 — SPA en nginx + retorno Wompi + default seguro de `WOMPI_EVENT_SECRET` (sin tocar motor `/api/evaluate`)**
  - **Nginx (`frontend/nginx/default.conf` + `Dockerfile`)**: `try_files $uri $uri/ /index.html` para que rutas como `/payment-success` no devuelvan 404 al volver del checkout.
  - **Shell (`frontend/src/App.js`)**: al cargar, detecta `/payment-success?reference=` o `/payment-cancelled`; hace polling autenticado a `GET /api/billing/wompi/payments/{reference}`, `getMe` para refrescar créditos, bandera dismissible en el dashboard; si no hay token guarda la referencia en `sessionStorage` y tras login/registro hace el mismo polling.
  - **Config (`backend/app/core/config.py`)**: `WOMPI_EVENT_SECRET` por defecto `""` (el secreto real solo por variable de entorno / panel Wompi).
  - **Para qué sirve**: experiencia de pago completa y coherente con `FRONTEND_URL` + `WOMPI_PAYMENT_*_PATH`, sin modificar evaluador, rúbricas ni prompts.

- ✅ **[Dev/Infra] 2026-04-28 — Compose “P0 repo”: persistencia + envs + healthchecks (sin tocar motor `/api/evaluate`)**
  - **`docker-compose.yml`**: volumen nombrado `backend_data:/app/data` (wiki / `data/teacher_context` bajo `WORKDIR` `/app` del backend); `postgres_data` como antes; variables vía `${VAR:-default}` (`APP_ENV`, `SECRET_KEY` ≥32 por defecto solo para local, URLs, Wompi, bootstrap vacío por defecto); `restart: unless-stopped`; healthcheck Postgres + backend (`GET /health`); frontend espera `backend` healthy; build-arg `REACT_APP_API_URL` desde env; puertos publicados configurables (`BACKEND_PUBLISH_PORT`, `FRONTEND_PUBLISH_PORT`).
  - **`docker-compose.local.example.yml`**: merge opcional para exponer Postgres en `127.0.0.1:5432` en desarrollo; instrucciones en cabecera para bind-mount `./backend/data` si se desea (evita conflicto con `backend_data` del compose principal).
  - **`.env.example`**: `POSTGRES_*`, `REACT_APP_API_URL`, puertos opcionales documentados.
  - **Qué queda fuera del repo (cierre P0 operativo)**: crear VPS/Coolify, DNS/SSL, pegar secretos reales, backups y prueba de redeploy en el servidor.
  - **Sección 6 (Punto 6 — humo evaluador)**: mapeo multi-asignatura y gap idioma en [`docs/CORRIDA_CALIDAD_FASE_C_2026-04-28.md`](docs/CORRIDA_CALIDAD_FASE_C_2026-04-28.md); no depende del compose.

---

## Fase 2 — VPS + Coolify

**Objetivo**: infraestructura y despliegue continuo por Git.

- ⬜ **[Infra] Crear VPS (Ubuntu 22.04/24.04) + acceso SSH**
  - **Evidencia**: no configurado aún.
  - **Siguiente paso**: elegir proveedor (Hetzner/DO), crear server, guardar IP/SSH key.

- ⬜ **[Infra] Instalar Coolify**
  - **Evidencia**: no instalado.
  - **Siguiente paso**: SSH → `curl -fsSL https://coollabs.io | bash` → panel `:8000`.

- ⬜ **[Infra] Conectar GitHub y desplegar Docker Compose**
  - **Evidencia**: no existe proyecto en Coolify.
  - **Siguiente paso**: Source → Project → Docker Compose → configurar env vars.

### Tareas pendientes (agregar aquí)

- ⬜ **[Infra/Dev] Persistencia obligatoria (DB + storage)**
  - **Motivo**: el cupo “Wiki docente” y su medidor dependen de datos persistentes; sin volúmenes, un redeploy puede borrar DB/archivos.
  - **DB**: usar Postgres con volumen persistente (o Postgres gestionado) + backups.
  - **Storage**: montar volúmenes persistentes para artefactos/archivos del backend (ej. `backend/data/**` / teacher context markdown).
  - **Criterio de éxito**: redeploy/restart no cambia el cupo usado ni “pierde” documentos.

### Checklist mínimo (para mañana, sin sorpresas)

- **DB persistente**:
  - Volumen para Postgres (o Postgres gestionado).
  - Backups (snapshot diario o dump) y prueba de restore.
- **Teacher-context / wiki persistente**:
  - Volumen montado para `backend/data/**` (incluye `data/teacher_context/users/{id}/...`).
  - Confirmar permisos de escritura del contenedor.
- **Prueba de redeploy**:
  - Subir 1 documento, ver cuota usada, generar markdown teacher-context.
  - Redeploy/restart → confirmar que el documento y la cuota siguen.

---

## Fase 3 — Producción (dominio, seguridad, observabilidad)

**Objetivo**: cerrar brechas típicas de pasar de “local” a “prod”.

- ⬜ **[Infra] Dominios + SSL**
  - **Evidencia**: no configurado.
  - **Siguiente paso**: asignar dominio(s) a frontend y backend (o un solo dominio con proxy).

- 🟡 **[Dev] Secretos de producción (JWT, Groq, Wompi)**
  - **Evidencia**: `.env.example` agregado; `WOMPI_EVENT_SECRET` ya no trae un default incorrecto en código (2026-04-27).
  - **Siguiente paso**: cargar valores reales en Coolify (no en git), **incluido `WOMPI_EVENT_SECRET` del panel Wompi** para validar webhooks. Rotar llaves si aplica.

- ⬜ **[Dev] CORS y URLs finales**
  - **Evidencia**: local OK; prod depende de dominio.
  - **Siguiente paso**: `ALLOWED_ORIGINS` y `FRONTEND_URL` con dominio final.

- ⬜ **[Infra] Backups / migraciones / upgrades**
  - **Evidencia**: Alembic corre al startup; no hay política de backup.
  - **Siguiente paso**: backups Postgres, ventana de deploy, estrategia de rollback.

### Tareas pendientes (agregar aquí)

- [ ] (pendiente) …

---

## Backlog (tareas sueltas por clasificar)

- [ ] …

---

## Panel de administración (dejar impecable)

**Objetivo**: que el panel admin sea **confiable, claro y seguro** para operar usuarios y créditos sin errores confusos.

### Alcance (MVP)

- **Usuarios**: listar, buscar por email, ver estado (activo/tipo/institución).
- **Creación de usuario**: crear usuario individual/institucional con validaciones claras.
- **Créditos**: ver créditos, registrar recargas/topups, ver ledger.
- **Export**: export CSV (global) desde UI.

### Checklist de calidad (impecable)

- ✅ **[Dev] Validaciones UI alineadas con backend** (2026-04-26)
  - Password mínimo **8 caracteres** (evitar error Pydantic visible).
  - Email requerido y formato válido.
  - Créditos: numérico; defaults claros.
  - **Ajustes de créditos (+/-)** desde Admin:
    - Permitir sumar **y** restar créditos (ej. `+200`, `-100`).
    - `reason` obligatorio (mínimo 2 caracteres).
    - No permitir que el saldo final quede en negativo (error humano, no JSON técnico).
  - Tipo: `individual` / `institutional` (labels consistentes).
  - Si `institutional`: `institution_name` requerido.

- ✅ **[Dev] Manejo de errores y mensajes** (2026-04-26)
  - Traducir errores técnicos (Pydantic/stack) a mensajes humanos (ej. “La contraseña debe tener mínimo 8 caracteres”).
  - Mostrar errores por campo + banner general solo si aplica.
  - Estados de carga (crear/buscar/exportar) con feedback visible.

- ✅ **[Dev] Seguridad y permisos** (2026-04-26)
  - Restringir acceso del panel admin (solo rol admin) y redirección si no autorizado.
  - Verificar que endpoints `/api/admin/*` exijan JWT + rol admin.
  - Deshabilitar bootstrap admin en prod por defecto (`APP_ENV=production` + `ADMIN_BOOTSTRAP_ALLOW_IN_PROD=false`) y rotar llaves.

- ⬜ **[Dev] UX**
  - Tabla: paginación o lazy-load si crece.
  - Búsqueda: debounce (opcional) y “sin resultados” claro.
  - Formularios: limpiar después de “crear”, y refrescar lista.
  - Accesibilidad: focus states, labels, `aria-live` para errores.

- ✅ **[Dev] Pruebas de humo (obligatorio antes de prod)** (2026-04-26)
  - Login como admin.
  - Listar usuarios.
  - Buscar usuario por email.
  - Crear usuario con password < 8 (debe bloquear en UI).
  - Crear usuario válido (reflejar en tabla).
  - Export CSV (descarga OK).
  - Ajustar créditos `+200` y verificar ledger + saldo.
  - Ajustar créditos `-100` y verificar ledger + saldo.
  - Intentar ajuste que deje saldo negativo (debe bloquearse con mensaje claro).

### Estado / notas

- ✅ **Riesgo mitigado**: validación UI para `new_password` ≥ 8 + mensajes humanos; smoke real contra backend OK.

---

## Ajuste — Límites de carga “Wiki docente” (Karpathy RAG sin vectores)

**Objetivo**: evitar “sorpresas” de costos/almacenamiento manteniendo una UX clara para profesores.

### Política propuesta (cero sorpresas)

- **Límite por archivo**: **20 MB** (PDF/DOCX/TXT).
- **Cupo total por usuario**: **100 MB** acumulados.
- **Regla**: no permitir subir si excede el cupo; mostrar mensaje humano (“Te quedan X MB disponibles”).

> Nota: se debe definir si el cupo cuenta solo el **archivo original** o también los **derivados** (texto/markdown). Recomendación MVP: contar **original** y monitorear derivados.

### Ruta de implementación (orden recomendado)

- ✅ **[Producto/Dev] Definir alcance del cupo**
  - Cupo aplica a: Mi Espacio IB / teacher context (“wiki”).
  - Qué formatos cuentan: PDF/DOCX/TXT (imágenes/escaneados se mantienen dentro del mismo límite por archivo).
  - Qué cuenta al cupo: **original** (MVP).

- ✅ **[Dev] Configuración central**
  - Variables/constantes: `MAX_FILE_MB=20`, `MAX_USER_STORAGE_MB=100`.
  - Mantener defaults seguros para local y sobreescritura por env var en prod.

- ✅ **[Dev] Enforcements backend**
  - En el endpoint de subida (ej. `/api/documents/upload`): bloquear archivos > 20MB.
  - Antes de aceptar un upload: calcular “uso actual” del usuario + tamaño del nuevo archivo; bloquear si excede 100MB.
  - Guardar en DB el `file_size_bytes` por documento y calcular el uso por usuario on-demand (suma).
  - Error API humano: `{ code: 'file_too_large'|'storage_quota_exceeded', message: '...' }`.
  - **Eliminación real**: `DELETE /api/documents/{id}` borra el documento del usuario autenticado (libera cupo real).

- ✅ **[Dev] UX frontend**
  - Mostrar el medidor **solo en Configuración**: “Almacenamiento wiki: X MB / 100 MB”.
  - Si backend rechaza por cupo: mostrar mensaje humano + sugerir borrar/archivar.
  - **Refresco automático**: al subir o eliminar, el medidor se actualiza (sin recargar) consultando de nuevo la cuota.

- ✅ **[Dev] Pruebas de humo**
  - Subir archivo de 21MB → bloquear (frontend o backend).
  - Subir múltiples archivos hasta ~100MB → el último que excede debe bloquear.
  - Eliminar un documento guardado → debe liberar cupo y el medidor debe bajar.
  - Verificar que el mensaje indique el cupo restante.

---

## Karpathy y Motor IA (calidad + privacidad)

**Objetivo**: que el chat (Asistente IA + chat contextual) use la “wiki docente” como grounding **sin mezclar datos entre profesores** y con el proveedor IA funcionando.

### Estado actual

- ✅ **[Dev] Motor IA (Groq) funcionando en local**
  - **Condición**: `GROQ_API_KEY` presente en env vars del backend.
  - **Verificación**: `POST /api/evaluate/chat` responde `success: true` (sin `llm_unconfigured`).

- 🟡 **[Dev] Karpathy (wiki) conectado a chat**
  - **Frontend**: envía `teacher_context_pack` + `teacher_context_summary` en Asistente IA y ChatBubble.
  - **Backend**: hace retrieval sin vectores (`merge_chat_context_with_teacher_snippets`) leyendo Markdown y anexando snippets + política de uso por superficie.

### Tareas para dejar impecable (prioridad)

- ✅ **[Dev] Aislamiento multiusuario (privacidad) — PRIORIDAD MÁXIMA** (2026-04-26)
  - **Qué hicimos**: API de documentos/manifiesto/markdown y borrado filtran por `Document.user_id == current_user.id`; el pack servidor en evaluación (`_build_server_teacher_pack`) solo incluye documentos del evaluador; el retrieval de Markdown en chat exige `db` + `owner_user_id` y comprueba propiedad antes de leer disco; sin usuario no se leen `.md` (evita packs manipulados sin verificación).
  - **Para qué sirve**: que dos profesores en la misma instancia no vean ni infieran contenido ajeno por IDs, manifiesto o rutas de archivo; el motor de evaluación y los prompts formales no se alteran, solo el origen y el filtrado del teacher pack y la lectura de artefactos.
  - **Evidencia**: `pytest` focal (`tests/test_evaluation_context_bundle.py`, `tests/test_teacher_context_retrieval.py`) OK.
  - **Compatibilidad**: `GET /api/documents/teacher-context/manifest` ya no lista todo el servidor, solo documentos del usuario autenticado (cambio intencional).

- ✅ **[Dev] Higiene repo — artefactos teacher-context en local** (2026-04-26)
  - **Qué hicimos**: restaurar `backend/data/teacher_context/teacher_context_manifest.json` al estado versionado cuando el pipeline local lo ensucia; borrar Markdown huérfano no versionado; añadir en `.gitignore` la carpeta `backend/data/teacher_context/md/` para que **nuevos** `.md` generados en local no aparezcan como `??` (los ya trackeados siguen en git).
  - **Para qué sirve**: evitar commits accidentales de datos de prueba / PII y diffs eternos en el manifiesto mientras el almacenamiento definitivo sigue siendo “carpeta bajo repo” en desarrollo.

- ✅ **[Dev] P2 — Namespacing de artefactos en disco (teacher-context)** (2026-04-26)
  - **Qué hicimos**: Markdown nuevo en `data/teacher_context/users/{user_id}/md/{document_id}.md`; manifiesto por usuario en `users/{user_id}/teacher_context_manifest.json`; lectura y `GET …/teacher-markdown` resuelven `context_markdown_relpath` y caen a legacy `md/{id}.md` o namespaced si falta el primero; regeneración ya no escribe un manifiesto global mezclado (no borra legacy en disco).
  - **Infra alineada**: en VPS, persistir volumen para `backend/data/**` (teacher context + cuotas); ver Fase 2 / notas de storage en esta matriz.

- ✅ **[Dev] P3 — Fallback server-pack (cross-device)** (2026-04-26)
  - **Qué hicimos**: `GET /api/documents/teacher-context/pack` (autenticado) devuelve `teacher_context_pack` solo con documentos `ready` del usuario, sin LLM ni créditos.

- ⬜ **[Dev] Observabilidad (confianza)**
  - Exponer en respuesta del chat un resumen opcional del retrieval (`documents_read`, `snippets_used`, `note`) para soporte.

---

## Punto 6 — Motor IA “Evaluador” (revisión final antes de clientes)

**Objetivo**: confirmar que el asistente se comporta como **evaluador pedagógico** (no solo “chat”), consistente para distintas asignaturas, y que el grounding por documento/rúbrica/wiki mejora precisión sin sesgos ni fugas.

### Protocolo 2026-04-28

- 🟡 **[Dev/Producto] Suite de casos por asignatura (Punto 6)**  
  - Mapeo Humanidades / Ciencias / (idioma pendiente de datos) y criterio de ampliación: [`docs/CORRIDA_CALIDAD_FASE_C_2026-04-28.md`](docs/CORRIDA_CALIDAD_FASE_C_2026-04-28.md#4-punto-6-matriz--mapeo-multi-asignatura).  
- ✅ **Grounding / motor** — evidencia en corridas A, B, MF&R y `pytest` (incl. C4.3 pack).
- ⬜ **Idioma (run dedicado)** — cuando exista rúbrica+entrega de referencia en el entorno.

---

## Fases — Potencia del motor IA (contexto Mi Espacio, Asistente, chat, evaluador)

**Objetivo de producto (sin tocar shell ni lógica de botones)**: que el mismo motor se alimente mejor del material del profesor (Mi Espacio IB) y que la **evaluación con rúbrica** siga mejorando la **eficiencia** de la retro; el **Asistente** y el **chat contextual** deben sentirse como copiloto, no como chat genérico ni como clon del evaluador formal.

**Regla**: no se intervienen todos los archivos del mapa a la vez; solo los que correspondan a la fase activa. Tras cada fase: pruebas focalizadas y, si aplica, ajuste de copy en UI.

**Modelo de prueba y calidad (ejes, pesos, casos M/F/E/R, hoja de registro, umbral “listo cliente”)**: [`docs/MODELO_PRUEBA_CALIDAD_IA.md`](docs/MODELO_PRUEBA_CALIDAD_IA.md). Registrar línea base **antes** de Fase A y repetir tras cada fase.

**Cumplimiento y estado frente al protocolo (fases, corridas, pytest, pendientes)**: [`docs/PROTOCOLO_CALIDAD_CUMPLIMIENTO.md`](docs/PROTOCOLO_CALIDAD_CUMPLIMIENTO.md) *(documento de seguimiento; actualizar al cerrar corridas o sprints).*

- **Primera corrida baseline (2026-04-28)**: registro vía navegador, carga de PDF vía API (MCP de archivos en UI no disponible de forma directa), límite de créditos en Asistente hasta top-up admin en local, verificación M1 vía `POST /api/evaluate/chat` con `documents_read: 1` y respuesta alineada al material. Ficha: [`docs/CORRIDA_CALIDAD_BASELINE_2026-04-28.md`](docs/CORRIDA_CALIDAD_BASELINE_2026-04-28.md).

### Fase A — Prioridad 1 (por dónde empezar)

- **Qué**: Mejorar **recuperación y uso de contenido** hacia los chats (`/api/evaluate/chat`): Asistente IA + Agente en el flujo (superficies `asistente_ia` / `chat_contextual`), sin mezclar con la lógica de evaluación formal por rúbrica.
- **Archivos típicos (quirúrgicos)**:
  - `backend/app/services/teacher_context_retrieval.py` — selección/fusión de snippets y límites.
  - `backend/app/services/teacher_context_response_policy.py` — instrucciones por superficie (copiloto vs evaluador).
  - `backend/app/routers/evaluate.py` — tramo `chat_agent` (cómo se compone el contexto antes del LLM).
- **Front solo si hace falta**: `AsistenteIA.js` / `ChatBubble.js` (payload o texto “nota honesta” obsoleto); `useTeacherContextPack.js` / `teacherContextPack.js` si el contrato wire cambia.
- **Validación**: `backend/tests/test_teacher_context_retrieval.py` y humo manual Asistente + chat con documentos `ready` en Mi Espacio.
- **Estado**: mejora de retrieval/policies/chat y copy Asistente **implementada**; tests backend en verde. Corrida A: [`docs/CORRIDA_CALIDAD_FASE_A_2026-04-27.md`](docs/CORRIDA_CALIDAD_FASE_A_2026-04-27.md) — script `scripts/corrida_calidad_fase_a_api.py` cubre **F1–F3** (incl. **F2**). M1–M4 y R1, R2: [`docs/CORRIDA_CALIDAD_MF_R_2026-04-28.md`](docs/CORRIDA_CALIDAD_MF_R_2026-04-28.md) (M2 vía `scripts/corrida_calidad_m2_two_guides.py`). *Seguimiento global:* [`docs/PROTOCOLO_CALIDAD_CUMPLIMIENTO.md`](docs/PROTOCOLO_CALIDAD_CUMPLIMIENTO.md).*

### Fase B — Evaluación formal (rúbrica + documento estudiante)

- **Qué**: Retroalimentación **más pertinente y menos ruido** en el flujo de evaluación con rúbrica (no el chat libre).
- **Archivos típicos**:
  - `backend/app/routers/evaluate.py` — estrategia y salida de evaluación (sin romper contratos).
  - `backend/app/services/evaluation_context_bundle.py` — qué entra al bundle formal.
  - `backend/app/services/evaluation_prompt_context.py` — bloque comprimido y política subordinada a rúbrica/documento.
- **Front cableado**: `App.js` (solo si `document_context` hacia el evaluador debe alinearse con el nuevo bundle).
- **Validación**: `test_evaluation_context_bundle.py`, `test_evaluation_prompt_context.py` + humo evaluar con rúbrica reale.
- **Estado**: ajustes C3 en `evaluation_prompt_context`, `evaluate.py` (contrato pedagógico), `evaluation_coverage_policy` **implementados**; `pytest` OK. **Batería E1–E3 (protocolo) registrada:** [`docs/CORRIDA_CALIDAD_FASE_B_2026-04-28.md`](docs/CORRIDA_CALIDAD_FASE_B_2026-04-28.md) · script `scripts/corrida_calidad_fase_b_e123.py`. *Seguimiento global:* [`docs/PROTOCOLO_CALIDAD_CUMPLIMIENTO.md`](docs/PROTOCOLO_CALIDAD_CUMPLIMIENTO.md) · [`docs/FASE_B_TAREAS.md`](docs/FASE_B_TAREAS.md).*

### Fase C — Alineación y operación

- **Qué**: Ajustes de **manifiesto/pack/servidor** si Fase A/B descubren huecos (`documents` router, `teacher_context_pipeline`); **observabilidad** opcional (retrieval en respuesta) para soporte; copy y expectativas en **Configuración** / landing interna.
- **Estado**: ✅ Cierre **protocolo 2026-04-28** — ficha: [`docs/CORRIDA_CALIDAD_FASE_C_2026-04-28.md`](docs/CORRIDA_CALIDAD_FASE_C_2026-04-28.md); consolidada MODELO §7: [`docs/CORRIDA_CALIDAD_CONSOLIDADA_2026-04-28.md`](docs/CORRIDA_CALIDAD_CONSOLIDADA_2026-04-28.md). Checklist: [`docs/FASE_C_TAREAS.md`](docs/FASE_C_TAREAS.md). *Seguimiento:* [`docs/PROTOCOLO_CALIDAD_CUMPLIMIENTO.md`](docs/PROTOCOLO_CALIDAD_CUMPLIMIENTO.md).

### Relación con otras secciones de esta matriz

- **Punto 6 (humo por asignatura)**: conviene **ejecutar o actualizar** después de Fase A y/o B, para medir tono, grounding y no invención de criterios con el motor ya reforzado.
- **Observabilidad (Karpathy)**: puede absorberse en Fase C o en un entregable pequeño independiente.
