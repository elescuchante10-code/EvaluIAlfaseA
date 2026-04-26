import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
//  Mi Espacio IB — Workspace docente IB (Fase D: persistencia real)
//
//  Contrato honesto:
//  - Requiere asignatura activa para habilitar la dropzone.
//  - Al subir, envía el archivo real al backend (endpoint /api/documents/upload
//    expuesto desde App.js como prop `onUploadDocument`).
//  - Si el backend confirma persistencia, el archivo queda "Guardado" con su
//    `document_id` real. En localStorage sólo se indexa metadata de archivos
//    cuya persistencia ya fue confirmada por el backend.
//  - Si falla, queda "Error" con mensaje real del backend. Nada se maquilla.
//  - NO toca `currentDocument`, NO abre `CentralEvaluator`, NO cambia a Evaluar.
//  - La re-clasificación por tipo documental vive en el índice local (aún no hay
//    soporte backend específico para categorías del Espacio IB).
// ─────────────────────────────────────────────────────────────────────────────

const STORAGE_KEYS = {
  asignatura: 'evaluai.espacioIB.asignatura',
  // Cambiamos el prefijo respecto a la fase previa, porque la forma del
  // registro cambió (ya no es metadata sin archivo; ahora cada entrada
  // representa un documento persistido en backend con `document_id`).
  filesPrefix: 'evaluai.espacioIB.persisted.v1.',
};

const CATEGORIAS = [
  {
    id: 'guias',
    label: 'Guías',
    singular: 'Guía',
    icon: '📘',
    hint: 'Guías de la asignatura y lineamientos oficiales IB.',
    accent: '#818cf8',
  },
  {
    id: 'examenes',
    label: 'Exámenes',
    singular: 'Examen',
    icon: '📝',
    hint: 'Exámenes previos, modelos y pruebas de práctica.',
    accent: '#f472b6',
  },
  {
    id: 'rubricas',
    label: 'Rúbricas',
    singular: 'Rúbrica',
    icon: '📋',
    hint: 'Rúbricas activas usadas por el módulo Evaluar.',
    accent: '#60a5fa',
  },
  {
    id: 'unidades',
    label: 'Unidades',
    singular: 'Unidad',
    icon: '📚',
    hint: 'Unidades didácticas, secuencias y planes de clase.',
    accent: '#34d399',
  },
  {
    id: 'referencias',
    label: 'Referencias',
    singular: 'Referencia',
    icon: '🔖',
    hint: 'Material de apoyo, artículos y bibliografía.',
    accent: '#fbbf24',
  },
];

const CATEGORIA_SIN_CLASIFICAR = 'sin_clasificar';

// Estados oficiales del ciclo de vida de un archivo en Mi Espacio IB.
const FILE_STATUS = {
  uploading: 'Subiendo',
  saved: 'Guardado',
  error: 'Error',
};

const formatSize = (bytes) => {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const sanitizeAsignaturaKey = (nombre) =>
  (nombre || '_default')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/(^_|_$)/g, '') || '_default';

const loadAsignaturaInicial = () => {
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem(STORAGE_KEYS.asignatura) || '';
  } catch {
    return '';
  }
};

// Sólo cargamos/guardamos archivos cuya persistencia ya fue confirmada por el
// backend (tienen `document_id` real). Transients (Subiendo / Error) NO se
// persisten: morirían como "Guardado" al recargar y sería una mentira.
const loadFilesForAsignatura = (asignatura) => {
  if (typeof window === 'undefined') return [];
  try {
    const key = `${STORAGE_KEYS.filesPrefix}${sanitizeAsignaturaKey(asignatura)}`;
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (f) => f && typeof f === 'object' && f.document_id && f.status === FILE_STATUS.saved
      )
      // Datos persistidos legacy podrían no traer `asignatura`; lo reconstruimos
      // a partir de la clave. Así el filtrado en UI por asignatura activa es
      // siempre honesto aunque los datos antiguos no lo supieran.
      .map((f) => ({ ...f, asignatura: f.asignatura || asignatura }));
  } catch {
    return [];
  }
};

// Persiste en localStorage SÓLO los `Guardado` cuya `asignatura` coincide con
// la clave objetivo. El filtrado por asignatura es defensivo: `files` en
// memoria puede contener entradas de otras asignaturas (transitorias vivas o
// tardías) y no queremos reclasificarlas incorrectamente en la storage de la
// asignatura activa.
const persistFilesForAsignatura = (asignatura, files) => {
  if (typeof window === 'undefined') return;
  try {
    const key = `${STORAGE_KEYS.filesPrefix}${sanitizeAsignaturaKey(asignatura)}`;
    const persistibles = (files || []).filter(
      (f) =>
        f.document_id &&
        f.status === FILE_STATUS.saved &&
        (!f.asignatura || f.asignatura === asignatura)
    );
    window.localStorage.setItem(key, JSON.stringify(persistibles));
  } catch {
    /* silencioso: no debe romper la UI */
  }
};

// Mergea una entrada `Guardado` recién completada contra lo persistido para
// SU asignatura original (no la activa). Se usa cuando una subida termina
// después de que el profesor cambió de asignatura: el documento debe quedar
// indexado en la asignatura correcta, aunque ya no sea la visible.
const mergeSavedIntoStorage = (asignaturaName, entry) => {
  if (typeof window === 'undefined') return;
  if (!asignaturaName || !entry || !entry.document_id) return;
  try {
    const key = `${STORAGE_KEYS.filesPrefix}${sanitizeAsignaturaKey(asignaturaName)}`;
    const existentes = loadFilesForAsignatura(asignaturaName);
    const hayYa = existentes.some((x) => x.document_id === entry.document_id);
    const siguiente = hayYa
      ? existentes.map((x) => (x.document_id === entry.document_id ? entry : x))
      : [...existentes, entry];
    window.localStorage.setItem(key, JSON.stringify(siguiente));
  } catch {
    /* silencioso */
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  Componente principal
// ─────────────────────────────────────────────────────────────────────────────

export default function MiEspacioIB({
  asignaturasSugeridas = [],
  rubricas = [],
  onAbrirPanelRubricas,
  onCrearRubrica,
  onUploadDocument, // (file) => Promise<{document_id, filename, status, paragraphs_count}>
}) {
  const [asignatura, setAsignatura] = useState(loadAsignaturaInicial);
  const [editandoAsignatura, setEditandoAsignatura] = useState(
    () => !loadAsignaturaInicial()
  );
  const [draftAsignatura, setDraftAsignatura] = useState('');
  // `files` contiene archivos persistidos (status='Guardado') Y archivos en
  // tránsito (status='Subiendo' / 'Error'). Sólo los 'Guardado' se escriben a
  // localStorage.
  const [files, setFiles] = useState(() =>
    loadFilesForAsignatura(loadAsignaturaInicial())
  );
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef(null);

  const tieneAsignatura = Boolean(asignatura);
  const canUpload = tieneAsignatura && typeof onUploadDocument === 'function';

  // Persistencia del nombre de asignatura
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (asignatura) {
        window.localStorage.setItem(STORAGE_KEYS.asignatura, asignatura);
      }
    } catch {
      /* noop */
    }
  }, [asignatura]);

  // Persistencia de índice local (sólo archivos realmente guardados)
  useEffect(() => {
    persistFilesForAsignatura(asignatura, files);
  }, [asignatura, files]);

  // Notifica a Asistente IA / chat contextual que el índice docente cambió (misma pestaña).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent('evaluai:teacher-context-changed'));
  }, [asignatura, files]);

  const sugerenciasAsignatura = useMemo(() => {
    const base = (asignaturasSugeridas || [])
      .map((a) => (typeof a === 'string' ? a : a?.nombre))
      .filter(Boolean);
    const ibFallback = [
      'Historia NS',
      'Literatura NM',
      'Biología NS',
      'Matemáticas AA NS',
      'Teoría del Conocimiento',
      'Economía NM',
    ];
    return Array.from(new Set([...base, ...ibFallback]));
  }, [asignaturasSugeridas]);

  const startEditAsignatura = useCallback(() => {
    setDraftAsignatura(asignatura || '');
    setEditandoAsignatura(true);
  }, [asignatura]);

  // Cambio de asignatura blindado: NO perdemos entradas transitorias
  // (`Subiendo` / `Error`) en vuelo, aunque pertenezcan a la asignatura
  // anterior. Así `uploadSingleFile` puede cerrar su ciclo aunque el profesor
  // ya esté viendo otra asignatura, y la subida queda indexada honestamente
  // en su asignatura original.
  const switchAsignatura = useCallback((nombre) => {
    setAsignatura(nombre);
    setFiles((prev) => {
      const transitoriosVivos = (prev || []).filter(
        (f) =>
          f.status === FILE_STATUS.uploading || f.status === FILE_STATUS.error
      );
      const guardadosNueva = loadFilesForAsignatura(nombre);
      // Evita colisiones de id entre lo que ya viene del storage y lo que
      // sigue vivo en memoria (aunque los ids son prefijados distinto:
      // transitorios usan `f_...` y los guardados cargados traen su propio
      // id persistido, cubrimos el caso defensivamente).
      const idsVivos = new Set(transitoriosVivos.map((f) => f.id));
      const guardadosLimpios = guardadosNueva.filter((f) => !idsVivos.has(f.id));
      return [...transitoriosVivos, ...guardadosLimpios];
    });
    setEditandoAsignatura(false);
  }, []);

  const commitAsignatura = useCallback(() => {
    const nombre = draftAsignatura.trim();
    if (!nombre) {
      setEditandoAsignatura(false);
      return;
    }
    if (nombre === asignatura) {
      setEditandoAsignatura(false);
      return;
    }
    switchAsignatura(nombre);
  }, [asignatura, draftAsignatura, switchAsignatura]);

  const cancelEditAsignatura = useCallback(() => {
    setDraftAsignatura('');
    setEditandoAsignatura(false);
  }, []);

  const pickSugerencia = useCallback(
    (nombre) => {
      if (nombre === asignatura) {
        setEditandoAsignatura(false);
        return;
      }
      switchAsignatura(nombre);
    },
    [asignatura, switchAsignatura]
  );

  // ─── Subida real con persistencia backend ────────────────────────────────
  // `asignaturaSnap` es la asignatura que estaba activa cuando el profesor
  // soltó el archivo en la dropzone. Aunque luego cambie de asignatura, la
  // promesa recuerda ese snapshot y persiste el documento en la asignatura
  // correcta (honesto: no lo reasigna al espacio visible).
  const uploadSingleFile = useCallback(async (file, localId, asignaturaSnap) => {
    try {
      const result = await onUploadDocument(file);
      if (!result || !result.document_id) {
        throw new Error('Respuesta de backend sin document_id');
      }
      const patch = {
        document_id: result.document_id,
        filename: result.filename || file.name,
        status: FILE_STATUS.saved,
        backendStatus: result.status || 'ok',
        paragraphsCount: result.paragraphs_count ?? null,
        markdown_status: result.markdown_status,
        markdown_path: result.markdown_path,
        markdown_relpath: result.markdown_relpath,
        teacher_context_manifest_url: result.teacher_context_manifest_url,
        savedAt: new Date().toISOString(),
        errorMessage: null,
      };

      // Marca si la entrada transitoria seguía viva en `files` en el momento
      // del commit. Si el profesor la eliminó manualmente mientras subía, no
      // debemos resucitarla en el índice persistido.
      let transitorioSeguiaVivo = false;
      let asignaturaDestino = asignaturaSnap;

      setFiles((prev) => {
        const idx = prev.findIndex((f) => f.id === localId);
        if (idx === -1) {
          transitorioSeguiaVivo = false;
          return prev;
        }
        transitorioSeguiaVivo = true;
        // La asignatura real del documento es la que capturó el entry al
        // crearse, no la activa. Caemos a `asignaturaSnap` si faltara.
        asignaturaDestino = prev[idx].asignatura || asignaturaSnap;
        const next = prev.slice();
        next[idx] = { ...prev[idx], ...patch };
        return next;
      });

      if (transitorioSeguiaVivo && asignaturaDestino) {
        // Persistimos contra la asignatura original. El `useEffect` general
        // persiste la asignatura activa; si el documento pertenece a otra,
        // este merge se encarga explícitamente.
        const persistEntry = {
          id: localId,
          document_id: patch.document_id,
          filename: patch.filename,
          size: file.size,
          type: file.type || '',
          category: CATEGORIA_SIN_CLASIFICAR,
          status: FILE_STATUS.saved,
          backendStatus: patch.backendStatus,
          paragraphsCount: patch.paragraphsCount,
          markdown_status: patch.markdown_status,
          markdown_path: patch.markdown_path,
          markdown_relpath: patch.markdown_relpath,
          teacher_context_manifest_url: patch.teacher_context_manifest_url,
          savedAt: patch.savedAt,
          asignatura: asignaturaDestino,
          addedAt: new Date().toISOString(),
          errorMessage: null,
        };
        mergeSavedIntoStorage(asignaturaDestino, persistEntry);
      }
    } catch (err) {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === localId
            ? {
                ...f,
                status: FILE_STATUS.error,
                errorMessage: err?.message || 'Error desconocido al subir',
              }
            : f
        )
      );
    }
  }, [onUploadDocument]);

  const addFilesFromList = useCallback((fileList) => {
    if (!canUpload) return;
    if (!fileList || fileList.length === 0) return;
    const asignaturaSnap = asignatura;
    const now = Date.now();
    const nuevos = Array.from(fileList).map((file, idx) => ({
      id: `f_${now}_${idx}_${Math.random().toString(36).slice(2, 8)}`,
      document_id: null,
      filename: file.name,
      size: file.size,
      type: file.type || '',
      category: CATEGORIA_SIN_CLASIFICAR,
      status: FILE_STATUS.uploading,
      asignatura: asignaturaSnap,
      errorMessage: null,
      addedAt: new Date().toISOString(),
      _fileRef: file,
    }));
    setFiles((prev) => [...nuevos, ...prev]);
    nuevos.forEach((entry) => {
      uploadSingleFile(entry._fileRef, entry.id, asignaturaSnap);
    });
  }, [asignatura, canUpload, uploadSingleFile]);

  const retryUpload = useCallback((id) => {
    setFiles((prev) => {
      const target = prev.find((f) => f.id === id);
      if (!target || !target._fileRef) return prev;
      // Reinicia el estado de ese item a "Subiendo" y dispara el upload de nuevo.
      setTimeout(() => {
        uploadSingleFile(target._fileRef, id, target.asignatura || asignatura);
      }, 0);
      return prev.map((f) =>
        f.id === id
          ? { ...f, status: FILE_STATUS.uploading, errorMessage: null }
          : f
      );
    });
  }, [asignatura, uploadSingleFile]);

  // ─── Dropzone ────────────────────────────────────────────────────────────
  const handleDragOver = useCallback((e) => {
    if (!canUpload) return;
    e.preventDefault();
    e.stopPropagation();
    if (!isDragActive) setIsDragActive(true);
  }, [canUpload, isDragActive]);

  const handleDragLeave = useCallback((e) => {
    if (!canUpload) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  }, [canUpload]);

  const handleDrop = useCallback((e) => {
    if (!canUpload) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    if (e.dataTransfer?.files?.length) {
      addFilesFromList(e.dataTransfer.files);
    }
  }, [addFilesFromList, canUpload]);

  const handleBrowseClick = useCallback(() => {
    if (!canUpload) return;
    fileInputRef.current?.click();
  }, [canUpload]);

  const handleInputChange = useCallback((e) => {
    if (e.target.files?.length) {
      addFilesFromList(e.target.files);
    }
    e.target.value = '';
  }, [addFilesFromList]);

  // ─── Organización ───────────────────────────────────────────────────────
  const cambiarCategoria = useCallback((id, categoria) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, category: categoria } : f))
    );
  }, []);

  const eliminarArchivo = useCallback((id) => {
    // Quita del índice local. El binario puede seguir existiendo en backend,
    // pero Mi Espacio IB deja de mostrarlo aquí. (No llamamos endpoint DELETE
    // para no tocar backend en esta fase.)
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const archivosPorCategoria = useMemo(() => {
    const map = Object.fromEntries(
      CATEGORIAS.map((c) => [c.id, []]).concat([[CATEGORIA_SIN_CLASIFICAR, []]])
    );
    // Sólo los 'Guardado' DE LA ASIGNATURA ACTIVA se muestran en las tarjetas
    // por categoría. Un guardado tardío para otra asignatura vive en su
    // espacio, no se maquilla como si perteneciera al visible.
    for (const f of files) {
      if (f.status !== FILE_STATUS.saved) continue;
      if (f.asignatura && f.asignatura !== asignatura) continue;
      if (map[f.category]) map[f.category].push(f);
      else map[CATEGORIA_SIN_CLASIFICAR].push(f);
    }
    return map;
  }, [files, asignatura]);

  const pendientesActivos = useMemo(
    () => files.filter((f) => f.status === FILE_STATUS.uploading || f.status === FILE_STATUS.error),
    [files]
  );

  const rubricasDeAsignatura = useMemo(() => {
    if (!asignatura) return rubricas;
    const target = asignatura.toLowerCase();
    const match = rubricas.filter(
      (r) => (r.asignatura || '').toLowerCase().includes(target)
    );
    return match.length > 0 ? match : rubricas;
  }, [asignatura, rubricas]);

  // ─── Estilos dinámicos de dropzone según disponibilidad ──────────────────
  const dropzoneStyle = {
    ...S.dropzone,
    ...(isDragActive && canUpload ? S.dropzoneActive : {}),
    ...(canUpload ? {} : S.dropzoneDisabled),
  };

  return (
    <div style={S.root}>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleInputChange}
        style={{ display: 'none' }}
        accept=".pdf,.doc,.docx,.txt,.md,.rtf,.odt,.ppt,.pptx,.xls,.xlsx,.csv,.png,.jpg,.jpeg,.webp"
      />

      <div style={S.canvas}>
        {/* ─── Encabezado editorial ─────────────────────────────────────── */}
        <header style={S.header}>
          <div style={S.kicker}>
            <span style={S.kickerDot} /> Workspace docente · Fase D
          </div>
          <h1 style={S.title}>Mi Espacio IB</h1>
          <p style={S.subtitle}>
            Tu espacio de contexto como profesor IB. Aquí concentras guías,
            exámenes, rúbricas, unidades y referencias por asignatura, listos
            para que tu flujo docente fluya con calma y criterio.
          </p>
        </header>

        {/* ─── Contexto de asignatura ───────────────────────────────────── */}
        <section style={S.asignaturaCard}>
          <div style={S.asignaturaTop}>
            <div style={S.asignaturaLabel}>Asignatura activa</div>
            {tieneAsignatura && !editandoAsignatura && (
              <button
                onClick={startEditAsignatura}
                style={S.btnGhost}
                title="Editar o cambiar la asignatura de este espacio"
              >
                ✎ Cambiar
              </button>
            )}
          </div>

          {editandoAsignatura ? (
            <div>
              <div style={S.inputWrap}>
                <input
                  autoFocus
                  type="text"
                  value={draftAsignatura}
                  onChange={(e) => setDraftAsignatura(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitAsignatura();
                    if (e.key === 'Escape') cancelEditAsignatura();
                  }}
                  placeholder="Ej. Historia NS, Literatura NM, Biología NS…"
                  style={S.asignaturaInput}
                />
                <div style={S.inputActions}>
                  <button onClick={commitAsignatura} style={S.btnPrimary}>
                    Guardar
                  </button>
                  {tieneAsignatura && (
                    <button onClick={cancelEditAsignatura} style={S.btnGhost}>
                      Cancelar
                    </button>
                  )}
                </div>
              </div>
              <div style={S.suggestWrap}>
                <div style={S.suggestLabel}>Sugerencias rápidas</div>
                <div style={S.suggestList}>
                  {sugerenciasAsignatura.slice(0, 8).map((nombre) => (
                    <button
                      key={nombre}
                      onClick={() => pickSugerencia(nombre)}
                      style={S.suggestChip}
                    >
                      {nombre}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div>
              <div style={S.asignaturaName}>
                <span style={S.asignaturaIcon}>📘</span>
                <span>{asignatura}</span>
              </div>
              <div style={S.asignaturaHint}>
                Este espacio pertenece a esta asignatura. Todo lo que subas y
                organices quedará asociado a ella.
              </div>
            </div>
          )}
        </section>

        {/* ─── Dropzone principal (bloqueada sin asignatura) ────────────── */}
        <section
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={canUpload ? handleBrowseClick : undefined}
          role={canUpload ? 'button' : 'group'}
          aria-disabled={canUpload ? 'false' : 'true'}
          tabIndex={canUpload ? 0 : -1}
          style={dropzoneStyle}
        >
          <div style={S.dropIconWrap}>
            <div style={S.dropIcon}>{canUpload ? '⬆' : '🔒'}</div>
          </div>
          <div style={S.dropTitle}>
            {canUpload
              ? 'Sube o arrastra los elementos de tu Espacio IB'
              : 'Define primero una asignatura para habilitar la subida'}
          </div>
          <div style={S.dropSubtitle}>
            Guías · Exámenes · Rúbricas · Unidades · Documentos de referencia
          </div>
          <div style={S.dropActions}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleBrowseClick();
              }}
              disabled={!canUpload}
              style={canUpload ? S.btnPrimaryLarge : S.btnPrimaryLargeDisabled}
            >
              Seleccionar archivos
            </button>
            <div style={S.dropHint}>
              {canUpload
                ? 'o arrastra directamente aquí · PDF, DOCX, TXT, imágenes'
                : 'La dropzone se activará cuando definas la asignatura.'}
            </div>
          </div>
          {!tieneAsignatura && (
            <div style={S.dropWarn}>
              Sin asignatura activa no se puede subir nada. Así cada archivo vive
              en su espacio correcto y no se mezcla contexto.
            </div>
          )}
        </section>

        {/* ─── Subidas en curso / con error (estado honesto) ────────────── */}
        {pendientesActivos.length > 0 && (
          <section style={S.pendingBlock}>
            <div style={S.pendingHead}>
              <h2 style={S.sectionTitle}>Subidas en curso</h2>
              <p style={S.sectionSubtitle}>
                Estos archivos todavía no están guardados en el servidor.
                Mostramos su estado real.
              </p>
            </div>
            <ul style={S.pendingList}>
              {pendientesActivos.map((f) => {
                const isUploading = f.status === FILE_STATUS.uploading;
                const isError = f.status === FILE_STATUS.error;
                const perteneceOtraAsig =
                  f.asignatura && asignatura && f.asignatura !== asignatura;
                return (
                  <li
                    key={f.id}
                    style={{
                      ...S.pendingItem,
                      ...(isError ? S.pendingItemError : {}),
                    }}
                  >
                    <div style={S.pendingItemMain}>
                      <div style={S.pendingItemName} title={f.filename}>
                        {f.filename}
                      </div>
                      <div style={S.pendingItemSub}>
                        {[formatSize(f.size), f.type].filter(Boolean).join(' · ')}
                      </div>
                      {perteneceOtraAsig && (
                        <div style={S.pendingAsigTag} title="Este archivo pertenece a otra asignatura y se indexará en ella cuando termine.">
                          Pertenece a: <strong>{f.asignatura}</strong>
                        </div>
                      )}
                      {isError && f.errorMessage && (
                        <div style={S.pendingErrorMsg}>
                          {f.errorMessage}
                        </div>
                      )}
                    </div>
                    <div style={S.pendingItemRight}>
                      <span
                        style={{
                          ...S.statusBadge,
                          ...(isUploading ? S.statusBadgeUploading : {}),
                          ...(isError ? S.statusBadgeError : {}),
                        }}
                      >
                        {isUploading && (
                          <span style={S.spinnerDot} aria-hidden="true" />
                        )}
                        {f.status}
                      </span>
                      {isError && (
                        <button
                          onClick={() => retryUpload(f.id)}
                          style={S.btnGhostSmall}
                          title="Reintentar subida"
                        >
                          ↻ Reintentar
                        </button>
                      )}
                      <button
                        onClick={() => eliminarArchivo(f.id)}
                        style={S.itemRemove}
                        title="Quitar de la lista"
                      >
                        ✕
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* ─── Organización por tipo documental ─────────────────────────── */}
        <section style={S.sectionBlock}>
          <div style={S.sectionHead}>
            <div>
              <h2 style={S.sectionTitle}>Organización del espacio</h2>
              <p style={S.sectionSubtitle}>
                Tarjetas por tipo documental. Los archivos que ves aquí ya están
                guardados en el servidor. Puedes reclasificarlos manualmente; la
                clasificación automática llegará con la memoria contextual.
              </p>
            </div>
            <div style={S.futureTag}>
              <span style={S.futureDot} /> Sincronización futura con memoria
              contextual
            </div>
          </div>

          <div style={S.cardsGrid}>
            {CATEGORIAS.map((cat) => {
              const items =
                cat.id === 'rubricas'
                  ? rubricasDeAsignatura.map((r) => ({
                      id: `rub_${r.id || r.nombre}`,
                      name: r.nombre || r.title || 'Rúbrica sin nombre',
                      subtitle: r.asignatura || 'Sin asignatura',
                      real: true,
                    }))
                  : (archivosPorCategoria[cat.id] || []).map((f) => ({
                      id: f.id,
                      name: f.filename,
                      subtitle: [formatSize(f.size), f.status]
                        .filter(Boolean)
                        .join(' · '),
                      raw: f,
                    }));
              return (
                <article
                  key={cat.id}
                  style={{
                    ...S.card,
                    borderTop: `3px solid ${cat.accent}`,
                  }}
                >
                  <header style={S.cardHead}>
                    <div style={S.cardTitleRow}>
                      <span style={S.cardIcon}>{cat.icon}</span>
                      <h3 style={S.cardTitle}>{cat.label}</h3>
                    </div>
                    <span
                      style={{
                        ...S.cardCount,
                        background: `${cat.accent}22`,
                        color: cat.accent,
                        borderColor: `${cat.accent}55`,
                      }}
                    >
                      {items.length}
                    </span>
                  </header>

                  <p style={S.cardHint}>{cat.hint}</p>

                  {items.length === 0 ? (
                    <div style={S.cardEmpty}>
                      {cat.id === 'rubricas'
                        ? 'Aún no hay rúbricas visibles. Crea la primera cuando quieras.'
                        : 'Aún no hay archivos guardados en esta categoría.'}
                    </div>
                  ) : (
                    <ul style={S.cardList}>
                      {items.slice(0, 6).map((it) => (
                        <li key={it.id} style={S.cardItem}>
                          <div style={S.cardItemMain}>
                            <div style={S.cardItemName} title={it.name}>
                              {it.name}
                            </div>
                            {it.subtitle && (
                              <div style={S.cardItemSub}>{it.subtitle}</div>
                            )}
                          </div>
                          {it.raw && (
                            <button
                              onClick={() => eliminarArchivo(it.id)}
                              style={S.itemRemove}
                              title="Quitar del espacio"
                            >
                              ✕
                            </button>
                          )}
                        </li>
                      ))}
                      {items.length > 6 && (
                        <li style={S.cardItemMore}>
                          +{items.length - 6} más en este tipo
                        </li>
                      )}
                    </ul>
                  )}

                  <footer style={S.cardFoot}>
                    {cat.id === 'rubricas' ? (
                      <div style={S.cardActions}>
                        <button
                          onClick={onAbrirPanelRubricas}
                          style={S.btnGhostSmall}
                        >
                          Ver rúbricas
                        </button>
                        <button
                          onClick={onCrearRubrica}
                          style={S.btnPrimarySmall}
                        >
                          + Crear
                        </button>
                      </div>
                    ) : (
                      <div style={S.cardStatus}>
                        <span style={S.statusPill}>
                          {items.length === 0
                            ? 'Sin archivos guardados'
                            : `${items.length} guardado${items.length === 1 ? '' : 's'}`}
                        </span>
                      </div>
                    )}
                  </footer>
                </article>
              );
            })}
          </div>
        </section>

        {/* ─── Bandeja: guardados pero sin clasificar ───────────────────── */}
        {archivosPorCategoria[CATEGORIA_SIN_CLASIFICAR].length > 0 && (
          <section style={S.inboxBlock}>
            <div style={S.inboxHead}>
              <div>
                <h2 style={S.sectionTitle}>Bandeja — Clasificar guardados</h2>
                <p style={S.sectionSubtitle}>
                  Archivos ya guardados en el servidor pero aún sin tipo
                  documental. Asigna la categoría cuando tengas un segundo.
                </p>
              </div>
            </div>

            <ul style={S.inboxList}>
              {archivosPorCategoria[CATEGORIA_SIN_CLASIFICAR].map((f) => (
                <li key={f.id} style={S.inboxItem}>
                  <div style={S.inboxItemMain}>
                    <div style={S.inboxItemName} title={f.filename}>
                      {f.filename}
                    </div>
                    <div style={S.inboxItemSub}>
                      {[formatSize(f.size), 'Guardado'].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <div style={S.inboxActions}>
                    <select
                      value={f.category}
                      onChange={(e) => cambiarCategoria(f.id, e.target.value)}
                      style={S.inboxSelect}
                    >
                      <option value={CATEGORIA_SIN_CLASIFICAR}>
                        Sin clasificar
                      </option>
                      {CATEGORIAS.filter((c) => c.id !== 'rubricas').map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.singular}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => eliminarArchivo(f.id)}
                      style={S.itemRemove}
                      title="Quitar del espacio"
                    >
                      ✕
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ─── Pie editorial honesto ────────────────────────────────────── */}
        <footer style={S.footNote}>
          Los archivos marcados como “Guardado” están persistidos en el servidor
          y mantienen su <code style={S.inlineCode}>document_id</code> real.
          La clasificación por tipo documental vive todavía en este dispositivo
          hasta que exista soporte backend específico para categorías del
          Espacio IB.
        </footer>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Estilos — consistentes con el shell oscuro de EvaluAI, con tono editorial
// ─────────────────────────────────────────────────────────────────────────────

const S = {
  root: {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    background:
      'radial-gradient(1200px 600px at 10% -10%, rgba(99,102,241,0.12) 0%, rgba(15,23,42,0) 60%),' +
      'radial-gradient(900px 500px at 100% 0%, rgba(56,189,248,0.08) 0%, rgba(15,23,42,0) 55%),' +
      'linear-gradient(180deg, #0b1220 0%, #060b18 100%)',
    fontFamily:
      "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    color: '#e2e8f0',
  },
  canvas: {
    maxWidth: '1180px',
    margin: '0 auto',
    padding: '40px 36px 72px',
    display: 'flex',
    flexDirection: 'column',
    gap: '28px',
  },

  // ── Header ───────────────────────────────────────────────────────────
  header: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  kicker: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    alignSelf: 'flex-start',
    padding: '7px 14px',
    borderRadius: '999px',
    border: '1px solid rgba(148,163,184,0.22)',
    background: 'rgba(15,23,42,0.55)',
    color: 'rgba(203,213,225,0.9)',
    fontSize: '12px',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    fontWeight: 700,
  },
  kickerDot: {
    display: 'inline-block',
    width: '6px',
    height: '6px',
    borderRadius: '999px',
    background: '#a5b4fc',
    boxShadow: '0 0 0 3px rgba(165,180,252,0.18)',
  },
  title: {
    margin: 0,
    fontSize: '34px',
    lineHeight: 1.12,
    letterSpacing: '-0.02em',
    fontWeight: 800,
    color: '#f8fafc',
    fontFamily: "'Inter', system-ui, 'Segoe UI', Roboto, sans-serif",
  },
  subtitle: {
    margin: 0,
    maxWidth: '720px',
    color: 'rgba(203,213,225,0.82)',
    fontSize: '15px',
    lineHeight: 1.62,
  },

  // ── Asignatura ───────────────────────────────────────────────────────
  asignaturaCard: {
    padding: '20px 24px',
    borderRadius: '18px',
    background:
      'linear-gradient(180deg, rgba(30,41,59,0.78) 0%, rgba(15,23,42,0.78) 100%)',
    border: '1px solid rgba(148,163,184,0.18)',
    boxShadow:
      '0 1px 0 rgba(255,255,255,0.04) inset, 0 20px 45px -28px rgba(2,6,23,0.6)',
  },
  asignaturaTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '10px',
  },
  asignaturaLabel: {
    fontSize: '12px',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'rgba(203,213,225,0.9)',
    fontWeight: 700,
  },
  asignaturaName: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    fontSize: '26px',
    fontWeight: 700,
    color: '#f8fafc',
    letterSpacing: '-0.01em',
  },
  asignaturaIcon: {
    fontSize: '28px',
  },
  asignaturaHint: {
    marginTop: '10px',
    color: 'rgba(203,213,225,0.78)',
    fontSize: '14.5px',
    lineHeight: 1.6,
  },
  inputWrap: {
    display: 'flex',
    gap: '10px',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  asignaturaInput: {
    flex: 1,
    minWidth: '240px',
    padding: '13px 16px',
    borderRadius: '12px',
    border: '1px solid rgba(148,163,184,0.28)',
    background: 'rgba(2,6,23,0.55)',
    color: '#f8fafc',
    fontSize: '16px',
    outline: 'none',
  },
  inputActions: {
    display: 'flex',
    gap: '8px',
  },
  suggestWrap: {
    marginTop: '14px',
  },
  suggestLabel: {
    fontSize: '12px',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'rgba(203,213,225,0.85)',
    marginBottom: '10px',
    fontWeight: 700,
  },
  suggestList: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  suggestChip: {
    padding: '8px 14px',
    borderRadius: '999px',
    border: '1px solid rgba(148,163,184,0.25)',
    background: 'rgba(15,23,42,0.6)',
    color: 'rgba(226,232,240,0.95)',
    fontSize: '13.5px',
    cursor: 'pointer',
    fontWeight: 500,
  },

  // ── Dropzone ─────────────────────────────────────────────────────────
  dropzone: {
    position: 'relative',
    padding: '36px 28px',
    borderRadius: '22px',
    border: '1.5px dashed rgba(148,163,184,0.35)',
    background:
      'linear-gradient(180deg, rgba(30,41,59,0.55) 0%, rgba(15,23,42,0.55) 100%)',
    textAlign: 'center',
    cursor: 'pointer',
    transition: 'all 180ms ease',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
    outline: 'none',
  },
  dropzoneActive: {
    borderColor: 'rgba(129,140,248,0.8)',
    background:
      'linear-gradient(180deg, rgba(49,46,129,0.35) 0%, rgba(30,27,75,0.35) 100%)',
    boxShadow: '0 0 0 4px rgba(129,140,248,0.12) inset',
  },
  dropzoneDisabled: {
    cursor: 'not-allowed',
    opacity: 0.55,
    filter: 'grayscale(0.35)',
    borderColor: 'rgba(148,163,184,0.22)',
    background:
      'linear-gradient(180deg, rgba(30,41,59,0.4) 0%, rgba(15,23,42,0.4) 100%)',
  },
  dropIconWrap: {
    width: '62px',
    height: '62px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(99,102,241,0.18)',
    border: '1px solid rgba(129,140,248,0.4)',
    color: '#c7d2fe',
    fontSize: '26px',
    fontWeight: 700,
  },
  dropIcon: {
    transform: 'translateY(-1px)',
  },
  dropTitle: {
    fontSize: '21px',
    fontWeight: 700,
    color: '#f8fafc',
    letterSpacing: '-0.01em',
  },
  dropSubtitle: {
    color: 'rgba(203,213,225,0.85)',
    fontSize: '14.5px',
    lineHeight: 1.55,
  },
  dropActions: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '10px',
    marginTop: '8px',
  },
  dropHint: {
    fontSize: '13px',
    color: 'rgba(203,213,225,0.82)',
  },
  dropWarn: {
    marginTop: '6px',
    fontSize: '13px',
    color: 'rgba(250,204,21,0.95)',
    background: 'rgba(161,98,7,0.18)',
    border: '1px solid rgba(250,204,21,0.32)',
    padding: '9px 16px',
    borderRadius: '999px',
    maxWidth: '560px',
    lineHeight: 1.45,
  },

  // ── Pending / en curso ───────────────────────────────────────────────
  pendingBlock: {
    background:
      'linear-gradient(180deg, rgba(30,41,59,0.6) 0%, rgba(15,23,42,0.6) 100%)',
    border: '1px solid rgba(148,163,184,0.18)',
    borderRadius: '18px',
    padding: '20px 22px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  pendingHead: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  pendingList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  pendingItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 14px',
    borderRadius: '12px',
    background: 'rgba(2,6,23,0.55)',
    border: '1px solid rgba(148,163,184,0.15)',
  },
  pendingItemError: {
    background: 'rgba(76,10,10,0.28)',
    border: '1px solid rgba(248,113,113,0.35)',
  },
  pendingItemMain: {
    flex: 1,
    minWidth: 0,
  },
  pendingItemName: {
    color: '#f1f5f9',
    fontSize: '14.5px',
    fontWeight: 600,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  pendingItemSub: {
    color: 'rgba(203,213,225,0.82)',
    fontSize: '12.5px',
    marginTop: '3px',
  },
  pendingErrorMsg: {
    marginTop: '8px',
    color: 'rgba(252,165,165,0.95)',
    fontSize: '13px',
    lineHeight: 1.5,
  },
  pendingAsigTag: {
    marginTop: '8px',
    display: 'inline-block',
    padding: '4px 10px',
    borderRadius: '999px',
    background: 'rgba(56,189,248,0.12)',
    border: '1px solid rgba(56,189,248,0.35)',
    color: '#bae6fd',
    fontSize: '12px',
    fontWeight: 600,
    letterSpacing: '0.01em',
  },
  pendingItemRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexShrink: 0,
  },

  // ── Status badges ────────────────────────────────────────────────────
  statusBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '5px 12px',
    borderRadius: '999px',
    background: 'rgba(15,23,42,0.7)',
    border: '1px solid rgba(148,163,184,0.22)',
    color: 'rgba(203,213,225,0.92)',
    fontSize: '12px',
    fontWeight: 700,
    letterSpacing: '0.02em',
  },
  statusBadgeUploading: {
    background: 'rgba(59,130,246,0.18)',
    border: '1px solid rgba(96,165,250,0.45)',
    color: '#bfdbfe',
  },
  statusBadgeError: {
    background: 'rgba(185,28,28,0.22)',
    border: '1px solid rgba(248,113,113,0.5)',
    color: '#fecaca',
  },
  spinnerDot: {
    display: 'inline-block',
    width: '8px',
    height: '8px',
    borderRadius: '999px',
    background: '#60a5fa',
    boxShadow: '0 0 0 3px rgba(96,165,250,0.25)',
    animation: 'pulse 1.2s ease-in-out infinite',
  },

  // ── Sección cards ────────────────────────────────────────────────────
  sectionBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: '22px',
  },
  sectionHead: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: '20px',
    flexWrap: 'wrap',
  },
  sectionTitle: {
    margin: 0,
    fontSize: '21px',
    fontWeight: 700,
    color: '#f8fafc',
    letterSpacing: '-0.01em',
  },
  sectionSubtitle: {
    margin: '10px 0 0 0',
    maxWidth: '680px',
    color: 'rgba(203,213,225,0.84)',
    fontSize: '14.5px',
    lineHeight: 1.62,
  },
  futureTag: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '7px 14px',
    borderRadius: '999px',
    border: '1px solid rgba(56,189,248,0.3)',
    background: 'rgba(14,116,144,0.16)',
    color: '#bae6fd',
    fontSize: '12.5px',
    fontWeight: 600,
  },
  futureDot: {
    width: '6px',
    height: '6px',
    borderRadius: '999px',
    background: '#38bdf8',
    boxShadow: '0 0 0 3px rgba(56,189,248,0.18)',
  },
  cardsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: '18px',
  },
  card: {
    background:
      'linear-gradient(180deg, rgba(30,41,59,0.72) 0%, rgba(15,23,42,0.72) 100%)',
    border: '1px solid rgba(148,163,184,0.18)',
    borderRadius: '16px',
    padding: '18px 20px 17px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    minHeight: '198px',
  },
  cardHead: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  cardIcon: {
    fontSize: '20px',
  },
  cardTitle: {
    margin: 0,
    fontSize: '16.5px',
    fontWeight: 700,
    color: '#f8fafc',
    letterSpacing: '-0.01em',
  },
  cardCount: {
    padding: '3px 12px',
    borderRadius: '999px',
    fontSize: '13px',
    fontWeight: 700,
    border: '1px solid',
  },
  cardHint: {
    margin: 0,
    color: 'rgba(203,213,225,0.82)',
    fontSize: '13.5px',
    lineHeight: 1.55,
  },
  cardEmpty: {
    marginTop: '2px',
    padding: '16px',
    borderRadius: '12px',
    border: '1px dashed rgba(148,163,184,0.22)',
    color: 'rgba(203,213,225,0.8)',
    fontSize: '13.5px',
    lineHeight: 1.5,
    textAlign: 'center',
  },
  cardList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  cardItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '9px 11px',
    borderRadius: '10px',
    background: 'rgba(2,6,23,0.55)',
    border: '1px solid rgba(148,163,184,0.14)',
  },
  cardItemMain: {
    flex: 1,
    minWidth: 0,
  },
  cardItemName: {
    color: '#f1f5f9',
    fontSize: '14px',
    fontWeight: 600,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  cardItemSub: {
    color: 'rgba(203,213,225,0.82)',
    fontSize: '12.5px',
    marginTop: '3px',
  },
  cardItemMore: {
    color: 'rgba(203,213,225,0.82)',
    fontSize: '12.5px',
    padding: '6px 4px 0 4px',
  },
  cardFoot: {
    marginTop: 'auto',
    paddingTop: '6px',
  },
  cardStatus: {
    display: 'flex',
    justifyContent: 'flex-start',
  },
  statusPill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '5px 12px',
    borderRadius: '999px',
    background: 'rgba(15,23,42,0.7)',
    border: '1px solid rgba(148,163,184,0.22)',
    color: 'rgba(203,213,225,0.9)',
    fontSize: '12px',
    fontWeight: 600,
    letterSpacing: '0.02em',
  },
  cardActions: {
    display: 'flex',
    gap: '8px',
    justifyContent: 'flex-end',
  },

  // ── Bandeja sin clasificar ──────────────────────────────────────────
  inboxBlock: {
    background:
      'linear-gradient(180deg, rgba(30,41,59,0.55) 0%, rgba(15,23,42,0.55) 100%)',
    border: '1px solid rgba(148,163,184,0.15)',
    borderRadius: '18px',
    padding: '20px 22px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  inboxHead: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: '20px',
    flexWrap: 'wrap',
  },
  inboxList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  inboxItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 14px',
    borderRadius: '12px',
    background: 'rgba(2,6,23,0.55)',
    border: '1px solid rgba(148,163,184,0.15)',
  },
  inboxItemMain: {
    flex: 1,
    minWidth: 0,
  },
  inboxItemName: {
    color: '#f1f5f9',
    fontSize: '14.5px',
    fontWeight: 600,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  inboxItemSub: {
    color: 'rgba(203,213,225,0.82)',
    fontSize: '12.5px',
    marginTop: '3px',
  },
  inboxActions: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
  },
  inboxSelect: {
    padding: '8px 12px',
    borderRadius: '8px',
    border: '1px solid rgba(148,163,184,0.28)',
    background: 'rgba(15,23,42,0.78)',
    color: '#e2e8f0',
    fontSize: '13.5px',
    cursor: 'pointer',
  },

  // ── Botones ──────────────────────────────────────────────────────────
  btnPrimary: {
    padding: '11px 18px',
    borderRadius: '10px',
    border: '1px solid rgba(129,140,248,0.55)',
    background:
      'linear-gradient(135deg, rgba(99,102,241,0.9) 0%, rgba(139,92,246,0.9) 100%)',
    color: '#fff',
    fontSize: '14px',
    fontWeight: 700,
    cursor: 'pointer',
    letterSpacing: '0.01em',
  },
  btnPrimaryLarge: {
    padding: '13px 24px',
    borderRadius: '12px',
    border: '1px solid rgba(129,140,248,0.55)',
    background:
      'linear-gradient(135deg, rgba(99,102,241,0.95) 0%, rgba(139,92,246,0.95) 100%)',
    color: '#fff',
    fontSize: '15px',
    fontWeight: 700,
    cursor: 'pointer',
    letterSpacing: '0.01em',
    boxShadow: '0 10px 30px -12px rgba(99,102,241,0.55)',
  },
  btnPrimaryLargeDisabled: {
    padding: '13px 24px',
    borderRadius: '12px',
    border: '1px solid rgba(148,163,184,0.25)',
    background: 'rgba(30,41,59,0.6)',
    color: 'rgba(203,213,225,0.55)',
    fontSize: '15px',
    fontWeight: 700,
    cursor: 'not-allowed',
    letterSpacing: '0.01em',
  },
  btnPrimarySmall: {
    padding: '8px 14px',
    borderRadius: '8px',
    border: '1px solid rgba(129,140,248,0.55)',
    background:
      'linear-gradient(135deg, rgba(99,102,241,0.88) 0%, rgba(139,92,246,0.88) 100%)',
    color: '#fff',
    fontSize: '13px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  btnGhost: {
    padding: '9px 14px',
    borderRadius: '10px',
    border: '1px solid rgba(148,163,184,0.28)',
    background: 'rgba(15,23,42,0.6)',
    color: 'rgba(226,232,240,0.95)',
    fontSize: '13.5px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  btnGhostSmall: {
    padding: '7px 12px',
    borderRadius: '8px',
    border: '1px solid rgba(148,163,184,0.28)',
    background: 'rgba(15,23,42,0.6)',
    color: 'rgba(226,232,240,0.95)',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  itemRemove: {
    width: '28px',
    height: '28px',
    borderRadius: '8px',
    border: '1px solid rgba(252,165,165,0.28)',
    background: 'transparent',
    color: 'rgba(252,165,165,0.9)',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  footNote: {
    marginTop: '8px',
    padding: '20px 22px',
    borderRadius: '14px',
    background: 'rgba(2,6,23,0.5)',
    border: '1px solid rgba(148,163,184,0.12)',
    color: 'rgba(203,213,225,0.88)',
    fontSize: '13.5px',
    lineHeight: 1.65,
    letterSpacing: '0.01em',
  },
  inlineCode: {
    padding: '2px 7px',
    borderRadius: '6px',
    background: 'rgba(15,23,42,0.8)',
    border: '1px solid rgba(148,163,184,0.22)',
    color: '#e2e8f0',
    fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, monospace",
    fontSize: '12.5px',
  },
};
