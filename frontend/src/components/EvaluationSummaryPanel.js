import React, { useMemo } from 'react';

const SEVERITY_ORDER = ['CRÍTICO', 'RELEVANTE', 'MENOR', 'FORMAL'];

const SEVERITY_COLORS = {
  'CRÍTICO': '#ef4444',
  RELEVANTE: '#f97316',
  MENOR: '#eab308',
  FORMAL: '#3b82f6',
};

const TYPE_LABELS = {
  error: 'Errores',
  improvement: 'Mejoras',
  observation: 'Observaciones',
};

function normalizeSeverity(value) {
  const normalized = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();

  switch (normalized) {
    case 'CRITICO':
      return 'CRÍTICO';
    case 'RELEVANTE':
      return 'RELEVANTE';
    case 'MENOR':
      return 'MENOR';
    case 'FORMAL':
      return 'FORMAL';
    default:
      return '';
  }
}

function normalizeNoteType(raw) {
  const t = String(raw?.note_type || raw?.type || 'observation')
    .trim()
    .toLowerCase();
  if (t === 'error') return 'error';
  if (t === 'improvement') return 'improvement';
  return 'observation';
}

/**
 * Resumen de la evaluación en curso (solo estado/respuesta actual del cliente).
 * Sin analítica histórica ni llamadas a endpoints de series.
 */
export default function EvaluationSummaryPanel({
  evaluacionResultado = null,
  currentFootnotes = [],
  currentDocument = null,
  isEvaluando = false,
}) {
  const severityRows = useMemo(() => {
    const counts = currentFootnotes.reduce(
      (acc, footnote) => {
        const severity = normalizeSeverity(footnote?.severity);
        if (severity) acc[severity] += 1;
        return acc;
      },
      { 'CRÍTICO': 0, RELEVANTE: 0, MENOR: 0, FORMAL: 0 }
    );

    return SEVERITY_ORDER.map((key) => ({
      key,
      count: counts[key],
      color: SEVERITY_COLORS[key],
    }));
  }, [currentFootnotes]);

  const typeCounts = useMemo(() => {
    const m = evaluacionResultado?.metrics;
    if (m && typeof m === 'object') {
      return {
        error: Number(m.error) || 0,
        improvement: Number(m.improvement) || 0,
        observation: Number(m.observation) || 0,
        fromMetrics: true,
      };
    }
    const acc = { error: 0, improvement: 0, observation: 0, fromMetrics: false };
    currentFootnotes.forEach((fn) => {
      acc[normalizeNoteType(fn)] += 1;
    });
    return acc;
  }, [evaluacionResultado, currentFootnotes]);

  const hasEvaluationPayload = !!(
    evaluacionResultado &&
    (evaluacionResultado.evaluation || evaluacionResultado.corrections)
  );
  const hasFootnotes = currentFootnotes.length > 0;
  const hasSeverityData = severityRows.some((r) => r.count > 0);
  const hasTypeData =
    typeCounts.error > 0 || typeCounts.improvement > 0 || typeCounts.observation > 0;
  const hasEvalOrFootnotes = hasEvaluationPayload || hasFootnotes;

  const matrix = evaluacionResultado?.evaluation_matrix;
  const totalScore =
    matrix && matrix.total_score !== undefined && matrix.total_score !== null
      ? matrix.total_score
      : null;

  const showGlobalEmpty =
    !isEvaluando && !hasEvalOrFootnotes && !currentDocument;

  const showWaitingEval =
    !isEvaluando && !!currentDocument && !hasEvalOrFootnotes;

  return (
    <div style={styles.wrap}>
      <h2 style={styles.title}>Resumen de esta evaluación</h2>

      <p style={styles.disclaimer}>
        No incluye analíticas históricas; eso va en el servicio complementario.
      </p>

      {isEvaluando ? (
        <div style={styles.banner}>
          <span style={styles.spinnerDim} aria-hidden />
          Generando evaluación…
        </div>
      ) : null}

      {showGlobalEmpty ? (
        <div style={styles.empty}>
          <div style={styles.emptyIcon} aria-hidden>
            📋
          </div>
          <p style={styles.emptyTitle}>Sin resumen aún</p>
          <p style={styles.emptyText}>
            Sube un documento, ejecuta una evaluación y revisa las notas al pie en el visor. Este panel resume solo lo
            que está en pantalla ahora, sin historial.
          </p>
        </div>
      ) : null}

      {showWaitingEval ? (
        <div style={styles.waiting}>
          <p style={styles.waitingText}>
            Documento listo en el visor. Pulsa <strong>Evaluar</strong> en la barra del documento para generar el
            resumen y las notas al pie.
          </p>
        </div>
      ) : null}

      {!showGlobalEmpty && (currentDocument || hasEvalOrFootnotes || isEvaluando) ? (
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Estado (esta sesión)</h3>
          <ul style={styles.list}>
            {currentDocument ? (
              <li style={styles.li}>
                Documento en el visor · {currentDocument.paragraphs?.length ?? 0} párrafos
              </li>
            ) : null}
            {hasEvaluationPayload ? (
              <li style={styles.li}>Evaluación aplicada al documento actual.</li>
            ) : null}
            {totalScore !== null && !Number.isNaN(Number(totalScore)) ? (
              <li style={styles.li}>Puntuación total (matriz): {String(totalScore)}</li>
            ) : null}
            {hasFootnotes ? (
              <li style={styles.li}>
                Notas al pie en el documento: <strong>{currentFootnotes.length}</strong>
              </li>
            ) : hasEvaluationPayload && !hasFootnotes ? (
              <li style={styles.li}>Vista de evaluación disponible (sin notas al pie indexadas aún).</li>
            ) : null}
          </ul>
        </div>
      ) : null}

      {hasSeverityData ? (
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Por severidad (notas al pie)</h3>
          <div style={styles.grid2}>
            {severityRows.map((row) =>
              row.count > 0 ? (
                <div key={row.key} style={{ ...styles.pill, borderColor: `${row.color}55` }}>
                  <div style={{ ...styles.pillLabel, color: row.color }}>{row.key}</div>
                  <div style={styles.pillValue}>{row.count}</div>
                </div>
              ) : null
            )}
          </div>
        </div>
      ) : hasEvalOrFootnotes && !isEvaluando ? (
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Por severidad (notas al pie)</h3>
          <p style={styles.muted}>Sin severidades clasificadas en las notas actuales.</p>
        </div>
      ) : null}

      {hasTypeData ? (
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>
            Por tipo {typeCounts.fromMetrics ? '(respuesta)' : '(derivado de notas)'}
          </h3>
          <div style={styles.typeRow}>
            {['error', 'improvement', 'observation'].map((k) => (
              <div key={k} style={styles.typeCell}>
                <div style={styles.typeVal}>{typeCounts[k]}</div>
                <div style={styles.typeLbl}>{TYPE_LABELS[k]}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

const styles = {
  wrap: {
    padding: '12px 16px 22px',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    minHeight: 120,
  },
  title: {
    margin: 0,
    fontSize: 17,
    fontWeight: 800,
    letterSpacing: '-0.02em',
    color: '#f8fafc',
  },
  disclaimer: {
    margin: 0,
    fontSize: 12,
    lineHeight: 1.5,
    color: 'rgba(203,213,225,0.88)',
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid rgba(148,163,184,0.22)',
    background: 'rgba(2,6,23,0.45)',
  },
  banner: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    fontSize: 13,
    fontWeight: 600,
    color: '#e0e7ff',
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid rgba(129,140,248,0.35)',
    background: 'rgba(67,56,202,0.2)',
  },
  spinnerDim: {
    width: 16,
    height: 16,
    flexShrink: 0,
    border: '2px solid rgba(199,210,254,0.35)',
    borderTopColor: 'rgba(199,210,254,0.95)',
    borderRadius: 999,
    animation: 'spin 0.8s linear infinite',
  },
  empty: {
    textAlign: 'center',
    padding: '18px 12px 10px',
    borderRadius: 12,
    border: '1px dashed rgba(148,163,184,0.28)',
    background: 'rgba(15,23,42,0.35)',
  },
  waiting: {
    padding: '12px 12px',
    borderRadius: 12,
    border: '1px solid rgba(56,189,248,0.22)',
    background: 'rgba(14,116,144,0.12)',
  },
  waitingText: {
    margin: 0,
    fontSize: 13,
    lineHeight: 1.55,
    color: 'rgba(226,232,240,0.92)',
  },
  emptyIcon: { fontSize: 36, lineHeight: 1, marginBottom: 8 },
  emptyTitle: {
    margin: '0 0 6px 0',
    fontSize: 15,
    fontWeight: 800,
    color: '#f1f5f9',
  },
  emptyText: {
    margin: 0,
    fontSize: 13,
    lineHeight: 1.55,
    color: 'rgba(203,213,225,0.82)',
  },
  section: {
    borderTop: '1px solid rgba(148,163,184,0.12)',
    paddingTop: 12,
  },
  sectionTitle: {
    margin: '0 0 10px 0',
    fontSize: 11,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    fontWeight: 800,
    color: 'rgba(203,213,225,0.85)',
  },
  list: {
    margin: 0,
    paddingLeft: 18,
    color: 'rgba(226,232,240,0.92)',
    fontSize: 13.5,
    lineHeight: 1.55,
  },
  li: { marginBottom: 6 },
  muted: {
    margin: '8px 0 0 0',
    fontSize: 13,
    lineHeight: 1.5,
    color: 'rgba(148,163,184,0.9)',
  },
  grid2: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: 8,
  },
  pill: {
    borderRadius: 10,
    padding: '10px 10px',
    border: '1px solid rgba(148,163,184,0.2)',
    background: 'rgba(2,6,23,0.35)',
  },
  pillLabel: {
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
  },
  pillValue: {
    marginTop: 4,
    fontSize: 20,
    fontWeight: 800,
    color: '#f8fafc',
  },
  typeRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: 8,
  },
  typeCell: {
    textAlign: 'center',
    padding: '10px 6px',
    borderRadius: 10,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(148,163,184,0.14)',
  },
  typeVal: { fontSize: 18, fontWeight: 800, color: '#f8fafc' },
  typeLbl: { marginTop: 4, fontSize: 10, color: 'rgba(148,163,184,0.95)', textTransform: 'uppercase' },
};
