/**
 * CentralEvaluator — Panel central de evaluación de documentos.
 * Features:
 *  - Evaluación línea a línea con temperatura 0.0
 *  - Anotaciones incrementales [1][2][3]…
 *  - Selección de texto → captura en ChatBubble
 *  - Notas al pie: [Modificar] [Complementar con Chat] [Aceptar]
 *  - Matriz de evaluación final en JSON
 *  - PrintContainer oculto para exportación PDF perfecta
 */
import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import {
  EVALUATION_SHEET_LAYOUT,
  saveEvaluationPdf,
  saveOriginalPdfWithAppendedObservations,
} from '../../utils/evaluationPdf.js';
import DocumentPreview from './DocumentPreview.js';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const FOOTNOTE_CONFIG = {
  improvement: { label: 'Mejora', color: '#22c55e', bg: 'rgba(34,197,94,0.10)', border: 'rgba(34,197,94,0.3)' },
  error:       { label: 'Error',  color: '#ef4444', bg: 'rgba(239,68,68,0.10)',  border: 'rgba(239,68,68,0.3)' },
  observation: { label: 'Obs.',   color: '#f59e0b', bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.3)' },
};

const SEVERITY_CONFIG = {
  'CRÍTICO':   { label: 'CRÍTICO', color: '#ef4444', bg: 'rgba(239,68,68,0.10)', border: 'rgba(239,68,68,0.3)' },
  RELEVANTE:   { label: 'RELEVANTE', color: '#f97316', bg: 'rgba(249,115,22,0.10)', border: 'rgba(249,115,22,0.3)' },
  MENOR:       { label: 'MENOR', color: '#eab308', bg: 'rgba(234,179,8,0.10)', border: 'rgba(234,179,8,0.3)' },
  FORMAL:      { label: 'FORMAL', color: '#3b82f6', bg: 'rgba(59,130,246,0.10)', border: 'rgba(59,130,246,0.3)' },
};

const SEVERITY_ORDER = ['CRÍTICO', 'RELEVANTE', 'MENOR', 'FORMAL'];

const LEVEL_COLOR = {
  Excelente: '#22c55e',
  Bueno:     '#3b82f6',
  Regular:   '#f59e0b',
  Deficiente:'#ef4444',
};

function getParagraphElement(node) {
  if (!node) return null;
  const baseElement = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
  return baseElement?.closest?.('[data-paragraph-index]') || null;
}

function getOffsetWithinElement(range, element, boundary) {
  const offsetRange = range.cloneRange();
  offsetRange.selectNodeContents(element);
  if (boundary === 'start') {
    offsetRange.setEnd(range.startContainer, range.startOffset);
  } else {
    offsetRange.setEnd(range.endContainer, range.endOffset);
  }
  return offsetRange.toString().length;
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildSelectionMatcher(text) {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return null;

  return new RegExp(escapeRegExp(normalized).replace(/\s+/g, '\\s+'), 'i');
}

function inferParagraphSelection(text, paragraphs = []) {
  const normalizedText = String(text || '').trim();
  if (!normalizedText) return null;

  const firstLine = normalizedText
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean);

  const candidateSnippets = Array.from(
    new Set([
      normalizedText,
      firstLine,
      normalizedText.slice(0, 240).trim(),
    ].filter(Boolean))
  );

  for (const snippet of candidateSnippets) {
    const matcher = buildSelectionMatcher(snippet);
    if (!matcher) continue;

    for (let index = 0; index < paragraphs.length; index += 1) {
      const paragraphText = String(paragraphs[index] || '');
      if (!paragraphText) continue;

      const exactIndex = paragraphText.indexOf(snippet);
      if (exactIndex >= 0) {
        return {
          text: normalizedText,
          paragraphIndex: index,
          startOffset: exactIndex,
          endOffset: exactIndex + snippet.length,
          paragraphText,
          spansMultipleParagraphs: snippet !== normalizedText || normalizedText.includes('\n'),
        };
      }

      const match = matcher.exec(paragraphText);
      if (match?.[0]) {
        return {
          text: normalizedText,
          paragraphIndex: index,
          startOffset: match.index,
          endOffset: match.index + match[0].length,
          paragraphText,
          spansMultipleParagraphs: snippet !== normalizedText || normalizedText.includes('\n'),
        };
      }
    }
  }

  return null;
}

function buildSelectionPayload(selection, paragraphs = []) {
  if (!selection?.rangeCount) return null;
  const range = selection.getRangeAt(0);
  const text = selection.toString().trim();
  if (!text || text.length <= 10) return null;

  const startParagraph = getParagraphElement(range.startContainer);
  const endParagraph = getParagraphElement(range.endContainer);
  const paragraphElement = startParagraph || endParagraph;
  if (!paragraphElement) {
    return inferParagraphSelection(text, paragraphs) || { text };
  }

  const paragraphIndex = Number(paragraphElement.dataset.paragraphIndex);
  const paragraphText = paragraphElement.textContent || '';
  const startOffset = getOffsetWithinElement(range, paragraphElement, 'start');
  const endOffset = getOffsetWithinElement(range, paragraphElement, 'end');

  return {
    text,
    paragraphIndex: Number.isNaN(paragraphIndex) ? -1 : paragraphIndex,
    startOffset,
    endOffset,
    paragraphText,
    spansMultipleParagraphs:
      !!startParagraph &&
      !!endParagraph &&
      startParagraph.dataset.paragraphIndex !== endParagraph.dataset.paragraphIndex,
  };
}

function normalizeFootnoteRecord(footnote) {
  const noteType = String(footnote?.note_type || footnote?.type || 'observation').trim().toLowerCase();
  const anchorTypeRaw = String(footnote?.anchor_type || 'paragraph').trim().toLowerCase();

  return {
    ...footnote,
    snippet: String(footnote?.snippet || '').trim(),
    // 'capture' es aditivo: cubre footnotes nacidas de una imagen pegada en el chat.
    // No implica anclaje textual; el render textual la ignora por design.
    anchor_type: ['line', 'phrase', 'paragraph', 'capture'].includes(anchorTypeRaw) ? anchorTypeRaw : 'paragraph',
    note_type: ['error', 'improvement', 'observation'].includes(noteType) ? noteType : 'observation',
    severity: normalizeSeverity(footnote?.severity),
    note_text: String(footnote?.note_text || footnote?.comment || '').trim(),
    comment: String(footnote?.comment || footnote?.note_text || '').trim(),
    type: ['error', 'improvement', 'observation'].includes(noteType) ? noteType : 'observation',
  };
}

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

function getFootnoteVisualConfig(footnote) {
  const severity = normalizeSeverity(footnote?.severity);
  if (severity && SEVERITY_CONFIG[severity]) {
    return { ...SEVERITY_CONFIG[severity], severity };
  }

  const noteType = String(footnote?.note_type || footnote?.type || 'observation').trim().toLowerCase();
  return {
    ...(FOOTNOTE_CONFIG[noteType] || FOOTNOTE_CONFIG.observation),
    severity: '',
  };
}

function buildSeveritySummary(footnotes) {
  const counts = footnotes.reduce((acc, rawFootnote) => {
    const severity = normalizeSeverity(rawFootnote?.severity);
    if (severity) {
      acc[severity] += 1;
    }
    return acc;
  }, {
    'CRÍTICO': 0,
    RELEVANTE: 0,
    MENOR: 0,
    FORMAL: 0,
  });

  return SEVERITY_ORDER
    .map((severity) => ({
      key: severity,
      count: counts[severity],
      ...SEVERITY_CONFIG[severity],
    }))
    .filter((item) => item.count > 0);
}

function getAnchorTypeLabel(anchorType) {
  switch (anchorType) {
    case 'line':
      return 'Línea';
    case 'phrase':
      return 'Frase';
    case 'capture':
      return 'Captura manuscrita';
    default:
      return 'Párrafo';
  }
}

// Referencia numerada del origen — honesta, sin fingir coordenadas:
//   [N] Párrafo X — Frase|Línea|Párrafo
//   [N] Sin párrafo identificado — Frase|Línea|Párrafo
//   [N] Captura manuscrita — Página P
//   [N] Captura manuscrita — Sin página exacta
function buildOriginReferenceText(fn) {
  if (!fn) return '';
  if (fn.anchor_type === 'capture') {
    return Number.isInteger(fn.page_hint)
      ? `Captura manuscrita — Página ${fn.page_hint}`
      : 'Captura manuscrita — Sin página exacta';
  }
  const paragraphPart = fn.paragraph_index >= 0
    ? `Párrafo ${fn.paragraph_index + 1}`
    : 'Sin párrafo identificado';
  const kindLabel = getAnchorTypeLabel(fn.anchor_type);
  return `${paragraphPart} — ${kindLabel}`;
}

function isPdfDocumentSource(doc) {
  const type = String(doc?.fileType || doc?.sourceFile?.type || '').toLowerCase();
  if (type.includes('pdf')) return true;

  const filename = String(doc?.sourceFile?.name || doc?.filename || '').toLowerCase().trim();
  return filename.endsWith('.pdf');
}

const CONFIDENCE_LABELS = {
  high: 'alta',
  medium: 'media',
  low: 'baja',
};

function formatConfidenceLabel(value) {
  const key = String(value || '').trim().toLowerCase();
  return CONFIDENCE_LABELS[key] || 'no estimada';
}

function getConfidenceVisual(value) {
  const key = String(value || '').trim().toLowerCase();
  if (key === 'high') return { color: '#16a34a', bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.35)' };
  if (key === 'medium') return { color: '#d97706', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.35)' };
  return { color: '#dc2626', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.35)' };
}

function getCapturePageReference(pageHint) {
  return Number.isInteger(pageHint) ? `Página ${pageHint}` : 'Sin página exacta';
}

function getCaptureDetectedFragment(rawText, maxChars = 170) {
  const normalized = String(rawText || '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) return null;
  if (normalized.length <= maxChars) return normalized;

  const sliced = normalized.slice(0, maxChars);
  const lastSpace = sliced.lastIndexOf(' ');
  return `${(lastSpace > 60 ? sliced.slice(0, lastSpace) : sliced).trim()}...`;
}

function findSnippetIndex(paragraphText, snippet) {
  const normalizedSnippet = String(snippet || '').trim();
  if (!normalizedSnippet) return -1;

  const directIndex = paragraphText.indexOf(normalizedSnippet);
  if (directIndex >= 0) return directIndex;

  return paragraphText.toLowerCase().indexOf(normalizedSnippet.toLowerCase());
}

function renderParagraphWithAnchors(paragraphText, footnotes, markerStyle) {
  const normalizedFootnotes = footnotes
    .map(normalizeFootnoteRecord)
    .map((footnote) => {
      const anchorIndex = footnote.anchor_type === 'paragraph'
        ? -1
        : findSnippetIndex(paragraphText, footnote.snippet);

      return {
        ...footnote,
        anchorIndex,
        anchorEnd: anchorIndex >= 0 ? anchorIndex + Math.max(footnote.snippet.length, 1) : -1,
      };
    })
    .sort((left, right) => {
      const leftIndex = left.anchorIndex >= 0 ? left.anchorIndex : Number.MAX_SAFE_INTEGER;
      const rightIndex = right.anchorIndex >= 0 ? right.anchorIndex : Number.MAX_SAFE_INTEGER;
      if (leftIndex !== rightIndex) return leftIndex - rightIndex;
      return left.number - right.number;
    });

  const nodes = [];
  const trailingMarkers = [];
  let cursor = 0;

  normalizedFootnotes.forEach((footnote) => {
    const canInline = footnote.anchorIndex >= cursor && footnote.anchorEnd > footnote.anchorIndex;

    if (!canInline) {
      trailingMarkers.push(footnote);
      return;
    }

    nodes.push(paragraphText.slice(cursor, footnote.anchorEnd));
    nodes.push(
      <sup
        key={`fn-inline-${footnote.number}`}
        style={markerStyle}
        title={`${getAnchorTypeLabel(footnote.anchor_type)} ${footnote.number}`}
      >
        [{footnote.number}]
      </sup>
    );
    cursor = footnote.anchorEnd;
  });

  nodes.push(paragraphText.slice(cursor));
  trailingMarkers.forEach((footnote) => {
    nodes.push(
      <sup
        key={`fn-trailing-${footnote.number}`}
        style={markerStyle}
        title={`${getAnchorTypeLabel(footnote.anchor_type)} ${footnote.number}`}
      >
        [{footnote.number}]
      </sup>
    );
  });

  return nodes;
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function CentralEvaluator({
  document: doc = null,
  rubric = null,
  methodologyConfig = null,
  evaluationHtml = null,
  onUploadDocument,
  onEvaluateDocument,
  onDeleteDocument,    // callback() — limpia el documento actual y vuelve al estado inicial
  isLoading = false,
  canEvaluate = false,
  onTextSelected,      // callback(selectedText: string)
  onAddExternalFootnote, // callback(text, context) — from ChatBubble
  onFootnotesChange,
  /** Oculta la toolbar interna (Subir / Evaluar / descargas) cuando App contrae el bloque superior completo. */
  suppressPrimaryToolbar = false,
}) {
  const fileInputRef   = useRef(null);
  const reportRef      = useRef(null);
  const documentAreaRef = useRef(null);
  const printRef       = useRef(null);
  const hybridPrintRef = useRef(null);

  const [footnoteResult, setFootnoteResult]     = useState(null);
  const [footnoteTexts, setFootnoteTexts]       = useState({});
  const [footnoteModes, setFootnoteModes]       = useState({}); // {num: 'view'|'editing'|'accepted'}
  const [complementText, setComplementText]     = useState({});
  const [isEvaluatingFootnotes, setIsEvaluatingFootnotes] = useState(false);
  const [extraFootnotes, setExtraFootnotes]     = useState([]); // footnotes added from chat
  const [showMatrix, setShowMatrix]             = useState(false);
  const [documentViewMode, setDocumentViewMode] = useState('original');
  const [currentPageHint, setCurrentPageHint]   = useState(null);

  // ── Text selection listener ─────────────────────────────────────────────────
  useEffect(() => {
    const container = documentAreaRef.current;
    if (!container) return;

    const handleMouseUp = () => {
      const selection = window.getSelection();
      const payload = buildSelectionPayload(selection, doc?.paragraphs || []);
      if (payload) {
        onTextSelected?.(payload);
      }
    };

    container.addEventListener('mouseup', handleMouseUp);
    return () => container.removeEventListener('mouseup', handleMouseUp);
  }, [doc?.paragraphs, onTextSelected]);

  // ── Accept external footnote from ChatBubble ────────────────────────────────
  useEffect(() => {
    if (!onAddExternalFootnote) return;
    // onAddExternalFootnote is a ref-based callback — handled via prop
  }, [onAddExternalFootnote]);

  // ── Reset transient evaluation state when document changes ──────────────────
  useEffect(() => {
    setFootnoteResult(null);
    setFootnoteTexts({});
    setFootnoteModes({});
    setComplementText({});
    setExtraFootnotes([]);
    setShowMatrix(false);
    setDocumentViewMode('original');
    setCurrentPageHint(null);
  }, [doc?.id]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const pageHint = Number.isInteger(currentPageHint) ? currentPageHint : null;
    window.dispatchEvent(
      new CustomEvent('evaluai:page-hint', {
        detail: {
          documentId: doc?.id || null,
          pageHint,
        },
      })
    );

    return undefined;
  }, [currentPageHint, doc?.id]);

  const addExternalFootnote = useCallback((text, context) => {
    const nextNum = (footnoteResult?.footnotes?.length || 0) + extraFootnotes.length + 1;

    // ── Rama CAPTURA MANUSCRITA ──────────────────────────────────────────────
    // Honestidad editorial: no hay anclaje textual. No buscamos snippet, no
    // tocamos `footnote_numbers` de ningún párrafo, no fingimos phrase/line.
    // El asset visual + transcripción viajan dentro del propio footnote como
    // evidencia trazable y se renderizan en una sección dedicada.
    if (context && typeof context === 'object' && context.source === 'manuscript_capture') {
      const captureFn = {
        number: nextNum,
        paragraph_index: -1,
        snippet: '',
        anchor_type: 'capture',
        note_type: 'observation',
        note_text: text,
        comment: text,
        type: 'observation',
        source: 'manuscript_capture',
        capture_asset: context.capture_asset || null,
        transcription: context.transcription || null,
        page_hint: Number.isInteger(context.page_hint) ? context.page_hint : null,
        suggested_footnote: context.suggested_footnote || null,
        isExternal: true,
      };
      setExtraFootnotes((prev) => [...prev, captureFn]);
      setFootnoteTexts((prev) => ({ ...prev, [nextNum]: text }));
      setFootnoteModes((prev) => ({ ...prev, [nextNum]: 'view' }));
      return;
    }

    // ── Rama TEXTUAL (flujo original, intacto) ────────────────────────────────
    let paragraphIndex = -1;
    const allParas = footnoteResult?.paragraphs || doc?.paragraphs?.map((paragraph, index) => ({ index, text: paragraph })) || [];

    if (context && typeof context === 'object' && Number.isInteger(context.paragraphIndex)) {
      paragraphIndex = context.paragraphIndex;
    } else if (typeof context === 'string' && allParas.length > 0) {
      const snippet = context.slice(0, 80).toLowerCase();
      for (const para of allParas) {
        if (para.text.toLowerCase().includes(snippet.slice(0, 40))) {
          paragraphIndex = para.index;
          break;
        }
      }
    }

    const snippet = typeof context === 'object'
      ? String(context?.text || context?.paragraphText || '').trim()
      : String(context || '').trim();
    const anchorType = context?.spansMultipleParagraphs
      ? 'paragraph'
      : snippet.includes('\n')
        ? 'line'
        : 'phrase';

    const newFn = {
      number: nextNum,
      paragraph_index: paragraphIndex,
      snippet,
      anchor_type: anchorType,
      note_type: 'observation',
      note_text: text,
      comment: text,
      type: 'observation',
      context,
      selection_start: context?.startOffset ?? null,
      selection_end: context?.endOffset ?? null,
      isExternal: true,
    };
    setExtraFootnotes((prev) => [...prev, newFn]);
    setFootnoteTexts((prev) => ({ ...prev, [nextNum]: text }));
    setFootnoteModes((prev) => ({ ...prev, [nextNum]: 'view' }));

    // Insertar el marcador [n] en el párrafo correspondiente
    if (paragraphIndex >= 0) {
      setFootnoteResult((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          paragraphs: prev.paragraphs.map((p) =>
            p.index === paragraphIndex
              ? { ...p, footnote_numbers: [...(p.footnote_numbers || []), nextNum] }
              : p
          ),
        };
      });
    }
  }, [footnoteResult, extraFootnotes, doc]);

  // Expose addExternalFootnote upward through callback ref pattern
  useEffect(() => {
    if (onAddExternalFootnote && typeof onAddExternalFootnote === 'object') {
      onAddExternalFootnote.current = addExternalFootnote;
    }
  }, [addExternalFootnote, onAddExternalFootnote]);

  // ── File upload ─────────────────────────────────────────────────────────────
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (file && onUploadDocument) onUploadDocument(file);
  };

  // ── Granular footnote evaluation ────────────────────────────────────────────
  const handleEvaluateFootnotes = useCallback(async () => {
    if (!doc || !rubric) return;
    setIsEvaluatingFootnotes(true);
    setFootnoteResult(null);
    setFootnoteModes({});
    setComplementText({});
    setExtraFootnotes([]);
    setShowMatrix(false);

    try {
      const token = localStorage.getItem('token') || '';
      const res = await fetch(`${API_BASE}/api/evaluate/footnotes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          document_id: doc.id,
          paragraphs: doc.paragraphs,
          rubric_markdown: rubric.markdown || rubric.contenido || '',
          evaluation_methodology: methodologyConfig?.metodologiaEvaluacion,
          custom_instruction: methodologyConfig?.instruccionIA,
          document_context: doc.multimodal || null,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Error en evaluación');
      }

      const data = await res.json();
      setFootnoteResult(data);

      // Init footnote texts and modes
      const initTexts = {};
      const initModes = {};
      (data.footnotes || []).forEach((fn) => {
        initTexts[fn.number] = fn.note_text || fn.comment;
        initModes[fn.number] = 'view';
      });
      setFootnoteTexts(initTexts);
      setFootnoteModes(initModes);
    } catch (err) {
      alert('Error en evaluación: ' + err.message);
    } finally {
      setIsEvaluatingFootnotes(false);
    }
  }, [doc, methodologyConfig, rubric]);

  // ── PDF export via hidden print container ───────────────────────────────────
  const handleDownloadPDF = useCallback(async () => {
    if (!printRef.current) return;
    await saveEvaluationPdf({
      sourceNode: printRef.current,
      filename: `evaluacion-${doc?.filename || 'documento'}.pdf`,
    });
  }, [doc]);

  // Nueva exportación híbrida REAL:
  // 1) toma el PDF original binario (sourceFile/previewUrl)
  // 2) anexa al final páginas nuevas de observaciones renderizadas
  // 3) descarga el PDF combinado.
  const handleDownloadOriginalWithNotes = useCallback(async () => {
    if (!hybridPrintRef.current) return;
    if (!isPdfDocumentSource(doc)) {
      alert('Esta exportación híbrida está disponible solo para documentos PDF por ahora.');
      return;
    }
    try {
      await saveOriginalPdfWithAppendedObservations({
        originalSourceFile: doc?.sourceFile || null,
        originalSourceUrl: doc?.previewUrl || null,
        appendixSourceNode: hybridPrintRef.current,
        filename: `original-con-observaciones-${doc?.filename || 'documento'}.pdf`,
      });
    } catch (error) {
      alert(error?.message || 'No se pudo generar el PDF original con observaciones.');
    }
  }, [doc]);

  const handleDownloadOriginal = useCallback(() => {
    const sourceFile = doc?.sourceFile;
    const downloadUrl = sourceFile ? URL.createObjectURL(sourceFile) : doc?.previewUrl;
    if (!downloadUrl) return;

    const anchor = document.createElement('a');
    anchor.href = downloadUrl;
    anchor.download = sourceFile?.name || doc?.filename || 'documento-original';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);

    if (sourceFile) {
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 0);
    }
  }, [doc]);

  // ── Delete footnote ──────────────────────────────────────────────────────────
  const deleteFootnote = useCallback((num) => {
    const extraFootnote = extraFootnotes.find((f) => f.number === num);
    const isExtra = !!extraFootnote;
    if (isExtra) {
      setExtraFootnotes((prev) => prev.filter((f) => f.number !== num));
      if (extraFootnote?.paragraph_index >= 0) {
        setFootnoteResult((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            paragraphs: prev.paragraphs.map((p) =>
              p.index === extraFootnote.paragraph_index
                ? { ...p, footnote_numbers: (p.footnote_numbers || []).filter((n) => n !== num) }
                : p
            ),
          };
        });
      }
    } else {
      // Eliminar de footnoteResult y limpiar los footnote_numbers del párrafo
      setFootnoteResult((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          footnotes: prev.footnotes.filter((f) => f.number !== num),
          paragraphs: prev.paragraphs.map((p) => ({
            ...p,
            footnote_numbers: (p.footnote_numbers || []).filter((n) => n !== num),
          })),
        };
      });
    }
    setFootnoteTexts((prev) => { const u = { ...prev }; delete u[num]; return u; });
    setFootnoteModes((prev) => { const u = { ...prev }; delete u[num]; return u; });
  }, [extraFootnotes]);

  // ── Footnote mode actions ───────────────────────────────────────────────────
  const setMode = (num, mode) => setFootnoteModes((p) => ({ ...p, [num]: mode }));

  const acceptFootnote = (num) => setMode(num, 'accepted');

  const toggleEdit = (num) => {
    setFootnoteModes((p) => ({ ...p, [num]: p[num] === 'editing' ? 'view' : 'editing' }));
  };

  const applyComplement = (num) => {
    const extra = (complementText[num] || '').trim();
    if (extra) {
      setFootnoteTexts((p) => ({ ...p, [num]: (p[num] || '') + '\n\n➕ ' + extra }));
    }
    setComplementText((p) => ({ ...p, [num]: '' }));
    setMode(num, 'accepted');
  };

  // ── Computed state ──────────────────────────────────────────────────────────
  const isProcessing  = isLoading || isEvaluatingFootnotes;
  const allFootnotes  = useMemo(
    () => [...(footnoteResult?.footnotes || []), ...extraFootnotes].map(normalizeFootnoteRecord),
    [footnoteResult, extraFootnotes]
  );
  const hasFootnotes  = allFootnotes.length > 0;
  const isHybridPdfSupported = isPdfDocumentSource(doc);
  const canDownloadOriginalWithNotes = hasFootnotes && isHybridPdfSupported;
  // Partición honesta: las capturas manuscritas no conviven con el render
  // textual; van a una sección dedicada con evidencia visual.
  const textualFootnotes = useMemo(
    () => allFootnotes.filter((fn) => fn.anchor_type !== 'capture'),
    [allFootnotes],
  );
  const captureFootnotes = useMemo(
    () => allFootnotes.filter((fn) => fn.anchor_type === 'capture'),
    [allFootnotes],
  );
  const evalMatrix    = footnoteResult?.evaluation_matrix;
  const acceptedCount = Object.values(footnoteModes).filter((m) => m === 'accepted').length;
  const displayParagraphs = footnoteResult?.paragraphs
    || doc?.paragraphs?.map((paragraph, index) => ({ index, text: paragraph, footnote_numbers: [] }))
    || [];
  const legacyDocumentView = hasFootnotes ? (
    <AnnotatedDocument
      paragraphs={displayParagraphs}
      footnotes={allFootnotes}
    />
  ) : (
    <div>
      {doc?.paragraphs?.map((paragraph, index) => (
        <p key={index} data-paragraph-index={index} style={s.paragraph}>{paragraph}</p>
      ))}
    </div>
  );

  useEffect(() => {
    onFootnotesChange?.(allFootnotes);
  }, [allFootnotes, onFootnotesChange]);

  useEffect(() => {
    if (!hasFootnotes && documentViewMode !== 'original') {
      setDocumentViewMode('original');
    }
  }, [documentViewMode, hasFootnotes]);

  // ── Empty state ─────────────────────────────────────────────────────────────
  if (!doc) {
    return (
      <div style={s.emptyState}>
        <div style={s.emptyCard}>
          <div style={s.emptyIcon}>📄</div>
          <h2 style={s.emptyTitle}>Sube un documento para evaluar</h2>
          <p style={s.emptyText}>PDF, DOCX o TXT. Extracción automática de texto.</p>
          <input type="file" ref={fileInputRef} onChange={handleFileUpload} style={{ display: 'none' }} accept=".pdf,.doc,.docx,.txt" />
          <button onClick={() => fileInputRef.current?.click()} disabled={isLoading} style={s.btnPrimary}>
            {isLoading ? '⏳ Procesando...' : '📄 Seleccionar Documento'}
          </button>
        </div>
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={s.wrapper}>
      <input type="file" ref={fileInputRef} onChange={handleFileUpload} style={{ display: 'none' }} accept=".pdf,.doc,.docx,.txt" />
      {/* ── Toolbar (oculta junto a la barra superior de App para ganar altura al visor) ── */}
      {!suppressPrimaryToolbar && (
      <div style={s.toolbar}>
        <div style={s.toolbarLeft}>
          <button onClick={() => fileInputRef.current?.click()} disabled={isProcessing} style={s.btnSecondary}>
            📄 Subir Otro
          </button>
          <button
            onClick={handleEvaluateFootnotes}
            disabled={!canEvaluate || isProcessing}
            style={{ ...s.btnEvaluar, opacity: !canEvaluate || isProcessing ? 0.5 : 1 }}
            title={!rubric ? 'Selecciona una rúbrica' : !doc ? 'Sube un documento' : 'Evaluar'}
          >
            {isProcessing ? '⏳ Evaluando...' : '🚀 Evaluar Documento'}
          </button>
          {!canEvaluate && (
            <span style={{ fontSize: '13px', color: '#f59e0b' }}>
              {!rubric ? '⚠️ Selecciona una rúbrica primero' : '⚠️ Falta documento'}
            </span>
          )}
          {onDeleteDocument && (
            <button
              onClick={() => {
                if (window.confirm('¿Eliminar este documento y limpiar la evaluación? La rúbrica activa se conservará.')) {
                  onDeleteDocument();
                }
              }}
              style={{ padding: '8px 14px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', color: '#fca5a5', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}
              title="Eliminar documento actual y preparar para el siguiente"
            >
              🗑️ Eliminar Documento
            </button>
          )}
        </div>

        <div style={s.toolbarRight}>
          {evalMatrix && (
            <button
              onClick={() => setShowMatrix((v) => !v)}
              style={{
                padding: '8px 14px',
                background: showMatrix ? 'rgba(79,70,229,0.25)' : 'rgba(79,70,229,0.1)',
                border: '1px solid rgba(79,70,229,0.4)',
                borderRadius: '8px',
                color: '#a5b4fc',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: '600',
              }}
            >
              📊 Matriz de Evaluación
            </button>
          )}
          {hasFootnotes && (
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>
              {acceptedCount}/{allFootnotes.length} aceptadas
            </span>
          )}
          <button
            onClick={handleDownloadOriginal}
            disabled={!doc?.sourceFile && !doc?.previewUrl}
            style={{ ...s.btnDownloadSecondary, opacity: !doc?.sourceFile && !doc?.previewUrl ? 0.4 : 1 }}
          >
            ⬇️ Descargar original
          </button>
          <button
            onClick={handleDownloadOriginalWithNotes}
            disabled={!canDownloadOriginalWithNotes}
            title={
              !hasFootnotes
                ? 'Aún no hay observaciones que anexar al original'
                : !isHybridPdfSupported
                  ? 'Disponible solo para documentos PDF por ahora'
                  : 'Exportar el PDF original real con páginas anexas de observaciones'
            }
            style={{ ...s.btnDownloadHybrid, opacity: !canDownloadOriginalWithNotes ? 0.4 : 1 }}
          >
            📝 Descargar original con observaciones
          </button>
          <button
            onClick={handleDownloadPDF}
            disabled={!hasFootnotes && !evaluationHtml}
            style={{ ...s.btnDownload, opacity: !hasFootnotes && !evaluationHtml ? 0.4 : 1 }}
          >
            ⬇️ Descargar evaluación
          </button>
        </div>
      </div>
      )}

      {/* ── Evaluation Matrix Panel ── */}
      {showMatrix && evalMatrix && (
        <EvaluationMatrixPanel matrix={evalMatrix} onClose={() => setShowMatrix(false)} />
      )}

      {/* ── Document area ── */}
      <div ref={documentAreaRef} style={s.documentArea}>
        {isProcessing && (
          <div style={s.loadingOverlay}>
            <div style={s.loadingCard}>
              <div style={{ ...s.spinner, animation: 'spin 0.8s linear infinite' }} />
              <h3 style={{ color: '#1e293b', margin: '16px 0 4px 0' }}>Auditando documento</h3>
              <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>
                El auditor IA está analizando línea por línea con temperature 0.0…
              </p>
            </div>
          </div>
        )}

        <div
          ref={reportRef}
          style={{
            ...s.reportSheet,
            maxWidth: EVALUATION_SHEET_LAYOUT.pageWidth,
            minHeight: EVALUATION_SHEET_LAYOUT.pageMinHeight,
            padding: EVALUATION_SHEET_LAYOUT.contentPadding,
          }}
        >
          {/* Cover */}
          <div style={s.cover}>
            <h1 style={s.docTitle}>{doc.filename}</h1>
            {rubric && (
              <p style={s.docSubtitle}>
                Rúbrica: <strong style={{ color: '#4f46e5' }}>{rubric.nombre || rubric.title}</strong>
              </p>
            )}
            {footnoteResult && (
              <div style={s.metricsRow}>
                <MetricBadge label="Total" value={footnoteResult.metrics?.total || 0} color="#4f46e5" />
                <MetricBadge label="Errores" value={footnoteResult.metrics?.error || 0} color="#ef4444" />
                <MetricBadge label="Mejoras" value={footnoteResult.metrics?.improvement || 0} color="#22c55e" />
                <MetricBadge label="Obs." value={footnoteResult.metrics?.observation || 0} color="#f59e0b" />
                {evalMatrix?.total_score !== undefined && (
                  <MetricBadge
                    label="Puntaje"
                    value={`${evalMatrix.total_score}/100`}
                    color={LEVEL_COLOR[evalMatrix.overall_level] || '#4f46e5'}
                  />
                )}
              </div>
            )}
          </div>

          {/* Original document */}
          <div style={s.section}>
            <div style={s.sectionHeader}>
              <h2 style={s.sectionTitle}>Documento Original</h2>
              {hasFootnotes && (
                <div style={s.viewModeSwitch}>
                  <button
                    onClick={() => setDocumentViewMode('original')}
                    style={{
                      ...s.viewModeButton,
                      ...(documentViewMode === 'original' ? s.viewModeButtonActive : {}),
                    }}
                  >
                    Vista original
                  </button>
                  <button
                    onClick={() => setDocumentViewMode('annotated')}
                    style={{
                      ...s.viewModeButton,
                      ...(documentViewMode === 'annotated' ? s.viewModeButtonActive : {}),
                    }}
                  >
                    Vista anotada
                  </button>
                </div>
              )}
            </div>
            <div style={s.docBody}>
              {documentViewMode === 'original' ? (
                <DocumentPreview
                  doc={doc}
                  fallback={legacyDocumentView}
                  onPageHintChange={setCurrentPageHint}
                />
              ) : (
                legacyDocumentView
              )}
            </div>
          </div>

          {/* Footnotes textuales (flujo sano: texto nativo + selección) */}
          {textualFootnotes.length > 0 && (
            <FootnotesSection
              footnotes={textualFootnotes}
              footnoteTexts={footnoteTexts}
              setFootnoteTexts={setFootnoteTexts}
              footnoteModes={footnoteModes}
              complementText={complementText}
              setComplementText={setComplementText}
              onAccept={acceptFootnote}
              onStartEdit={toggleEdit}
              onApplyComplement={applyComplement}
              onDelete={deleteFootnote}
              onRequestChatComplement={(num) => {
                const fn = allFootnotes.find((f) => f.number === num);
                if (fn) onTextSelected?.(`[Nota ${num}] ${fn.note_text || fn.comment}`);
              }}
            />
          )}

          {/* Observaciones sobre fragmentos capturados (captura manuscrita) */}
          {captureFootnotes.length > 0 && (
            <CaptureFootnotesSection
              footnotes={captureFootnotes}
              footnoteTexts={footnoteTexts}
              setFootnoteTexts={setFootnoteTexts}
              footnoteModes={footnoteModes}
              complementText={complementText}
              setComplementText={setComplementText}
              onAccept={acceptFootnote}
              onStartEdit={toggleEdit}
              onApplyComplement={applyComplement}
              onDelete={deleteFootnote}
              onRequestChatComplement={(num) => {
                const fn = allFootnotes.find((f) => f.number === num);
                if (fn) onTextSelected?.(`[Nota ${num}] ${fn.note_text || fn.comment}`);
              }}
            />
          )}

          {/* Legacy HTML evaluation */}
          {!hasFootnotes && evaluationHtml && (
            <div style={s.section}>
              <h2 style={s.sectionTitle}>Reporte de Evaluación</h2>
              <div
                style={{ fontFamily: 'Georgia, serif', lineHeight: 1.7, color: '#1e293b' }}
                dangerouslySetInnerHTML={{ __html: evaluationHtml }}
              />
            </div>
          )}
        </div>
      </div>

      {/* ── Hidden Print Container ── */}
      <PrintContainer
        ref={printRef}
        doc={doc}
        rubric={rubric}
        evaluationHtml={evaluationHtml}
        footnoteResult={footnoteResult}
        allFootnotes={allFootnotes}
        captureFootnotes={captureFootnotes}
        footnoteTexts={footnoteTexts}
        footnoteModes={footnoteModes}
        evalMatrix={evalMatrix}
      />

      {/* ── Hidden Hybrid Print Container (original + observaciones) ── */}
      <HybridPrintContainer
        ref={hybridPrintRef}
        doc={doc}
        rubric={rubric}
        allFootnotes={allFootnotes}
        footnoteTexts={footnoteTexts}
      />
    </div>
  );
}

// ── Annotated Document (superscripts) ─────────────────────────────────────────

function AnnotatedDocument({ paragraphs, footnotes }) {
  const footnotesByParagraph = {};
  footnotes.forEach((rawFootnote) => {
    const footnote = normalizeFootnoteRecord(rawFootnote);
    if (footnote.paragraph_index >= 0) {
      if (!footnotesByParagraph[footnote.paragraph_index]) footnotesByParagraph[footnote.paragraph_index] = [];
      footnotesByParagraph[footnote.paragraph_index].push(footnote);
    }
  });

  return (
    <div>
      {paragraphs.map((para) => {
        const paragraphFootnotes = footnotesByParagraph[para.index] || [];
        return (
          <p key={para.index} data-paragraph-index={para.index} style={s.paragraph}>
            {renderParagraphWithAnchors(para.text, paragraphFootnotes, s.superscript)}
          </p>
        );
      })}
    </div>
  );
}

// ── Footnotes Section ──────────────────────────────────────────────────────────

function FootnotesSection({
  footnotes,
  footnoteTexts,
  setFootnoteTexts,
  footnoteModes,
  complementText,
  setComplementText,
  onAccept,
  onStartEdit,
  onApplyComplement,
  onDelete,
  onRequestChatComplement,
}) {
  return (
    <div style={s.footnotesSection}>
      <div style={s.footnotesDivider} />
      <h2 style={s.sectionTitle}>Notas de Retroalimentación</h2>
      <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '20px' }}>
        Revisa cada anotación. Usa <strong>[Modificar]</strong> para editar, <strong>[Complementar con Chat]</strong> para pedir ayuda al Agente IA, y <strong>[Aceptar]</strong> para confirmar.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {footnotes.map((rawFootnote) => {
          const fn = normalizeFootnoteRecord(rawFootnote);
          const cfg = getFootnoteVisualConfig(fn);
          const mode = footnoteModes[fn.number] || 'view';
          const isAccepted = mode === 'accepted';
          const isEditing  = mode === 'editing';

          return (
            <div
              key={fn.number}
              style={{
                ...s.footnoteCard,
                background: isAccepted ? 'rgba(34,197,94,0.06)' : cfg.bg,
                border: `1px solid ${isAccepted ? 'rgba(34,197,94,0.4)' : cfg.border}`,
              }}
            >
              {/* Header */}
              <div style={s.footnoteHeader}>
                <span style={{ ...s.footnoteNum, background: cfg.color }}>[{fn.number}]</span>
                <span style={{ ...s.footnoteType, color: cfg.color }}>{cfg.label}</span>
                {fn.paragraph_index >= 0 && (
                  <span style={{ color: '#94a3b8', fontSize: '12px' }}>Párrafo {fn.paragraph_index + 1}</span>
                )}
                <span style={{ color: '#94a3b8', fontSize: '12px' }}>
                  {getAnchorTypeLabel(fn.anchor_type)}
                </span>
                {fn.isExternal && (
                  <span style={{ color: '#a5b4fc', fontSize: '11px', fontWeight: '600' }}>💬 Desde Chat</span>
                )}
                {isAccepted && (
                  <span style={s.acceptedBadge}>✓ Aceptada</span>
                )}
              </div>

              {fn.snippet && (
                <div style={s.footnoteAnchorPreview}>
                  <strong style={{ color: '#334155' }}>Anclaje:</strong> "{fn.snippet}"
                </div>
              )}

              {/* Content — editable when in editing mode */}
              {isEditing ? (
                <textarea
                  value={footnoteTexts[fn.number] || fn.note_text || fn.comment}
                  onChange={(e) => setFootnoteTexts((p) => ({ ...p, [fn.number]: e.target.value }))}
                  style={{ ...s.footnoteTextarea, borderColor: 'rgba(79,70,229,0.5)' }}
                  rows={3}
                  autoFocus
                />
              ) : (
                <div style={{ ...s.footnoteReadonly, opacity: isAccepted ? 0.8 : 1 }}>
                  {footnoteTexts[fn.number] || fn.note_text || fn.comment}
                </div>
              )}

              {/* Actions */}
              {!isAccepted && (
                <div style={s.footnoteActions}>
                  <button
                    onClick={() => onStartEdit(fn.number)}
                    style={s.btnModify}
                  >
                    ✏️ {isEditing ? 'Guardar cambios' : 'Modificar'}
                  </button>
                  <button
                    onClick={() => onRequestChatComplement(fn.number)}
                    style={s.btnChatComplement}
                  >
                    💬 Complementar con Chat
                  </button>
                  <button onClick={() => onAccept(fn.number)} style={s.btnAccept}>
                    ✓ Aceptar
                  </button>
                  {onDelete && (
                    <button
                      onClick={() => onDelete(fn.number)}
                      style={s.btnReject}
                      title="Rechazar y eliminar esta nota"
                    >
                      ✕ Rechazar
                    </button>
                  )}
                </div>
              )}
              {/* Accepted — allow rejecting after the fact */}
              {isAccepted && onDelete && (
                <div style={{ marginTop: '8px' }}>
                  <button
                    onClick={() => onDelete(fn.number)}
                    style={{ ...s.btnReject, fontSize: '11px', padding: '4px 10px' }}
                    title="Eliminar esta nota aceptada"
                  >
                    ✕ Eliminar
                  </button>
                </div>
              )}

              {/* Complement sub-area — always visible when not accepted */}
              {!isAccepted && (
                <div style={{ marginTop: '8px' }}>
                  <textarea
                    value={complementText[fn.number] || ''}
                    onChange={(e) => setComplementText((p) => ({ ...p, [fn.number]: e.target.value }))}
                    placeholder="Añade tu observación adicional y presiona Aplicar…"
                    style={s.complementTextarea}
                    rows={2}
                  />
                  {(complementText[fn.number] || '').trim() && (
                    <button onClick={() => onApplyComplement(fn.number)} style={s.btnApplyComplement}>
                      Aplicar y Aceptar
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Capture Footnotes Section (manuscrito) ─────────────────────────────────────

function CaptureFootnotesSection({
  footnotes,
  footnoteTexts,
  setFootnoteTexts,
  footnoteModes,
  complementText,
  setComplementText,
  onAccept,
  onStartEdit,
  onApplyComplement,
  onDelete,
  onRequestChatComplement,
}) {
  return (
    <div style={s.footnotesSection}>
      <div style={s.footnotesDivider} />
      <h2 style={s.sectionTitle}>Observaciones sobre fragmentos capturados</h2>
      <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '8px' }}>
        Notas originadas desde una captura manuscrita pegada en el chat. La transcripción es aproximada y la confianza se muestra explícitamente; no representan cita literal del documento.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {footnotes.map((rawFootnote) => {
          const fn = normalizeFootnoteRecord(rawFootnote);
          const cfg = getFootnoteVisualConfig(fn);
          const mode = footnoteModes[fn.number] || 'view';
          const isAccepted = mode === 'accepted';
          const isEditing  = mode === 'editing';
          const asset = fn.capture_asset || {};
          const transcription = fn.transcription || {};
          const confidenceLabel = formatConfidenceLabel(transcription.confidence);
          const confidenceVisual = getConfidenceVisual(transcription.confidence);
          const transcribedText = String(transcription.text || (transcription.paragraphs || []).join('\n') || '').trim();
          const detectedFragment = getCaptureDetectedFragment(transcribedText);

          return (
            <div
              key={fn.number}
              style={{
                ...s.footnoteCard,
                background: isAccepted ? 'rgba(34,197,94,0.06)' : cfg.bg,
                border: `1px solid ${isAccepted ? 'rgba(34,197,94,0.4)' : cfg.border}`,
              }}
            >
              {/* Header */}
              <div style={s.footnoteHeader}>
                <span style={{ ...s.footnoteNum, background: cfg.color }}>[{fn.number}]</span>
                <span style={{ ...s.footnoteType, color: cfg.color }}>{cfg.label}</span>
                <span style={{ color: '#a5b4fc', fontSize: '11px', fontWeight: '600' }}>📎 {buildOriginReferenceText(fn)}</span>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: '700',
                    padding: '2px 8px',
                    borderRadius: '10px',
                    color: confidenceVisual.color,
                    background: confidenceVisual.bg,
                    border: `1px solid ${confidenceVisual.border}`,
                  }}
                >
                  Confianza {confidenceLabel}
                </span>
                {isAccepted && (
                  <span style={s.acceptedBadge}>✓ Aceptada</span>
                )}
              </div>
              <div style={{ ...s.footnoteAnchorPreview, marginBottom: '10px', background: 'rgba(148,163,184,0.08)' }}>
                <div><strong style={{ color: '#334155' }}>Origen:</strong> Captura manuscrita</div>
                <div><strong style={{ color: '#334155' }}>Página:</strong> {getCapturePageReference(fn.page_hint)}</div>
                <div style={{ whiteSpace: 'pre-wrap' }}>
                  <strong style={{ color: '#334155' }}>Fragmento detectado:</strong>{' '}
                  {detectedFragment ? `“${detectedFragment}”` : 'no disponible'}
                </div>
              </div>

              {/* Evidencia + transcripción */}
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', marginBottom: '10px' }}>
                {asset.thumbnail_data_url ? (
                  <img
                    src={asset.thumbnail_data_url}
                    alt={`Evidencia captura ${fn.number}`}
                    style={{
                      width: '120px',
                      height: 'auto',
                      maxHeight: '140px',
                      objectFit: 'contain',
                      border: '1px solid rgba(0,0,0,0.12)',
                      borderRadius: '8px',
                      background: '#fff',
                      flexShrink: 0,
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: '120px',
                      minHeight: '90px',
                      border: '1px dashed rgba(0,0,0,0.15)',
                      borderRadius: '8px',
                      background: '#fff',
                      color: '#94a3b8',
                      fontSize: '11px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      textAlign: 'center',
                      padding: '6px',
                      flexShrink: 0,
                    }}
                  >
                    Sin miniatura
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {transcribedText ? (
                    <div style={{ ...s.footnoteAnchorPreview, whiteSpace: 'pre-wrap' }}>
                      <strong style={{ color: '#334155' }}>Transcripción aproximada (completa):</strong>{' '}
                      {transcribedText}
                    </div>
                  ) : (
                    <div style={{ ...s.footnoteAnchorPreview, fontStyle: 'italic', color: '#94a3b8' }}>
                      Sin transcripción legible en la captura.
                    </div>
                  )}
                </div>
              </div>

              {/* Nota del profesor (editable igual que las textuales) */}
              {isEditing ? (
                <textarea
                  value={footnoteTexts[fn.number] || fn.note_text || fn.comment}
                  onChange={(e) => setFootnoteTexts((p) => ({ ...p, [fn.number]: e.target.value }))}
                  style={{ ...s.footnoteTextarea, borderColor: 'rgba(79,70,229,0.5)' }}
                  rows={3}
                  autoFocus
                />
              ) : (
                <div style={{ ...s.footnoteReadonly, opacity: isAccepted ? 0.8 : 1 }}>
                  {footnoteTexts[fn.number] || fn.note_text || fn.comment}
                </div>
              )}

              {/* Acciones (reutilizadas) */}
              {!isAccepted && (
                <div style={s.footnoteActions}>
                  <button onClick={() => onStartEdit(fn.number)} style={s.btnModify}>
                    ✏️ {isEditing ? 'Guardar cambios' : 'Modificar'}
                  </button>
                  <button onClick={() => onRequestChatComplement(fn.number)} style={s.btnChatComplement}>
                    💬 Complementar con Chat
                  </button>
                  <button onClick={() => onAccept(fn.number)} style={s.btnAccept}>
                    ✓ Aceptar
                  </button>
                  {onDelete && (
                    <button
                      onClick={() => onDelete(fn.number)}
                      style={s.btnReject}
                      title="Rechazar y eliminar esta nota"
                    >
                      ✕ Rechazar
                    </button>
                  )}
                </div>
              )}
              {isAccepted && onDelete && (
                <div style={{ marginTop: '8px' }}>
                  <button
                    onClick={() => onDelete(fn.number)}
                    style={{ ...s.btnReject, fontSize: '11px', padding: '4px 10px' }}
                    title="Eliminar esta nota aceptada"
                  >
                    ✕ Eliminar
                  </button>
                </div>
              )}

              {!isAccepted && (
                <div style={{ marginTop: '8px' }}>
                  <textarea
                    value={complementText[fn.number] || ''}
                    onChange={(e) => setComplementText((p) => ({ ...p, [fn.number]: e.target.value }))}
                    placeholder="Añade tu observación adicional y presiona Aplicar…"
                    style={s.complementTextarea}
                    rows={2}
                  />
                  {(complementText[fn.number] || '').trim() && (
                    <button onClick={() => onApplyComplement(fn.number)} style={s.btnApplyComplement}>
                      Aplicar y Aceptar
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Evaluation Matrix Panel ────────────────────────────────────────────────────

function EvaluationMatrixPanel({ matrix, onClose }) {
  if (!matrix) return null;
  const criteria = matrix.criteria || [];
  const levelColor = LEVEL_COLOR[matrix.overall_level] || '#4f46e5';

  return (
    <div
      style={{
        background: '#fff',
        borderTop: '2px solid #4f46e5',
        borderBottom: '2px solid #4f46e5',
        padding: '24px 28px',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#1e293b' }}>
          📊 Matriz de Evaluación Final
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: '800', color: levelColor }}>
              {matrix.total_score}/100
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>
              {matrix.overall_level}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '18px' }}>✕</button>
        </div>
      </div>

      {/* Criteria table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              {['Criterio', 'Peso', 'Puntaje', 'Nivel', 'Ejemplos clave'].map((h) => (
                <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: '700', color: '#475569', borderBottom: '2px solid #e2e8f0', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {criteria.map((c, i) => {
              const cLvl = c.level || (c.score >= 9 ? 'Excelente' : c.score >= 7 ? 'Bueno' : c.score >= 5 ? 'Regular' : 'Deficiente');
              return (
                <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '10px 12px', fontWeight: '600', color: '#1e293b' }}>{c.criterion}</td>
                  <td style={{ padding: '10px 12px', color: '#475569' }}>{c.weight}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ fontWeight: '700', color: LEVEL_COLOR[cLvl] || '#4f46e5' }}>
                      {c.score}/{c.max_score}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ background: `${LEVEL_COLOR[cLvl] || '#4f46e5'}15`, color: LEVEL_COLOR[cLvl] || '#4f46e5', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '700' }}>
                      {cLvl}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', color: '#64748b', fontSize: '12px' }}>
                    {(c.key_examples || []).join(' | ') || '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {matrix.general_summary && (
        <div style={{ marginTop: '16px', padding: '12px 16px', background: '#f8fafc', borderRadius: '8px', color: '#475569', fontSize: '13px', lineHeight: 1.6 }}>
          <strong style={{ color: '#1e293b' }}>Valoración global: </strong>{matrix.general_summary}
        </div>
      )}
    </div>
  );
}

// ── Hidden Print Container ─────────────────────────────────────────────────────

export const PrintContainer = React.forwardRef(function PrintContainer(
  { doc, rubric, evaluationHtml, footnoteResult, allFootnotes, captureFootnotes = [], footnoteTexts, footnoteModes, evalMatrix },
  ref,
) {
  if (!doc) return null;

  const visibleFootnotes = allFootnotes.map(normalizeFootnoteRecord);
  // Las capturas manuscritas NO se listan en el bloque textual del PDF: se
  // exportan aparte, con miniatura + transcripción + confianza.
  const textualFootnotesPrint = visibleFootnotes.filter((fn) => fn.anchor_type !== 'capture');
  const captureFootnotesPrint = (captureFootnotes && captureFootnotes.length > 0
    ? captureFootnotes
    : visibleFootnotes.filter((fn) => fn.anchor_type === 'capture')
  ).map(normalizeFootnoteRecord);
  const severitySummary = buildSeveritySummary(visibleFootnotes);
  const levelColor = evalMatrix ? (LEVEL_COLOR[evalMatrix.overall_level] || '#4f46e5') : '#4f46e5';
  const printableParagraphs = footnoteResult?.paragraphs
    || doc.paragraphs?.map((paragraph, index) => ({ index, text: paragraph, footnote_numbers: [] }))
    || [];
  const printableFootnotesByParagraph = {};
  textualFootnotesPrint.forEach((footnote) => {
    if (footnote.paragraph_index >= 0) {
      if (!printableFootnotesByParagraph[footnote.paragraph_index]) {
        printableFootnotesByParagraph[footnote.paragraph_index] = [];
      }
      printableFootnotesByParagraph[footnote.paragraph_index].push(footnote);
    }
  });

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute',
        left: '-9999px',
        top: 0,
        width: EVALUATION_SHEET_LAYOUT.pageWidth,
        maxWidth: EVALUATION_SHEET_LAYOUT.pageWidth,
        minHeight: EVALUATION_SHEET_LAYOUT.pageMinHeight,
        padding: EVALUATION_SHEET_LAYOUT.contentPadding,
        margin: '0 auto',
        boxSizing: 'border-box',
        fontFamily: 'Georgia, "Times New Roman", serif',
        color: '#1a1a1a',
        fontSize: '11pt',
        lineHeight: 1.7,
        background: '#fff',
      }}
    >
      {/* Cover */}
      <div style={{ textAlign: 'center', borderBottom: '2px solid #1a1a1a', paddingBottom: '16px', marginBottom: '24px', pageBreakInside: 'avoid', breakInside: 'avoid' }}>
        <h1 style={{ fontFamily: 'system-ui, sans-serif', fontSize: '22pt', fontWeight: '800', margin: '0 0 8px 0' }}>
          {doc.filename}
        </h1>
        {rubric && (
          <p style={{ fontFamily: 'system-ui, sans-serif', fontSize: '12pt', color: '#555', margin: 0 }}>
            Evaluado con rúbrica: <strong>{rubric.nombre || rubric.title}</strong>
          </p>
        )}
        {evalMatrix && (
          <div style={{ marginTop: '16px', fontFamily: 'system-ui, sans-serif' }}>
            <span style={{ fontWeight: '800', fontSize: '18pt', color: levelColor }}>
              {evalMatrix.total_score}/100
            </span>
            <span style={{ marginLeft: '12px', fontSize: '12pt', color: '#555' }}>
              {evalMatrix.overall_level}
            </span>
          </div>
        )}
        <p style={{ fontFamily: 'system-ui, sans-serif', fontSize: '10pt', color: '#888', margin: '8px 0 0 0' }}>
          Generado por EvaluAI · {new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Original document with superscripts */}
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontFamily: 'system-ui, sans-serif', fontSize: '13pt', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', borderLeft: '4px solid #4f46e5', paddingLeft: '12px', marginBottom: '16px', pageBreakInside: 'avoid', breakInside: 'avoid' }}>
          Documento Original
        </h2>
        {printableParagraphs.length > 0 ? (
          printableParagraphs.map((para) => {
            const paragraphFootnotes = printableFootnotesByParagraph[para.index] || [];
            return (
              <p key={para.index} style={{ marginBottom: '12px', textAlign: 'justify', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                {renderParagraphWithAnchors(para.text, paragraphFootnotes, {
                  color: '#4f46e5',
                  fontWeight: '700',
                  fontSize: '8pt',
                  marginLeft: '1px',
                })}
              </p>
            );
          })
        ) : (
          doc.paragraphs?.map((p, i) => (
            <p key={i} style={{ marginBottom: '12px', textAlign: 'justify', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{p}</p>
          ))
        )}
      </div>

      {/* Footnotes visibles (texto nativo + selección) */}
      {textualFootnotesPrint.length > 0 && (
        <div style={{ borderTop: '2px solid #1a1a1a', paddingTop: '20px', marginBottom: '24px', pageBreakBefore: 'auto' }}>
          <h2 style={{ fontFamily: 'system-ui, sans-serif', fontSize: '13pt', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', borderLeft: '4px solid #4f46e5', paddingLeft: '12px', marginBottom: '16px', pageBreakInside: 'avoid', breakInside: 'avoid' }}>
            Notas de Retroalimentación ({textualFootnotesPrint.length})
          </h2>
          {textualFootnotesPrint.map((fn) => {
            const cfg = getFootnoteVisualConfig(fn);
            const mode = footnoteModes[fn.number] || 'view';
            return (
              <div key={fn.number} style={{ marginBottom: '10px', padding: '10px 14px', borderLeft: `3px solid ${cfg.color}`, background: '#fafafa', pageBreakInside: 'avoid', breakInside: 'avoid' }} data-pdf-avoid-break="true">
                <div style={{ fontFamily: 'system-ui, sans-serif', fontSize: '10pt', fontWeight: '700', marginBottom: '4px', color: cfg.color }}>
                  [{fn.number}] {cfg.label}
                  {fn.paragraph_index >= 0 ? ` — Párrafo ${fn.paragraph_index + 1}` : ''}
                  {` — ${getAnchorTypeLabel(fn.anchor_type)}`}
                </div>
                {fn.snippet && (
                  <div style={{ fontFamily: 'system-ui, sans-serif', fontSize: '9pt', color: '#475569', marginBottom: '6px' }}>
                    Anclaje: "{fn.snippet}"
                  </div>
                )}
                <div style={{ fontSize: '11pt', overflowWrap: 'anywhere', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                  {footnoteTexts[fn.number] || fn.note_text || fn.comment}
                </div>
                <div style={{ fontFamily: 'system-ui, sans-serif', fontSize: '8pt', color: '#64748b', marginTop: '6px' }}>
                  Estado visual: {mode === 'accepted' ? 'Aceptada' : mode === 'editing' ? 'Editando' : 'Visible'}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Observaciones sobre fragmentos capturados (captura manuscrita) */}
      {captureFootnotesPrint.length > 0 && (
        <div style={{ borderTop: '2px solid #1a1a1a', paddingTop: '20px', marginBottom: '24px', pageBreakBefore: 'auto' }}>
          <h2 style={{ fontFamily: 'system-ui, sans-serif', fontSize: '13pt', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', borderLeft: '4px solid #f59e0b', paddingLeft: '12px', marginBottom: '8px', pageBreakInside: 'avoid', breakInside: 'avoid' }}>
            Observaciones sobre Fragmentos Capturados ({captureFootnotesPrint.length})
          </h2>
          <div style={{ fontFamily: 'system-ui, sans-serif', fontSize: '9pt', color: '#64748b', marginBottom: '12px', fontStyle: 'italic' }}>
            Notas originadas desde una captura manuscrita pegada en el chat. No representan cita literal del documento.
          </div>
          {captureFootnotesPrint.map((fn) => {
            const cfg = getFootnoteVisualConfig(fn);
            const mode = footnoteModes[fn.number] || 'view';
            const asset = fn.capture_asset || {};
            const transcription = fn.transcription || {};
            const confidenceLabel = formatConfidenceLabel(transcription.confidence);
            const confidenceVisual = getConfidenceVisual(transcription.confidence);
            const transcribedText = String(transcription.text || (transcription.paragraphs || []).join('\n') || '').trim();
            const detectedFragment = getCaptureDetectedFragment(transcribedText);
            return (
              <div key={fn.number} style={{ marginBottom: '12px', padding: '10px 14px', borderLeft: `3px solid ${cfg.color}`, background: '#fafafa', pageBreakInside: 'avoid', breakInside: 'avoid' }} data-pdf-avoid-break="true">
                <div style={{ fontFamily: 'system-ui, sans-serif', fontSize: '10pt', fontWeight: '700', marginBottom: '6px', color: cfg.color }}>
                  [{fn.number}] {buildOriginReferenceText(fn)}
                </div>
                <div style={{ fontFamily: 'system-ui, sans-serif', fontSize: '9pt', color: '#475569', marginBottom: '8px', lineHeight: 1.45 }}>
                  <div><strong>Origen:</strong> Captura manuscrita</div>
                  <div><strong>Página:</strong> {getCapturePageReference(fn.page_hint)}</div>
                  <div style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                    <strong>Fragmento detectado:</strong> {detectedFragment ? `“${detectedFragment}”` : 'no disponible'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', marginBottom: '8px' }}>
                  {asset.thumbnail_data_url ? (
                    <img
                      src={asset.thumbnail_data_url}
                      alt={`Evidencia captura ${fn.number}`}
                      style={{ width: '90px', height: 'auto', maxHeight: '110px', objectFit: 'contain', border: '1px solid #d1d5db', borderRadius: '4px', background: '#fff' }}
                    />
                  ) : (
                    <div style={{ width: '90px', minHeight: '60px', border: '1px dashed #cbd5e1', borderRadius: '4px', background: '#fff', color: '#94a3b8', fontFamily: 'system-ui, sans-serif', fontSize: '8pt', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '4px' }}>
                      Sin miniatura
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'inline-block', fontFamily: 'system-ui, sans-serif', fontSize: '8pt', fontWeight: '700', padding: '2px 8px', borderRadius: '10px', color: confidenceVisual.color, background: confidenceVisual.bg, border: `1px solid ${confidenceVisual.border}`, marginBottom: '6px' }}>
                      Confianza {confidenceLabel}
                    </div>
                    {transcribedText ? (
                      <div style={{ fontFamily: 'system-ui, sans-serif', fontSize: '9pt', color: '#334155', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', wordBreak: 'break-word', marginBottom: '4px' }}>
                        <strong>Transcripción aproximada (completa):</strong>
                        <div>{transcribedText}</div>
                      </div>
                    ) : (
                      <div style={{ fontFamily: 'system-ui, sans-serif', fontSize: '9pt', color: '#94a3b8', fontStyle: 'italic', marginBottom: '4px' }}>
                        Sin transcripción legible.
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ fontSize: '11pt', overflowWrap: 'anywhere', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                  {footnoteTexts[fn.number] || fn.note_text || fn.comment}
                </div>
                <div style={{ fontFamily: 'system-ui, sans-serif', fontSize: '8pt', color: '#64748b', marginTop: '6px' }}>
                  Estado visual: {mode === 'accepted' ? 'Aceptada' : mode === 'editing' ? 'Editando' : 'Visible'}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!visibleFootnotes.length && !footnoteResult?.paragraphs && evaluationHtml && (
        <div style={{ borderTop: '2px solid #1a1a1a', paddingTop: '20px', marginBottom: '24px' }}>
          <h2 style={{ fontFamily: 'system-ui, sans-serif', fontSize: '13pt', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', borderLeft: '4px solid #4f46e5', paddingLeft: '12px', marginBottom: '16px', pageBreakInside: 'avoid', breakInside: 'avoid' }}>
            Reporte de Evaluación
          </h2>
          <div
            style={{ fontFamily: 'Georgia, "Times New Roman", serif', lineHeight: 1.7, color: '#1a1a1a' }}
            dangerouslySetInnerHTML={{ __html: evaluationHtml }}
          />
        </div>
      )}

      {severitySummary.length > 0 && (
        <div style={{ borderTop: '2px solid #1a1a1a', paddingTop: '20px', marginBottom: '24px', pageBreakInside: 'avoid', breakInside: 'avoid' }}>
          <h2 style={{ fontFamily: 'system-ui, sans-serif', fontSize: '13pt', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', borderLeft: '4px solid #4f46e5', paddingLeft: '12px', marginBottom: '16px', pageBreakInside: 'avoid', breakInside: 'avoid' }}>
            Resumen por Severidad
          </h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            {severitySummary.map((item) => (
              <div
                key={item.key}
                style={{
                  minWidth: '38mm',
                  padding: '10px 12px',
                  border: `1px solid ${item.border}`,
                  borderRadius: '8px',
                  background: item.bg,
                  fontFamily: 'system-ui, sans-serif',
                  pageBreakInside: 'avoid',
                  breakInside: 'avoid',
                }}
              >
                <div style={{ fontSize: '9pt', fontWeight: '700', color: item.color, marginBottom: '4px' }}>
                  {item.label}
                </div>
                <div style={{ fontSize: '18pt', fontWeight: '800', color: '#111827', lineHeight: 1 }}>
                  {item.count}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Evaluation Matrix */}
      {evalMatrix && (
        <div style={{ borderTop: '2px solid #1a1a1a', paddingTop: '20px', pageBreakBefore: 'always' }}>
          <h2 style={{ fontFamily: 'system-ui, sans-serif', fontSize: '13pt', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', borderLeft: '4px solid #4f46e5', paddingLeft: '12px', marginBottom: '16px', pageBreakInside: 'avoid', breakInside: 'avoid' }}>
            Matriz de Evaluación Final
          </h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10pt', marginBottom: '16px', pageBreakInside: 'avoid', breakInside: 'avoid' }}>
            <thead>
              <tr style={{ background: '#f3f4f6' }}>
                {['Criterio', 'Peso', 'Puntaje', 'Nivel', 'Observación'].map((h) => (
                  <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontFamily: 'system-ui, sans-serif', fontWeight: '700', border: '1px solid #d1d5db', fontSize: '9pt' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(evalMatrix.criteria || []).map((c, i) => {
                const cLvl = c.level || (c.score >= 9 ? 'Excelente' : c.score >= 7 ? 'Bueno' : c.score >= 5 ? 'Regular' : 'Deficiente');
                return (
                  <tr key={i} style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                    <td style={{ padding: '7px 10px', border: '1px solid #e5e7eb', fontWeight: '600', fontFamily: 'system-ui, sans-serif' }}>{c.criterion}</td>
                    <td style={{ padding: '7px 10px', border: '1px solid #e5e7eb', fontFamily: 'system-ui, sans-serif' }}>{c.weight}</td>
                    <td style={{ padding: '7px 10px', border: '1px solid #e5e7eb', fontFamily: 'system-ui, sans-serif', fontWeight: '700', color: LEVEL_COLOR[cLvl] || '#4f46e5' }}>{c.score}/{c.max_score}</td>
                    <td style={{ padding: '7px 10px', border: '1px solid #e5e7eb', fontFamily: 'system-ui, sans-serif' }}>{cLvl}</td>
                    <td style={{ padding: '7px 10px', border: '1px solid #e5e7eb', fontSize: '9pt', color: '#475569', fontFamily: 'system-ui, sans-serif' }}>{(c.key_examples || []).join('; ') || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {evalMatrix.general_summary && (
            <div style={{ padding: '12px 14px', background: '#f8fafc', border: '1px solid #e2e8f0', fontFamily: 'system-ui, sans-serif', fontSize: '11pt' }}>
              <strong>Valoración global: </strong>{evalMatrix.general_summary}
            </div>
          )}
          <div style={{ marginTop: '24px', textAlign: 'right', fontFamily: 'system-ui, sans-serif', fontSize: '9pt', color: '#94a3b8' }}>
            EvaluAI — Auditoría Técnica Académica · temperature=0.0
          </div>
        </div>
      )}
    </div>
  );
});

// ── Hybrid Print Container (anexo de observaciones) ───────────────────────────
// Este contenedor YA NO intenta representar el documento original.
// Solo renderiza el anexo de observaciones que se añadirá al final del PDF real.

export const HybridPrintContainer = React.forwardRef(function HybridPrintContainer(
  { doc, rubric, allFootnotes = [], footnoteTexts = {} },
  ref,
) {
  if (!doc) return null;

  const footnotes = (allFootnotes || []).map(normalizeFootnoteRecord);
  const textual = footnotes.filter((fn) => fn.anchor_type !== 'capture');
  const captures = footnotes.filter((fn) => fn.anchor_type === 'capture');
  const total = footnotes.length;

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute',
        left: '-9999px',
        top: 0,
        width: EVALUATION_SHEET_LAYOUT.pageWidth,
        maxWidth: EVALUATION_SHEET_LAYOUT.pageWidth,
        minHeight: EVALUATION_SHEET_LAYOUT.pageMinHeight,
        padding: EVALUATION_SHEET_LAYOUT.contentPadding,
        margin: '0 auto',
        boxSizing: 'border-box',
        fontFamily: 'Georgia, "Times New Roman", serif',
        color: '#1a1a1a',
        fontSize: '11pt',
        lineHeight: 1.7,
        background: '#fff',
      }}
    >
      {/* Encabezado sobrio */}
      <div style={{ textAlign: 'center', borderBottom: '2px solid #1a1a1a', paddingBottom: '14px', marginBottom: '22px', pageBreakInside: 'avoid', breakInside: 'avoid' }}>
        <h1 style={{ fontFamily: 'system-ui, sans-serif', fontSize: '20pt', fontWeight: '800', margin: '0 0 6px 0' }}>
          {doc.filename}
        </h1>
        <p style={{ fontFamily: 'system-ui, sans-serif', fontSize: '11pt', color: '#475569', margin: 0, fontWeight: '600' }}>
          Anexo de observaciones
        </p>
        {rubric && (
          <p style={{ fontFamily: 'system-ui, sans-serif', fontSize: '10pt', color: '#64748b', margin: '6px 0 0 0' }}>
            Rúbrica: <strong>{rubric.nombre || rubric.title}</strong>
          </p>
        )}
        <p style={{ fontFamily: 'system-ui, sans-serif', fontSize: '9pt', color: '#94a3b8', margin: '6px 0 0 0' }}>
          {total} observación{total === 1 ? '' : 'es'} · Generado por EvaluAI · {new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Bloque único — observaciones con referencia numerada */}
      <div style={{ borderTop: '2px solid #1a1a1a', paddingTop: '18px', pageBreakBefore: 'auto' }}>
        <h2 style={{ fontFamily: 'system-ui, sans-serif', fontSize: '13pt', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', borderLeft: '4px solid #4f46e5', paddingLeft: '12px', marginBottom: '6px', pageBreakInside: 'avoid', breakInside: 'avoid' }}>
          Observaciones ({total})
        </h2>
        <p style={{ fontFamily: 'system-ui, sans-serif', fontSize: '9pt', color: '#64748b', fontStyle: 'italic', margin: '0 0 14px 0' }}>
          Cada observación indica su origen de forma honesta: párrafo cuando existe anclaje textual, o captura manuscrita con la página cuando se conoce.
        </p>

        {total === 0 && (
          <div style={{ padding: '12px 14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', fontFamily: 'system-ui, sans-serif', fontSize: '10pt', color: '#64748b' }}>
            Aún no hay observaciones registradas sobre este documento.
          </div>
        )}

        {textual.map((fn) => {
          const cfg = getFootnoteVisualConfig(fn);
          const origin = buildOriginReferenceText(fn);
          const content = footnoteTexts[fn.number] || fn.note_text || fn.comment;
          return (
            <div
              key={`hyb-txt-${fn.number}`}
              style={{ marginBottom: '12px', padding: '10px 14px', borderLeft: `3px solid ${cfg.color}`, background: '#fafafa', pageBreakInside: 'avoid', breakInside: 'avoid' }}
              data-pdf-avoid-break="true"
            >
              <div style={{ fontFamily: 'system-ui, sans-serif', fontSize: '10pt', fontWeight: '700', color: cfg.color, marginBottom: '4px' }}>
                [{fn.number}] {origin}
              </div>
              <div style={{ fontFamily: 'system-ui, sans-serif', fontSize: '9pt', color: '#475569', marginBottom: '6px' }}>
                <strong>{cfg.label}</strong>
                {cfg.severity ? ` · Severidad ${cfg.severity}` : ''}
              </div>
              {fn.snippet && (
                <div style={{ fontFamily: 'system-ui, sans-serif', fontSize: '9pt', color: '#475569', marginBottom: '6px', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                  Anclaje: “{fn.snippet}”
                </div>
              )}
              <div style={{ fontSize: '11pt', overflowWrap: 'anywhere', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                {content}
              </div>
            </div>
          );
        })}

        {captures.map((fn) => {
          const cfg = getFootnoteVisualConfig(fn);
          const origin = buildOriginReferenceText(fn);
          const asset = fn.capture_asset || {};
          const transcription = fn.transcription || {};
          const confidenceLabel = formatConfidenceLabel(transcription.confidence);
          const confidenceVisual = getConfidenceVisual(transcription.confidence);
          const transcribedText = String(
            transcription.text || (transcription.paragraphs || []).join('\n') || ''
          ).trim();
          const detectedFragment = getCaptureDetectedFragment(transcribedText);
          const content = footnoteTexts[fn.number] || fn.note_text || fn.comment;

          return (
            <div
              key={`hyb-cap-${fn.number}`}
              style={{ marginBottom: '12px', padding: '10px 14px', borderLeft: `3px solid ${cfg.color}`, background: '#fafafa', pageBreakInside: 'avoid', breakInside: 'avoid' }}
              data-pdf-avoid-break="true"
            >
              <div style={{ fontFamily: 'system-ui, sans-serif', fontSize: '10pt', fontWeight: '700', color: cfg.color, marginBottom: '6px' }}>
                [{fn.number}] {origin}
              </div>
              <div style={{ fontFamily: 'system-ui, sans-serif', fontSize: '9pt', color: '#475569', marginBottom: '8px', lineHeight: 1.45 }}>
                <div><strong>Origen:</strong> Captura manuscrita</div>
                <div><strong>Página:</strong> {getCapturePageReference(fn.page_hint)}</div>
                <div style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                  <strong>Fragmento detectado:</strong> {detectedFragment ? `“${detectedFragment}”` : 'no disponible'}
                </div>
              </div>
              <div style={{ fontFamily: 'system-ui, sans-serif', fontSize: '9pt', color: '#475569', marginBottom: '8px' }}>
                <strong>{cfg.label}</strong>
                {cfg.severity ? ` · Severidad ${cfg.severity}` : ''}
              </div>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', marginBottom: '8px' }}>
                {asset.thumbnail_data_url ? (
                  <img
                    src={asset.thumbnail_data_url}
                    alt={`Evidencia captura ${fn.number}`}
                    style={{ width: '90px', height: 'auto', maxHeight: '110px', objectFit: 'contain', border: '1px solid #d1d5db', borderRadius: '4px', background: '#fff' }}
                  />
                ) : (
                  <div style={{ width: '90px', minHeight: '60px', border: '1px dashed #cbd5e1', borderRadius: '4px', background: '#fff', color: '#94a3b8', fontFamily: 'system-ui, sans-serif', fontSize: '8pt', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '4px' }}>
                    Sin miniatura
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'inline-block', fontFamily: 'system-ui, sans-serif', fontSize: '8pt', fontWeight: '700', padding: '2px 8px', borderRadius: '10px', color: confidenceVisual.color, background: confidenceVisual.bg, border: `1px solid ${confidenceVisual.border}`, marginBottom: '6px' }}>
                    Confianza {confidenceLabel}
                  </div>
                  {transcribedText ? (
                    <div style={{ fontFamily: 'system-ui, sans-serif', fontSize: '9pt', color: '#334155', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                      <strong>Transcripción aproximada (completa):</strong>
                      <div>{transcribedText}</div>
                    </div>
                  ) : (
                    <div style={{ fontFamily: 'system-ui, sans-serif', fontSize: '9pt', color: '#94a3b8', fontStyle: 'italic' }}>
                      Sin transcripción legible.
                    </div>
                  )}
                </div>
              </div>
              <div style={{ fontSize: '11pt', overflowWrap: 'anywhere', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                {content}
              </div>
            </div>
          );
        })}

        <div style={{ marginTop: '20px', textAlign: 'right', fontFamily: 'system-ui, sans-serif', fontSize: '9pt', color: '#94a3b8' }}>
          EvaluAI — Anexo de observaciones
        </div>
      </div>
    </div>
  );
});

// ── MetricBadge ────────────────────────────────────────────────────────────────

function MetricBadge({ label, value, color }) {
  return (
    <div style={{ textAlign: 'center', padding: '8px 14px', background: '#f8fafc', borderRadius: '8px', border: `2px solid ${color}20` }}>
      <div style={{ fontSize: '20px', fontWeight: '800', color }}>{value}</div>
      <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>{label}</div>
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────────

const s = {
  wrapper:      { display: 'flex', flexDirection: 'column', height: '100%', background: '#0f172a' },
  toolbar:      { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', background: '#111827', borderBottom: '1px solid rgba(255,255,255,0.08)', flexWrap: 'wrap', gap: '12px' },
  toolbarLeft:  { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' },
  toolbarRight: { display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', justifyContent: 'flex-end' },

  btnSecondary: { padding: '8px 14px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', color: '#e2e8f0', cursor: 'pointer', fontSize: '13px', fontWeight: '500' },
  btnEvaluar:   { padding: '9px 18px', background: '#334155', border: 'none', borderRadius: '8px', color: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: '700', boxShadow: '0 2px 8px rgba(2,6,23,0.18)' },
  btnDownload:  { padding: '8px 14px', background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '8px', color: '#86efac', cursor: 'pointer', fontSize: '13px', fontWeight: '500' },
  btnDownloadHybrid: { padding: '8px 14px', background: 'rgba(79,70,229,0.12)', border: '1px solid rgba(79,70,229,0.35)', borderRadius: '8px', color: '#a5b4fc', cursor: 'pointer', fontSize: '13px', fontWeight: '500' },
  btnDownloadSecondary: { padding: '8px 14px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', color: '#e2e8f0', cursor: 'pointer', fontSize: '13px', fontWeight: '500' },
  btnPrimary:   { padding: '12px 28px', background: '#334155', border: 'none', borderRadius: '10px', color: '#fff', cursor: 'pointer', fontSize: '15px', fontWeight: '700', marginTop: '8px' },

  documentArea: { flex: 1, overflowY: 'auto', background: '#e8edf3', padding: '20px clamp(8px, 2vw, 18px)', position: 'relative', scrollBehavior: 'smooth' },
  loadingOverlay: { position: 'absolute', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,23,42,0.45)' },
  loadingCard:    { background: '#fff', padding: '36px', borderRadius: '16px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column', alignItems: 'center' },
  spinner:        { width: '48px', height: '48px', borderRadius: '50%', border: '4px solid #e2e8f0', borderTop: '4px solid #4f46e5' },

  reportSheet:   { background: '#f8fafc', borderRadius: '16px', boxShadow: '0 10px 32px rgba(15,23,42,0.10)', width: '100%', margin: '0 auto', boxSizing: 'border-box', fontFamily: 'Georgia, "Times New Roman", serif', color: '#1e293b', overflow: 'visible' },
  cover:         { textAlign: 'center', borderBottom: '2px solid #e2e8f0', paddingBottom: '28px', marginBottom: '36px' },
  docTitle:      { fontSize: '24px', fontWeight: '700', color: '#0f172a', margin: '0 0 8px 0', fontFamily: 'system-ui, sans-serif' },
  docSubtitle:   { fontSize: '14px', color: '#475569', margin: '0 0 16px 0', fontFamily: 'system-ui, sans-serif' },
  metricsRow:    { display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap', marginTop: '16px' },

  section:       { marginBottom: '40px' },
  sectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '20px' },
  sectionTitle:  { fontFamily: 'system-ui, sans-serif', fontSize: '16px', fontWeight: '700', color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.06em', borderLeft: '4px solid #4f46e5', paddingLeft: '12px', marginBottom: '20px' },
  viewModeSwitch: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
  viewModeButton: { padding: '6px 12px', background: 'rgba(255,255,255,0.82)', border: '1px solid rgba(79,70,229,0.18)', borderRadius: '999px', color: '#475569', cursor: 'pointer', fontSize: '12px', fontWeight: '600' },
  viewModeButtonActive: { background: 'rgba(79,70,229,0.12)', border: '1px solid rgba(79,70,229,0.35)', color: '#4338ca' },

  docBody:       { width: '100%', minWidth: 0 },
  paragraph:     { marginBottom: '16px', lineHeight: 1.8, fontSize: '15px', color: '#334155', textAlign: 'justify', overflowWrap: 'anywhere', wordBreak: 'break-word' },
  superscript:   { color: '#4f46e5', fontWeight: '700', fontSize: '11px', verticalAlign: 'super', marginLeft: '2px', fontFamily: 'system-ui, sans-serif', cursor: 'help' },

  footnotesSection: { marginTop: '40px', width: '100%', minWidth: 0 },
  footnotesDivider: { borderTop: '2px solid #e2e8f0', marginBottom: '32px' },

  footnoteCard:   { borderRadius: '10px', padding: '14px', fontFamily: 'system-ui, sans-serif' },
  footnoteHeader: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', flexWrap: 'wrap' },
  footnoteNum:    { color: '#fff', fontWeight: '700', fontSize: '12px', padding: '2px 8px', borderRadius: '4px', fontFamily: 'monospace' },
  footnoteType:   { fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' },
  acceptedBadge:  { marginLeft: 'auto', background: 'rgba(34,197,94,0.2)', color: '#16a34a', fontSize: '12px', fontWeight: '600', padding: '2px 10px', borderRadius: '12px', border: '1px solid rgba(34,197,94,0.3)' },

  footnoteAnchorPreview: { marginBottom: '10px', padding: '8px 10px', background: 'rgba(79,70,229,0.06)', border: '1px solid rgba(79,70,229,0.18)', borderRadius: '6px', fontSize: '12px', color: '#475569', lineHeight: 1.5, fontFamily: 'system-ui, sans-serif', overflowWrap: 'anywhere', wordBreak: 'break-word' },
  footnoteReadonly: { padding: '10px 12px', background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '6px', fontSize: '14px', color: '#1e293b', lineHeight: 1.6, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', wordBreak: 'break-word' },
  footnoteTextarea: { width: '100%', padding: '10px 12px', background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(0,0,0,0.15)', borderRadius: '6px', fontSize: '14px', color: '#1e293b', resize: 'vertical', fontFamily: 'system-ui, sans-serif', lineHeight: 1.5, boxSizing: 'border-box', overflowWrap: 'anywhere', wordBreak: 'break-word' },

  footnoteActions: { display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' },
  btnModify:         { padding: '6px 14px', background: 'rgba(79,70,229,0.1)', border: '1px solid rgba(79,70,229,0.3)', borderRadius: '6px', color: '#6366f1', fontSize: '12px', fontWeight: '600', cursor: 'pointer' },
  btnChatComplement: { padding: '6px 14px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '6px', color: '#f59e0b', fontSize: '12px', fontWeight: '600', cursor: 'pointer' },
  btnAccept:         { padding: '6px 14px', background: 'linear-gradient(135deg, #22c55e, #16a34a)', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '12px', fontWeight: '600', cursor: 'pointer' },
  btnReject:         { padding: '6px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', color: '#f87171', fontSize: '12px', fontWeight: '600', cursor: 'pointer' },

  complementTextarea: { width: '100%', padding: '8px 10px', background: '#fff', border: '1px solid rgba(79,70,229,0.3)', borderRadius: '6px', fontSize: '13px', color: '#1e293b', resize: 'vertical', fontFamily: 'system-ui, sans-serif', lineHeight: 1.5, marginBottom: '6px', boxSizing: 'border-box', overflowWrap: 'anywhere', wordBreak: 'break-word' },
  btnApplyComplement: { padding: '6px 12px', background: '#4f46e5', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '12px', fontWeight: '600', cursor: 'pointer' },

  emptyState: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a', padding: '40px' },
  emptyCard:  { background: '#1e293b', border: '2px dashed rgba(255,255,255,0.15)', borderRadius: '20px', padding: '56px', maxWidth: '440px', textAlign: 'center' },
  emptyIcon:  { fontSize: '56px', marginBottom: '20px' },
  emptyTitle: { color: '#f8fafc', fontSize: '22px', fontWeight: '700', margin: '0 0 12px 0' },
  emptyText:  { color: '#94a3b8', fontSize: '14px', lineHeight: 1.6, margin: '0 0 24px 0' },
};
