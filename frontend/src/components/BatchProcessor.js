import React, { useMemo, useRef, useState } from 'react';
import JSZip from 'jszip';

import { PrintContainer } from './editor/CentralEvaluator.js';
import { getEvaluationPdfBlob, saveEvaluationPdf } from '../utils/evaluationPdf.js';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000';
const MAX_FILES = 10;
const ALLOWED_EXTENSIONS = new Set(['pdf', 'docx', 'txt']);

const getRubricMarkdown = (rubric) => rubric?.markdown || rubric?.contenido || '';
const getFileKey = (file) => `${file.name}__${file.size}__${file.lastModified}`;
const getFileExtension = (filename) => String(filename || '').split('.').pop()?.toLowerCase() || '';

const createPendingResult = (file) => ({
  fileKey: getFileKey(file),
  filename: file.name,
  success: null,
  status: 'Pendiente',
  score: null,
  error: '',
  documentId: null,
  documentData: null,
  evaluationData: null,
  footnoteTexts: {},
});

const createFootnoteTexts = (footnotes = []) => Object.fromEntries(
  footnotes.map((footnote) => [footnote.number, footnote.note_text || footnote.comment || ''])
);

const getPdfFilename = (filename) => {
  const baseName = String(filename || 'documento').replace(/\.[^.]+$/, '');
  return `evaluacion-${baseName}.pdf`;
};

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
};

export default function BatchProcessor({ rubricaActiva, methodologyConfig, onClose }) {
  const [files, setFiles] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState([]);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef(null);
  const printRefs = useRef({});

  const updateResult = (fileKey, patch) => {
    setResults((prev) => prev.map((result) => (
      result.fileKey === fileKey ? { ...result, ...patch } : result
    )));
  };

  const mergeIncomingFiles = (incomingFiles) => {
    const normalizedIncoming = Array.from(incomingFiles || []);

    if (normalizedIncoming.length === 0) {
      return;
    }

    const existingKeys = new Set(files.map(getFileKey));
    const nextFiles = [...files];
    const newResults = [];
    let invalidCount = 0;
    let duplicateCount = 0;
    let overflowCount = 0;

    normalizedIncoming.forEach((file) => {
      const fileKey = getFileKey(file);
      const extension = getFileExtension(file.name);

      if (!ALLOWED_EXTENSIONS.has(extension)) {
        invalidCount += 1;
        return;
      }

      if (existingKeys.has(fileKey)) {
        duplicateCount += 1;
        return;
      }

      if (nextFiles.length >= MAX_FILES) {
        overflowCount += 1;
        return;
      }

      existingKeys.add(fileKey);
      nextFiles.push(file);
      newResults.push(createPendingResult(file));
    });

    if (newResults.length > 0) {
      setFiles(nextFiles);
      setResults((prev) => [...prev, ...newResults]);
      setProgress(0);
      setProgressLabel('');
    }

    const validationMessages = [];
    if (invalidCount > 0) validationMessages.push(`${invalidCount} archivo(s) ignorado(s) por formato no permitido.`);
    if (duplicateCount > 0) validationMessages.push(`${duplicateCount} archivo(s) duplicado(s) ignorado(s).`);
    if (overflowCount > 0) validationMessages.push(`Se alcanzó el máximo de ${MAX_FILES} archivos.`);

    if (validationMessages.length > 0) {
      alert(validationMessages.join(' '));
    }
  };

  const handleFilesSelected = (e) => {
    mergeIncomingFiles(e.target.files);
    e.target.value = '';
  };

  const removeFile = (fileToRemove) => {
    const fileKey = getFileKey(fileToRemove);
    setFiles((prev) => prev.filter((file) => getFileKey(file) !== fileKey));
    setResults((prev) => prev.filter((result) => result.fileKey !== fileKey));
    delete printRefs.current[fileKey];
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragActive) {
      setIsDragActive(true);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget)) {
      return;
    }
    setIsDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    mergeIncomingFiles(e.dataTransfer?.files);
  };

  const processSingleFile = async (file, token, rubricMarkdown) => {
    const formData = new FormData();
    formData.append('file', file);

    const uploadResponse = await fetch(`${API_BASE}/api/documents/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    if (!uploadResponse.ok) {
      const errorPayload = await uploadResponse.json().catch(() => ({}));
      throw new Error(errorPayload.detail || 'Error al subir el archivo.');
    }

    const uploadedDocument = await uploadResponse.json();
    const evaluateResponse = await fetch(`${API_BASE}/api/evaluate/footnotes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        document_id: uploadedDocument.document_id,
        paragraphs: uploadedDocument.paragraphs,
        rubric_markdown: rubricMarkdown,
        evaluation_methodology: methodologyConfig?.metodologiaEvaluacion,
        custom_instruction: methodologyConfig?.instruccionIA,
        document_context: uploadedDocument.multimodal || null,
      }),
    });

    if (!evaluateResponse.ok) {
      const errorPayload = await evaluateResponse.json().catch(() => ({}));
      throw new Error(errorPayload.detail || 'Error al evaluar el archivo.');
    }

    const evaluationData = await evaluateResponse.json();

    return {
      documentId: uploadedDocument.document_id,
      documentData: {
        id: uploadedDocument.document_id,
        filename: file.name,
        paragraphs: uploadedDocument.paragraphs,
        multimodal: uploadedDocument.multimodal || null,
        documentRouter: uploadedDocument.document_router || uploadedDocument.multimodal?.document_router || null,
      },
      evaluationData,
      score: evaluationData?.evaluation_matrix?.total_score ?? null,
      footnoteTexts: createFootnoteTexts(evaluationData?.footnotes),
    };
  };

  const uploadAndProcess = async () => {
    if (!rubricaActiva) {
      alert('Selecciona una rúbrica activa antes de iniciar el procesamiento por lotes.');
      return;
    }

    if (files.length === 0) {
      alert('Agrega al menos un documento.');
      return;
    }

    const token = localStorage.getItem('token') || '';
    const rubricMarkdown = getRubricMarkdown(rubricaActiva);

    setProcessing(true);
    setProgress(0);
    setProgressLabel(`Procesando 0/${files.length}`);
    setResults(files.map(createPendingResult));

    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      const currentStep = index + 1;
      const fileKey = getFileKey(file);

      updateResult(fileKey, { status: 'Subiendo...', error: '' });
      setProgressLabel(`Procesando ${currentStep}/${files.length}: ${file.name}`);

      try {
        const processed = await processSingleFile(file, token, rubricMarkdown);
        updateResult(fileKey, {
          success: true,
          status: 'Completado',
          score: processed.score,
          error: '',
          documentId: processed.documentId,
          documentData: processed.documentData,
          evaluationData: processed.evaluationData,
          footnoteTexts: processed.footnoteTexts,
        });
      } catch (error) {
        updateResult(fileKey, {
          success: false,
          status: 'Error',
          score: null,
          error: error.message || 'Fallo inesperado en el procesamiento.',
        });
      } finally {
        setProgress(Math.round((currentStep / files.length) * 100));
      }
    }

    setProgressLabel(`Procesamiento completado: ${files.length}/${files.length}`);
    setProcessing(false);
  };

  const downloadSinglePdf = async (result) => {
    const sourceNode = printRefs.current[result.fileKey];
    if (!sourceNode) {
      alert('El PDF aún no está listo para este archivo.');
      return;
    }

    try {
      await saveEvaluationPdf({
        sourceNode,
        filename: getPdfFilename(result.filename),
      });
    } catch (error) {
      alert(`No se pudo generar el PDF de ${result.filename}: ${error.message}`);
    }
  };

  const downloadZip = async () => {
    const successfulResults = results.filter((result) => result.success && result.evaluationData && result.documentData);

    if (successfulResults.length === 0) {
      alert('No hay PDFs generables para descargar.');
      return;
    }

    setProcessing(true);
    setProgress(0);
    setProgressLabel(`Generando PDF 0/${successfulResults.length}`);

    try {
      const zip = new JSZip();
      const exportErrors = [];

      for (let index = 0; index < successfulResults.length; index += 1) {
        const result = successfulResults[index];
        const currentStep = index + 1;
        const sourceNode = printRefs.current[result.fileKey];

        setProgressLabel(`Generando PDF ${currentStep}/${successfulResults.length}: ${result.filename}`);

        try {
          if (!sourceNode) {
            throw new Error('Vista de impresión no disponible.');
          }

          const pdfBlob = await getEvaluationPdfBlob({
            sourceNode,
            filename: getPdfFilename(result.filename),
          });

          zip.file(getPdfFilename(result.filename), pdfBlob);
        } catch (error) {
          exportErrors.push(`${result.filename}: ${error.message}`);
        } finally {
          setProgress(Math.round((currentStep / successfulResults.length) * 100));
        }
      }

      if (exportErrors.length > 0) {
        zip.file('errores_exportacion.txt', exportErrors.join('\n'));
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      downloadBlob(zipBlob, `evaluaciones_lote_${new Date().toISOString().split('T')[0]}.zip`);
      setProgressLabel(`ZIP generado: ${successfulResults.length} PDF(s)`);
    } catch (error) {
      alert('Error al generar ZIP: ' + error.message);
    } finally {
      setProcessing(false);
    }
  };

  const successCount = useMemo(() => results.filter((result) => result.success).length, [results]);
  const errorCount = useMemo(() => results.filter((result) => result.success === false).length, [results]);

  return (
    <div style={s.overlay}>
      <div style={s.modal}>
        <div style={s.header}>
          <div>
            <h2 style={s.title}>⚡ Evaluación Automática por Lotes</h2>
            <p style={s.subtitle}>
              Sube hasta {MAX_FILES} documentos y cada archivo usará exactamente el mismo pipeline premium del modo individual.
            </p>
          </div>
          <button onClick={onClose} style={s.btnClose}>✕</button>
        </div>

        <div style={s.rubricBar}>
          {rubricaActiva ? (
            <span style={s.rubricActive}>
              📋 Rúbrica: <strong>{rubricaActiva.nombre}</strong>
            </span>
          ) : (
            <span style={s.rubricWarning}>
              ⚠️ Selecciona una rúbrica en el panel izquierdo antes de continuar
            </span>
          )}
        </div>

        <div
          style={{
            ...s.dropzone,
            ...(isDragActive ? s.dropzoneActive : {}),
          }}
          onClick={() => fileInputRef.current?.click()}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <input
            type="file"
            ref={fileInputRef}
            multiple
            accept=".pdf,.docx,.txt"
            onChange={handleFilesSelected}
            style={{ display: 'none' }}
          />
          <span style={{ fontSize: '36px' }}>📂</span>
          <p style={{ color: '#94a3b8', margin: '8px 0 4px 0' }}>
            Haz clic o arrastra archivos aquí (PDF, DOCX, TXT)
          </p>
          <p style={{ color: '#64748b', fontSize: '12px', margin: 0 }}>
            Máximo {MAX_FILES} archivos por lote
          </p>
        </div>

        {files.length > 0 && (
          <div style={s.fileList}>
            {files.map((file, index) => {
              const fileKey = getFileKey(file);
              const result = results.find((item) => item.fileKey === fileKey) || createPendingResult(file);

              return (
                <div key={`${fileKey}-${index}`} style={s.fileItem}>
                  <div style={s.fileInfo}>
                    <span style={{ fontSize: '14px' }}>
                      {file.name.endsWith('.pdf') ? '📄' : file.name.endsWith('.docx') ? '📝' : '📃'}
                    </span>
                    <span style={s.fileName}>{file.name}</span>
                    <span style={s.fileMeta}>{(file.size / 1024).toFixed(0)} KB</span>
                  </div>

                  <div style={s.fileActions}>
                    <span
                      style={{
                        ...s.statusBadge,
                        color: result.success === false ? '#fecaca' : result.success ? '#bbf7d0' : '#cbd5f5',
                        borderColor: result.success === false ? 'rgba(239,68,68,0.35)' : result.success ? 'rgba(34,197,94,0.35)' : 'rgba(99,102,241,0.35)',
                        background: result.success === false ? 'rgba(239,68,68,0.12)' : result.success ? 'rgba(34,197,94,0.12)' : 'rgba(99,102,241,0.12)',
                      }}
                    >
                      {result.status}
                    </span>

                    <span style={s.scoreLabel}>
                      {result.success && typeof result.score === 'number' ? `${result.score}/100` : '—'}
                    </span>

                    <button
                      onClick={() => downloadSinglePdf(result)}
                      disabled={!result.success || processing}
                      style={{
                        ...s.btnPdf,
                        opacity: !result.success || processing ? 0.5 : 1,
                        cursor: !result.success || processing ? 'not-allowed' : 'pointer',
                      }}
                    >
                      PDF
                    </button>

                    <button
                      onClick={() => removeFile(file)}
                      disabled={processing}
                      style={{
                        ...s.btnRemove,
                        opacity: processing ? 0.5 : 1,
                        cursor: processing ? 'not-allowed' : 'pointer',
                      }}
                    >
                      Quitar
                    </button>
                  </div>

                  {result.error && (
                    <div style={s.errorText}>{result.error}</div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {processing && (
          <div style={s.progressWrapper}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', gap: '12px' }}>
              <span style={{ color: '#94a3b8', fontSize: '13px' }}>{progressLabel || 'Procesando documentos...'}</span>
              <span style={{ color: '#a5b4fc', fontSize: '13px', fontWeight: '600' }}>{progress}%</span>
            </div>
            <div style={s.progressBg}>
              <div style={{ ...s.progressFill, width: `${progress}%` }} />
            </div>
          </div>
        )}

        {results.length > 0 && (
          <div style={s.resultsSummary}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ color: '#22c55e', fontWeight: '700' }}>✓ {successCount} evaluados</span>
              <span style={{ color: '#ef4444', fontWeight: '700' }}>✗ {errorCount} fallidos</span>
            </div>
          </div>
        )}

        <div style={s.actions}>
          <button
            onClick={uploadAndProcess}
            disabled={processing || files.length === 0 || !rubricaActiva}
            style={{ ...s.btnStart, opacity: processing || files.length === 0 || !rubricaActiva ? 0.5 : 1 }}
          >
            {processing ? '⏳ Procesando...' : '🚀 Iniciar Evaluación por Lotes'}
          </button>

          {successCount > 0 && (
            <button
              onClick={downloadZip}
              disabled={processing}
              style={{ ...s.btnDownload, opacity: processing ? 0.5 : 1 }}
            >
              📦 Descargar ZIP con PDFs
            </button>
          )}
        </div>

        <div aria-hidden="true" style={s.hiddenPrintArea}>
          {results.filter((result) => result.success && result.evaluationData && result.documentData).map((result) => (
            <PrintContainer
              key={`print-${result.fileKey}-${result.documentId}`}
              ref={(node) => {
                if (node) {
                  printRefs.current[result.fileKey] = node;
                } else {
                  delete printRefs.current[result.fileKey];
                }
              }}
              doc={result.documentData}
              rubric={rubricaActiva}
              evaluationHtml={null}
              footnoteResult={result.evaluationData}
              allFootnotes={result.evaluationData?.footnotes || []}
              footnoteTexts={result.footnoteTexts}
              footnoteModes={{}}
              evalMatrix={result.evaluationData?.evaluation_matrix}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

const s = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(2,6,23,0.72)',
    zIndex: 1400,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
  },
  modal: {
    background: '#111827',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '16px',
    padding: '28px',
    width: '100%',
    maxWidth: '560px',
    maxHeight: '90vh',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '16px',
  },
  title: { color: '#f8fafc', fontSize: '20px', fontWeight: '700', margin: 0 },
  subtitle: { color: '#94a3b8', fontSize: '13px', margin: '6px 0 0 0' },
  btnClose: {
    background: 'rgba(255,255,255,0.06)',
    border: 'none',
    color: '#94a3b8',
    fontSize: '16px',
    cursor: 'pointer',
    borderRadius: '8px',
    padding: '6px 10px',
    flexShrink: 0,
  },
  rubricBar: {
    padding: '10px 14px',
    borderRadius: '8px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
  },
  rubricActive: { color: '#a5b4fc', fontSize: '13px' },
  rubricWarning: { color: '#f59e0b', fontSize: '13px' },
  dropzone: {
    border: '2px dashed rgba(255,255,255,0.15)',
    borderRadius: '12px',
    padding: '28px',
    textAlign: 'center',
    cursor: 'pointer',
    transition: 'border-color 0.2s',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  dropzoneActive: {
    borderColor: 'rgba(99,102,241,0.7)',
    background: 'rgba(99,102,241,0.08)',
  },
  fileList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    maxHeight: '200px',
    overflowY: 'auto',
  },
  fileItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    padding: '10px 12px',
    background: 'rgba(255,255,255,0.04)',
    borderRadius: '8px',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  fileInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    width: '100%',
  },
  fileName: {
    flex: 1,
    color: '#e2e8f0',
    fontSize: '13px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  fileMeta: {
    fontSize: '11px',
    color: '#64748b',
    flexShrink: 0,
  },
  fileActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    width: '100%',
    flexWrap: 'wrap',
  },
  statusBadge: {
    fontSize: '11px',
    fontWeight: '700',
    border: '1px solid transparent',
    borderRadius: '999px',
    padding: '4px 10px',
  },
  scoreLabel: {
    color: '#f8fafc',
    fontSize: '12px',
    fontWeight: '700',
    minWidth: '58px',
  },
  btnPdf: {
    marginLeft: 'auto',
    padding: '7px 10px',
    background: 'rgba(99,102,241,0.18)',
    border: '1px solid rgba(99,102,241,0.35)',
    borderRadius: '8px',
    color: '#c7d2fe',
    fontSize: '12px',
    fontWeight: '700',
  },
  btnRemove: {
    padding: '7px 10px',
    background: 'rgba(239,68,68,0.12)',
    border: '1px solid rgba(239,68,68,0.3)',
    borderRadius: '8px',
    color: '#fca5a5',
    fontSize: '12px',
    fontWeight: '700',
  },
  errorText: {
    width: '100%',
    color: '#fca5a5',
    fontSize: '12px',
    lineHeight: 1.5,
  },
  progressWrapper: {
    padding: '4px 0',
  },
  progressBg: {
    height: '6px',
    background: 'rgba(255,255,255,0.08)',
    borderRadius: '3px',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    background: '#475569',
    borderRadius: '3px',
    transition: 'width 0.3s ease',
  },
  resultsSummary: {
    padding: '12px 14px',
    background: 'rgba(34,197,94,0.08)',
    border: '1px solid rgba(34,197,94,0.2)',
    borderRadius: '8px',
  },
  actions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  btnStart: {
    padding: '13px',
    background: '#334155',
    border: 'none',
    borderRadius: '10px',
    color: '#fff',
    fontSize: '15px',
    fontWeight: '700',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(2,6,23,0.25)',
  },
  btnDownload: {
    padding: '12px',
    background: 'rgba(34,197,94,0.12)',
    border: '1px solid rgba(34,197,94,0.3)',
    borderRadius: '10px',
    color: '#86efac',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  hiddenPrintArea: {
    position: 'absolute',
    width: 0,
    height: 0,
    overflow: 'hidden',
    pointerEvents: 'none',
  },
};
