/**
 * Capa mínima de contexto docente (Karpathy-ready, sin embeddings ni vector DB).
 *
 * Fuente de verdad actual: índice local de Mi Espacio IB (localStorage),
 * alineado con las mismas claves que `MiEspacioIB.js`.
 *
 * Evolución prevista: markdown_path, manifest legible, índices, retrieval selectivo.
 */

/** @typedef {'pending'|'ready'|'error'} MarkdownStatus */

/**
 * @typedef {Object} TeacherContextDocument
 * @property {string} document_id
 * @property {string} filename
 * @property {string} [local_id] — id de fila en Mi Espacio IB (no confundir con document_id)
 * @property {string} categoria_documental
 * @property {string|null} asignatura
 * @property {string|null} mime_type
 * @property {number|null} size_bytes
 * @property {string|null} saved_at
 * @property {number|null} paragraphs_count
 * @property {string|null} markdown_path — ruta API p.ej. /api/documents/{id}/teacher-markdown
 * @property {string|null} markdown_relpath — ruta relativa en servidor (auditoría)
 * @property {MarkdownStatus} markdown_status
 * @property {string[]} tags — reservado
 * @property {number|null} prioridad_contextual — reservado (1–5 o null)
 */

/**
 * @typedef {Object} TeacherContextManifestStub
 * @property {string} schema_version
 * @property {boolean} placeholder
 * @property {string} next_phase
 */

/**
 * @typedef {Object} TeacherContextIndex
 * @property {'teacher_context_index'} index_kind
 * @property {string} schema_version
 * @property {string} generated_at
 * @property {Record<string, TeacherContextDocument[]>} by_asignatura
 */

/**
 * @typedef {Object} TeacherContextPack
 * @property {string} schema_version
 * @property {'teacher_context_pack'} pack_kind
 * @property {'mi_espacio_ib_local_index'} source
 * @property {'none'|'manifest_only'|'markdown_selective'} retrieval_mode — índice cliente; el chat añade snippets en backend con `markdown_selective`
 * @property {string|null} asignatura_activa
 * @property {string} generated_at
 * @property {TeacherContextDocument[]} documents
 * @property {TeacherContextManifestStub} [manifest_stub] — legacy; preferir teacher_context_manifest
 * @property {object|null} teacher_context_manifest — manifiesto auditable (cliente + refs servidor)
 * @property {TeacherContextIndex|null} teacher_context_index — índice por asignatura (localStorage)
 * @property {string|null} server_manifest_url — GET backend p.ej. /api/documents/teacher-context/manifest
 */

/**
 * @typedef {Object} TeacherContextSummary
 * @property {string} schema_version
 * @property {'teacher_context_summary'} summary_kind
 * @property {string|null} asignatura_activa
 * @property {number} document_count
 * @property {string[]} filenames_preview
 * @property {string} one_liner
 * @property {string} honest_note
 */

// Debe coincidir con `MiEspacioIB.js` (misma fuente de persistencia).
const STORAGE_KEYS = {
  asignatura: 'evaluai.espacioIB.asignatura',
  filesPrefix: 'evaluai.espacioIB.persisted.v1.',
};

const FILE_STATUS_SAVED = 'Guardado';

const MAX_DOCS_WIRE = 40;
const PREVIEW_NAMES = 8;

const sanitizeAsignaturaKey = (nombre) =>
  (nombre || '_default')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/(^_|_$)/g, '') || '_default';

const loadActiveAsignatura = () => {
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem(STORAGE_KEYS.asignatura) || '';
  } catch {
    return '';
  }
};

const loadPersistedFilesForAsignatura = (asignatura) => {
  if (typeof window === 'undefined') return [];
  try {
    const key = `${STORAGE_KEYS.filesPrefix}${sanitizeAsignaturaKey(asignatura)}`;
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (f) => f && typeof f === 'object' && f.document_id && f.status === FILE_STATUS_SAVED
      )
      .map((f) => ({ ...f, asignatura: f.asignatura || asignatura }));
  } catch {
    return [];
  }
};

/** Todas las asignaturas: escanea claves `evaluai.espacioIB.persisted.v1.*` (sin depender del nombre legible). */
const loadAllPersistedFilesGlobal = () => {
  if (typeof window === 'undefined') return [];
  const out = [];
  const prefix = STORAGE_KEYS.filesPrefix;
  try {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const k = window.localStorage.key(i);
      if (!k || !k.startsWith(prefix)) continue;
      const raw = window.localStorage.getItem(k);
      let parsed;
      try {
        parsed = JSON.parse(raw || '[]');
      } catch {
        continue;
      }
      if (!Array.isArray(parsed)) continue;
      for (const f of parsed) {
        if (f && typeof f === 'object' && f.document_id && f.status === FILE_STATUS_SAVED) {
          out.push({ ...f });
        }
      }
    }
  } catch {
    return [];
  }
  return out;
};

/**
 * Dedup por `document_id`: prioriza filas con `markdown_status === 'ready'`.
 * @param {ReturnType<typeof normalizeTeacherDocumentEntry>[]} list
 */
const dedupeDocumentsById = (list) => {
  const map = new Map();
  for (const d of list) {
    const id = d.document_id;
    if (!id) continue;
    const prev = map.get(id);
    if (!prev) {
      map.set(id, d);
      continue;
    }
    const score = (x) => (x.markdown_status === 'ready' ? 2 : x.markdown_status === 'error' ? 1 : 0);
    if (score(d) > score(prev)) map.set(id, d);
  }
  return Array.from(map.values());
};

/**
 * @param {ReturnType<typeof normalizeTeacherDocumentEntry>[]} allDocs
 */
const buildTeacherContextIndex = (allDocs) => {
  /** @type {Record<string, typeof allDocs>} */
  const byAsignatura = {};
  for (const d of allDocs) {
    const key = (d.asignatura && d.asignatura.trim()) || '_sin_asignatura';
    if (!byAsignatura[key]) byAsignatura[key] = [];
    byAsignatura[key].push(d);
  }
  return {
    index_kind: 'teacher_context_index',
    schema_version: '1',
    generated_at: new Date().toISOString(),
    by_asignatura: byAsignatura,
  };
};

/**
 * Vista cliente del manifiesto (complementa el JSON canónico del backend).
 * @param {string|null} asignaturaActiva
 * @param {ReturnType<typeof normalizeTeacherDocumentEntry>[]} docsActive
 * @param {ReturnType<typeof normalizeTeacherDocumentEntry>[]} allUnique
 */
const buildClientTeacherManifest = (asignaturaActiva, docsActive, allUnique) => {
  const ready = docsActive.filter((d) => d.markdown_status === 'ready').length;
  return {
    manifest_kind: 'teacher_context_manifest',
    schema_version: '1',
    generated_at: new Date().toISOString(),
    retrieval_mode: 'manifest_only',
    asignatura_activa: asignaturaActiva || null,
    note:
      'Cliente: metadatos Mi Espacio IB. Manifiesto servidor (todos los document_id): GET /api/documents/teacher-context/manifest',
    documents_preview: docsActive.map((d) => ({
      document_id: d.document_id,
      filename: d.filename,
      categoria_documental: d.categoria_documental,
      markdown_status: d.markdown_status,
      markdown_path: d.markdown_path,
    })),
    stats: {
      documents_in_active_subject: docsActive.length,
      markdown_ready_in_active_subject: ready,
      documents_all_subjects: allUnique.length,
    },
  };
};

/**
 * Normaliza una fila del índice Mi Espacio IB hacia el contrato evolutivo del pack.
 * @param {object} raw
 * @returns {TeacherContextDocument}
 */
export function normalizeTeacherDocumentEntry(raw) {
  const id = raw?.document_id != null ? String(raw.document_id) : '';
  const mdStatus =
    raw?.markdown_status != null && String(raw.markdown_status).trim()
      ? String(raw.markdown_status).trim()
      : 'pending';
  return {
    document_id: id,
    filename: raw?.filename != null ? String(raw.filename) : '',
    local_id: raw?.id != null ? String(raw.id) : null,
    categoria_documental:
      raw?.category != null ? String(raw.category) : 'sin_clasificar',
    asignatura: raw?.asignatura != null ? String(raw.asignatura) : null,
    mime_type: raw?.type != null ? String(raw.type) : null,
    size_bytes: typeof raw?.size === 'number' ? raw.size : null,
    saved_at: raw?.savedAt != null ? String(raw.savedAt) : null,
    paragraphs_count:
      typeof raw?.paragraphsCount === 'number' ? raw.paragraphsCount : null,
    markdown_path:
      raw?.markdown_path != null && String(raw.markdown_path).trim()
        ? String(raw.markdown_path).trim()
        : null,
    markdown_relpath:
      raw?.markdown_relpath != null && String(raw.markdown_relpath).trim()
        ? String(raw.markdown_relpath).trim()
        : null,
    markdown_status: /** @type {MarkdownStatus} */ (
      mdStatus === 'ready' || mdStatus === 'error' ? mdStatus : 'pending'
    ),
    tags: Array.isArray(raw?.tags) ? raw.tags.map(String) : [],
    prioridad_contextual:
      typeof raw?.prioridad_contextual === 'number' ? raw.prioridad_contextual : null,
  };
}

/**
 * Construye el pack completo desde localStorage (sin red, sin backend).
 * No lanza: ante fallo devuelve pack vacío con bandera interna.
 * @returns {TeacherContextPack}
 */
export function buildTeacherContextPack() {
  const generatedAt = new Date().toISOString();
  try {
    const asignatura = (loadActiveAsignatura() || '').trim();
    const files = asignatura ? loadPersistedFilesForAsignatura(asignatura) : [];
    const documents = files.map(normalizeTeacherDocumentEntry);

    const allRaw = loadAllPersistedFilesGlobal();
    const allNormalized = dedupeDocumentsById(allRaw.map(normalizeTeacherDocumentEntry));
    const teacher_context_index = buildTeacherContextIndex(allNormalized);
    const teacher_context_manifest = buildClientTeacherManifest(asignatura, documents, allNormalized);

    return {
      schema_version: '1',
      pack_kind: 'teacher_context_pack',
      source: 'mi_espacio_ib_local_index',
      retrieval_mode: 'manifest_only',
      asignatura_activa: asignatura || null,
      generated_at: generatedAt,
      documents,
      manifest_stub: {
        schema_version: '1',
        placeholder: false,
        next_phase: 'markdown_selective_chat',
      },
      teacher_context_manifest,
      teacher_context_index,
      server_manifest_url: '/api/documents/teacher-context/manifest',
    };
  } catch {
    return {
      schema_version: '1',
      pack_kind: 'teacher_context_pack',
      source: 'mi_espacio_ib_local_index',
      retrieval_mode: 'manifest_only',
      asignatura_activa: null,
      generated_at: generatedAt,
      documents: [],
      manifest_stub: {
        schema_version: '1',
        placeholder: true,
        next_phase: 'markdown_manifest_index',
      },
      teacher_context_manifest: null,
      teacher_context_index: null,
      server_manifest_url: '/api/documents/teacher-context/manifest',
    };
  }
}

/**
 * @param {TeacherContextPack|null} pack
 * @returns {TeacherContextSummary|null}
 */
export function buildTeacherContextSummary(pack) {
  if (!pack) return null;
  const docs = Array.isArray(pack.documents) ? pack.documents : [];
  const preview = docs
    .slice(0, PREVIEW_NAMES)
    .map((d) => d.filename)
    .filter(Boolean);
  const asig = pack.asignatura_activa;
  const n = docs.length;
  const ready = docs.filter((d) => d.markdown_status === 'ready').length;
  const oneLiner = asig
    ? `Asignatura activa: «${asig}». ${n} documento(s) en Mi Espacio IB; ${ready} con Markdown contextual listo. El chat puede recuperar fragmentos reales de esos .md en el backend (coincidencia simple, auditable).`
    : 'No hay asignatura activa en Mi Espacio IB; el contexto docente adicional está vacío.';

  return {
    schema_version: '1',
    summary_kind: 'teacher_context_summary',
    asignatura_activa: asig,
    document_count: n,
    filenames_preview: preview,
    one_liner: oneLiner,
    honest_note:
      'Índice local + manifiesto/estado Markdown por document_id. Sin embeddings ni vector DB. Manifiesto servidor: /api/documents/teacher-context/manifest',
  };
}

/**
 * Payload acotado para el wire (evita arrays enormes en JSON).
 * @param {TeacherContextPack|null} pack
 * @returns {TeacherContextPack|null}
 */
export function teacherContextPackToWire(pack) {
  if (!pack) return null;
  const docs = Array.isArray(pack.documents) ? pack.documents : [];
  const slice = docs.slice(0, MAX_DOCS_WIRE);
  return {
    ...pack,
    documents: slice,
    wire_truncated: docs.length > MAX_DOCS_WIRE,
    wire_max_documents: MAX_DOCS_WIRE,
    /** Manifiesto legible: cliente (`teacher_context_manifest`) o stub legacy. */
    teacher_context_manifest:
      pack.teacher_context_manifest || pack.manifest_stub || null,
    teacher_context_index: pack.teacher_context_index || null,
    server_manifest_url: pack.server_manifest_url || null,
  };
}
