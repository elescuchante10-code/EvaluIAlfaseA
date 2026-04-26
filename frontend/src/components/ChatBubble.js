/**
 * ChatBubble — FAB global persistente de chat con el Agente IA.
 * Estado completamente independiente del panel central.
 * Soporta: adjuntar archivo, captura de texto seleccionado, añadir notas al pie.
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { agenteAPI } from '../services/api.js';
import { useTeacherContextPack } from '../hooks/useTeacherContextPack.js';
import {
  buildTeacherContextSummary,
  teacherContextPackToWire,
} from '../utils/teacherContextPack.js';

export default function ChatBubble({
  rubricaActiva = null,
  currentDocument = null,
  selectedText = null,
  onLoadDocument,
  onAddFootnote,
  onClearSelectedText,
  onOpenRubricEditor,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 1,
      type: 'agent',
      content: '¡Hola! Soy tu Agente IA. Puedo evaluar selecciones de texto, crear rúbricas o responder preguntas pedagógicas.',
      time: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectionCard, setSelectionCard] = useState(null); // { text, dismissed }
  const [unreadCount, setUnreadCount] = useState(0);
  const [pastedImage, setPastedImage] = useState(null);
  const [currentPageHint, setCurrentPageHint] = useState(null);

  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const teacherContextPack = useTeacherContextPack();

  // Scroll to bottom on new messages
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // Handle selectedText from parent (text selection in central panel)
  useEffect(() => {
    const payload = typeof selectedText === 'string' ? { text: selectedText } : selectedText;
    if (payload?.text && payload.text.length > 10) {
      setSelectionCard({ ...payload, dismissed: false });
      if (!isOpen) {
        setUnreadCount((n) => n + 1);
      }
    }
  }, [selectedText, isOpen]);

  // Focus input when opening
  useEffect(() => {
    if (isOpen) {
      setUnreadCount(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Recibe page_hint detectado en el visor PDF sin acoplar ChatBubble al App.
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const handlePageHint = (event) => {
      const pageHint = event?.detail?.pageHint;
      setCurrentPageHint(Number.isInteger(pageHint) ? pageHint : null);
    };

    window.addEventListener('evaluai:page-hint', handlePageHint);
    return () => window.removeEventListener('evaluai:page-hint', handlePageHint);
  }, []);

  const addAgentMessage = useCallback((content, extra = {}) => {
    setMessages((prev) => [
      ...prev,
      { id: Date.now() + Math.random(), type: 'agent', content, time: new Date(), ...extra },
    ]);
    if (!isOpen) setUnreadCount((n) => n + 1);
  }, [isOpen]);

  const extractFootnoteProposal = useCallback((content) => {
    const match = String(content || '').match(/NOTA AL PIE:\s*(.+)/i);
    return match ? match[1].trim() : null;
  }, []);

  const detectedDocumentType = currentDocument?.documentRouter?.type || currentDocument?.multimodal?.document_router?.type || null;
  const showRubricDetectedBanner = false;

  const sendMessage = async (overrideText = null, options = {}) => {
    const text = (overrideText ?? input).trim();
    const imagePayload = options.image ?? pastedImage;
    const capturePageHint = imagePayload && Number.isInteger(currentPageHint) ? currentPageHint : null;
    if (!text && !imagePayload) return;

    setMessages((prev) => [
      ...prev,
      {
        id: Date.now(),
        type: 'user',
        content: text,
        imagePreviewUrl: imagePayload?.dataUrl || null,
        time: new Date(),
      },
    ]);
    setInput('');
    setPastedImage(null);
    setIsLoading(true);

    try {
      const historial = messages
        .filter((m) => m.type === 'user' || m.type === 'agent')
        .slice(-8)
        .map((m) => ({ tipo: m.type === 'user' ? 'usuario' : 'agente', contenido: m.content }));

      const contexto = {
        superficie: 'chat_contextual',
        rubrica_activa: rubricaActiva?.nombre || null,
        rubrica_activa_markdown: rubricaActiva?.markdown || rubricaActiva?.contenido || null,
        asignatura_activa: rubricaActiva?.asignatura || null,
        documento_activo: currentDocument?.filename || null,
        document_id: currentDocument?.id ?? null,
        document_type: detectedDocumentType || null,
        ...(capturePageHint !== null ? { page_hint: capturePageHint } : {}),
        espacio_ib_asignatura_activa: teacherContextPack?.asignatura_activa || null,
        teacher_context_pack: teacherContextPackToWire(teacherContextPack),
        teacher_context_summary: buildTeacherContextSummary(teacherContextPack),
      };

      const resp = await agenteAPI.chat(
        text,
        contexto,
        historial,
        imagePayload
          ? {
            data_url: imagePayload.dataUrl,
            mime_type: imagePayload.mimeType,
            filename: imagePayload.name,
          }
          : null,
      );

      if (resp.success) {
        const proposedFootnote = extractFootnoteProposal(resp.respuesta);
        // Si la respuesta trae `chat_image_asset`, significa que el mensaje
        // venía de una captura pegada. Guardamos el asset en el mensaje para
        // poder construir un captureContext honesto cuando el profesor pulse
        // "Añadir nota al pie". NO se modifica el texto actual de la respuesta.
        addAgentMessage(resp.respuesta, {
          rubrica_lista: resp.rubrica_lista,
          markdown: resp.markdown_rubrica,
          hasFootnoteProposal: !!proposedFootnote,
          proposedFootnote,
          selectionContext: options.selectionContext || null,
          chatImageAsset: resp.chat_image_asset || null,
          capturePageHint,
        });
      } else {
        addAgentMessage(`Error: ${resp.detail || 'Respuesta inválida del servidor.'}`);
      }
    } catch (err) {
      addAgentMessage(`No pude conectar con el servidor: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePaste = (e) => {
    const items = Array.from(e.clipboardData?.items || []);
    const imageItem = items.find((item) => item.type === 'image/png' || item.type === 'image/jpeg');
    if (!imageItem) return;

    const file = imageItem.getAsFile();
    if (!file) return;

    e.preventDefault();
    const reader = new FileReader();
    reader.onload = () => {
      setPastedImage({
        dataUrl: String(reader.result || ''),
        mimeType: file.type || 'image/png',
        name: file.name || `clipboard-${Date.now()}.png`,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleConvertRubricDocument = async () => {
    if (!currentDocument?.paragraphs?.length) return;
    const rubricSource = currentDocument.paragraphs.join('\n\n').slice(0, 12000);
    const prompt = [
      'Convierte el siguiente documento detectado como rúbrica en una rúbrica editable en Markdown.',
      'Conserva criterios, niveles y ponderaciones cuando existan.',
      'Normaliza encabezados o tablas solo si hace falta para dejarla lista para edición.',
      'Devuelve SOLO la rúbrica completa en Markdown e incluye <!--RUBRICA_LISTA_PARA_GUARDAR--> al final.',
      '',
      `DOCUMENTO FUENTE: ${currentDocument.filename}`,
      rubricSource,
    ].join('\n');

    await sendMessage(prompt);
  };

  const handleEvaluateSelection = async () => {
    if (!selectionCard) return;
    const selectionPayload = selectionCard;
    const selectedSnippet = selectionPayload.text;
    setSelectionCard(null);
    onClearSelectedText?.();

    const rubricContext = rubricaActiva
      ? `Rúbrica activa: "${rubricaActiva.nombre}"\n\n${rubricaActiva.markdown || ''}`
      : 'No hay rúbrica activa.';

    const prompt = (
      `Actúa como auditor académico exigente. Evalúa el siguiente fragmento de texto contra la rúbrica.\n\n` +
      `FRAGMENTO SELECCIONADO:\n"${selectedSnippet}"\n\n${rubricContext}\n\n` +
      `Cita el fragmento exacto, identifica el criterio violado y proporciona retroalimentación técnica específica. ` +
      `Termina con una nota al pie propuesta (prefija con "NOTA AL PIE: ").`
    );

    setMessages((prev) => [
      ...prev,
      { id: Date.now(), type: 'selection', content: selectedSnippet, time: new Date() },
    ]);

    setIsLoading(true);
    try {
      const ctxDocente = {
        superficie: 'chat_contextual',
        espacio_ib_asignatura_activa: teacherContextPack?.asignatura_activa || null,
        teacher_context_pack: teacherContextPackToWire(teacherContextPack),
        teacher_context_summary: buildTeacherContextSummary(teacherContextPack),
      };
      const resp = await agenteAPI.chat(prompt, ctxDocente, []);
      if (resp.success) {
        const content = resp.respuesta;
        // Extract proposed footnote if present
        let footnoteText = null;
        const fnMatch = content.match(/NOTA AL PIE:\s*(.+)/i);
        if (fnMatch) footnoteText = fnMatch[1].trim();

        addAgentMessage(content, {
          hasFootnoteProposal: !!footnoteText,
          proposedFootnote: footnoteText,
          selectionContext: selectionPayload,
        });
      }
    } catch (err) {
      addAgentMessage(`Error al evaluar selección: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileAttach = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    addAgentMessage(
      `He recibido el archivo **${file.name}**. Cargándolo en el panel de evaluación...`,
    );

    if (onLoadDocument) {
      try {
        await onLoadDocument(file);
        addAgentMessage(
          `✅ **${file.name}** cargado correctamente en el panel central. ` +
          `${rubricaActiva ? `Puedes evaluarlo con la rúbrica "${rubricaActiva.nombre}".` : 'Selecciona una rúbrica para evaluarlo.'}`,
        );
      } catch (err) {
        addAgentMessage(`❌ Error al cargar el archivo: ${err.message}`);
      }
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleTextareaResize = (e) => {
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  };

  const formatContent = (text) =>
    text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br/>');

  const panelWidth = isExpanded ? 'min(620px, calc(100vw - 56px))' : 'min(440px, calc(100vw - 56px))';
  const panelHeight = isExpanded ? 'min(780px, calc(100vh - 120px))' : 'min(640px, calc(100vh - 120px))';

  return (
    <div className="chat-fab" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Expanded Chat Panel */}
      {isOpen && (
        <div
          className="chat-panel"
          style={{
            position: 'absolute',
            bottom: '76px',
            right: 0,
            width: panelWidth,
            height: panelHeight,
            background: 'linear-gradient(180deg, #0f172a 0%, #111827 100%)',
            border: '1px solid rgba(148,163,184,0.18)',
            borderRadius: '18px',
            boxShadow: '0 32px 72px rgba(2,6,23,0.55), 0 2px 0 rgba(148,163,184,0.04) inset',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            transition: 'width 0.22s ease, height 0.22s ease',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '10px 16px',
              background: 'linear-gradient(180deg, #1f2937 0%, #1a2231 100%)',
              borderBottom: '1px solid rgba(148,163,184,0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              position: 'relative',
            }}
          >
            {/* Accent bar táctica (Evaluar) */}
            <div
              aria-hidden
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: '3px',
                background: 'linear-gradient(180deg, #f59e0b 0%, #b45309 100%)',
              }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '9px',
                  background: 'linear-gradient(135deg, rgba(245,158,11,0.22), rgba(99,102,241,0.18))',
                  border: '1px solid rgba(148,163,184,0.18)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '16px',
                  flexShrink: 0,
                }}
              >
                🤖
              </div>
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: '14px',
                    letterSpacing: '0.01em',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  Chat contextual
                  <span
                    style={{
                      fontSize: '11px',
                      padding: '3px 8px',
                      borderRadius: '999px',
                      background: 'rgba(245,158,11,0.15)',
                      color: '#fbbf24',
                      border: '1px solid rgba(245,158,11,0.3)',
                      fontWeight: 700,
                      letterSpacing: '0.05em',
                      textTransform: 'uppercase',
                    }}
                  >
                    Evaluar
                  </span>
                </div>
                <div
                  style={{
                    color: 'rgba(203,213,225,0.82)',
                    fontSize: '12px',
                    marginTop: '2px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: isExpanded ? '460px' : '260px',
                  }}
                >
                  {rubricaActiva ? `Rúbrica: ${rubricaActiva.nombre}` : 'Sin rúbrica activa'}
                  {currentDocument?.filename ? ` · ${currentDocument.filename}` : ''}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
              <button
                onClick={() => setIsExpanded((v) => !v)}
                title={isExpanded ? 'Reducir panel' : 'Ampliar panel'}
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: '#e2e8f0',
                  borderRadius: '8px',
                  width: '30px',
                  height: '30px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background 0.15s ease',
                }}
              >
                {isExpanded ? '⤡' : '⤢'}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                title="Minimizar chat"
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: '#e2e8f0',
                  borderRadius: '8px',
                  width: '30px',
                  height: '30px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background 0.15s ease',
                }}
              >
                ✕
              </button>
            </div>
          </div>

          {/* Selection card (appears when text is selected) */}
          {selectionCard && !selectionCard.dismissed && (
            <div
              style={{
                margin: '10px 14px 0',
                padding: '12px 14px',
                background: 'linear-gradient(180deg, rgba(245,158,11,0.14) 0%, rgba(245,158,11,0.08) 100%)',
                border: '1px solid rgba(245,158,11,0.4)',
                borderRadius: '12px',
                fontSize: '13px',
                boxShadow: '0 2px 0 rgba(245,158,11,0.08) inset',
              }}
            >
              <div
                style={{
                  color: '#fbbf24',
                  fontWeight: 700,
                  marginBottom: '8px',
                  fontSize: '13px',
                  letterSpacing: '0.02em',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                📌 Fragmento seleccionado del documento
              </div>
              <div
                style={{
                  color: '#e2e8f0',
                  fontSize: '13px',
                  marginBottom: '12px',
                  fontStyle: 'italic',
                  lineHeight: 1.55,
                  maxHeight: '80px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  borderLeft: '2px solid rgba(245,158,11,0.35)',
                  paddingLeft: '10px',
                }}
              >
                "{selectionCard.text.slice(0, 160)}{selectionCard.text.length > 160 ? '...' : ''}"
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={handleEvaluateSelection}
                  style={{
                    flex: 1,
                    padding: '9px 14px',
                    background: 'linear-gradient(180deg, #b45309 0%, #92400e 100%)',
                    border: '1px solid rgba(245,158,11,0.5)',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    letterSpacing: '0.01em',
                  }}
                >
                  🔍 Evaluar con rúbrica
                </button>
                <button
                  onClick={() => { setSelectionCard(null); onClearSelectedText?.(); }}
                  style={{
                    padding: '9px 14px',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '8px',
                    color: '#cbd5e1',
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  Ignorar
                </button>
              </div>
            </div>
          )}

          {/* Messages */}
          <div
            className="chat-panel-scroll"
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '14px 14px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            {messages.map((msg) => (
              <BubbleMessage
                key={msg.id}
                msg={msg}
                onAddFootnote={onAddFootnote}
                onOpenRubricEditor={onOpenRubricEditor}
                formatContent={formatContent}
              />
            ))}

            {isLoading && (
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', paddingLeft: '2px' }}>
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '8px',
                    background: 'rgba(148,163,184,0.1)',
                    border: '1px solid rgba(148,163,184,0.14)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '14px',
                    flexShrink: 0,
                  }}
                >
                  🤖
                </div>
                <div
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    padding: '10px 14px',
                    borderRadius: '12px',
                    display: 'flex',
                    gap: '5px',
                    alignItems: 'center',
                  }}
                >
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      style={{
                        width: '7px',
                        height: '7px',
                        borderRadius: '50%',
                        background: '#94a3b8',
                        animation: `pulse 1.4s ${i * 0.2}s infinite`,
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div
            style={{
              padding: '12px 14px 14px',
              borderTop: '1px solid rgba(148,163,184,0.14)',
              background: 'rgba(15,23,42,0.6)',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '10px',
              alignItems: 'flex-end',
            }}
          >
            {showRubricDetectedBanner && detectedDocumentType === 'rubric' && (
              <div
                style={{
                  width: '100%',
                  marginBottom: '8px',
                  padding: '10px 12px',
                  background: 'rgba(79,70,229,0.12)',
                  border: '1px solid rgba(129,140,248,0.35)',
                  borderRadius: '10px',
                }}
              >
                <div style={{ color: '#c7d2fe', fontSize: '13px', fontWeight: '600', marginBottom: '8px' }}>
                  Documento detectado como rúbrica
                </div>
                <button
                  onClick={handleConvertRubricDocument}
                  disabled={isLoading}
                  style={{
                    padding: '8px 12px',
                    background: 'rgba(99,102,241,0.22)',
                    border: '1px solid rgba(129,140,248,0.4)',
                    borderRadius: '8px',
                    color: '#e0e7ff',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                  }}
                >
                  Convertir a rúbrica editable
                </button>
              </div>
            )}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileAttach}
              accept=".pdf,.docx,.doc,.txt"
              style={{ display: 'none' }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              title="Adjuntar documento"
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                border: '1px solid rgba(255,255,255,0.08)',
                background: 'rgba(255,255,255,0.05)',
                color: '#cbd5e1',
                fontSize: '16px',
                cursor: 'pointer',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background 0.15s ease',
              }}
            >
              📎
            </button>
            <div
              style={{
                flex: 1,
                minWidth: 0,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(148,163,184,0.18)',
                borderRadius: '12px',
                padding: '10px 14px',
                boxShadow: '0 0 0 1px rgba(0,0,0,0) inset',
                transition: 'border-color 0.15s ease',
              }}
            >
              {pastedImage && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    marginBottom: '10px',
                    padding: '10px',
                    background: 'rgba(148,163,184,0.08)',
                    border: '1px solid rgba(148,163,184,0.14)',
                    borderRadius: '10px',
                  }}
                >
                  <img
                    src={pastedImage.dataUrl}
                    alt="Vista previa"
                    style={{
                      width: '48px',
                      height: '48px',
                      objectFit: 'cover',
                      borderRadius: '8px',
                      border: '1px solid rgba(255,255,255,0.12)',
                    }}
                  />
                  <div style={{ flex: 1, color: '#cbd5e1', fontSize: '13px', lineHeight: 1.45 }}>
                    <div style={{ fontWeight: 600, color: '#e2e8f0', fontSize: '13.5px' }}>Captura lista para enviar</div>
                    <div style={{ color: 'rgba(203,213,225,0.78)', fontSize: '12px', marginTop: '3px' }}>
                      Se adjuntará con tu mensaje
                    </div>
                  </div>
                  <button
                    onClick={() => setPastedImage(null)}
                    style={{
                      border: '1px solid rgba(239,68,68,0.25)',
                      background: 'rgba(239,68,68,0.12)',
                      color: '#fca5a5',
                      borderRadius: '8px',
                      padding: '6px 12px',
                      cursor: 'pointer',
                      fontSize: '12.5px',
                      fontWeight: 600,
                    }}
                  >
                    Eliminar
                  </button>
                </div>
              )}
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => { setInput(e.target.value); handleTextareaResize(e); }}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                placeholder="Escribe, pega una captura o selecciona texto del documento… (Shift+Enter = nueva línea)"
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                color: '#f1f5f9',
                fontSize: '14.5px',
                outline: 'none',
                resize: 'none',
                minHeight: '24px',
                maxHeight: isExpanded ? '200px' : '160px',
                lineHeight: 1.6,
                fontFamily: 'inherit',
                overflowY: 'auto',
              }}
                rows={1}
              />
            </div>
            <button
              onClick={() => sendMessage()}
              disabled={(!input.trim() && !pastedImage) || isLoading}
              title="Enviar mensaje"
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                border: '1px solid rgba(245,158,11,0.4)',
                background: (!input.trim() && !pastedImage) || isLoading
                  ? 'rgba(51,65,85,0.45)'
                  : 'linear-gradient(180deg, #b45309 0%, #92400e 100%)',
                color: '#fff',
                fontSize: '15px',
                cursor: (!input.trim() && !pastedImage) || isLoading ? 'not-allowed' : 'pointer',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: (!input.trim() && !pastedImage) || isLoading
                  ? 'none'
                  : '0 6px 16px rgba(180,83,9,0.35)',
                transition: 'all 0.15s ease',
              }}
            >
              ➤
            </button>
          </div>
        </div>
      )}

      {/* FAB Button */}
      <button
        onClick={() => setIsOpen((o) => !o)}
        style={{
          width: '58px',
          height: '58px',
          borderRadius: '50%',
          border: '1px solid rgba(245,158,11,0.35)',
          background: isOpen
            ? 'linear-gradient(135deg, #1f2937 0%, #111827 100%)'
            : 'linear-gradient(135deg, #b45309 0%, #92400e 100%)',
          color: '#fff',
          fontSize: '22px',
          cursor: 'pointer',
          boxShadow: isOpen
            ? '0 10px 28px rgba(2,6,23,0.45)'
            : '0 10px 28px rgba(180,83,9,0.45), 0 0 0 4px rgba(245,158,11,0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s',
          position: 'relative',
        }}
        title={isOpen ? 'Minimizar chat contextual' : 'Abrir chat contextual'}
      >
        {isOpen ? '✕' : '💬'}
        {!isOpen && unreadCount > 0 && (
          <div
            style={{
              position: 'absolute',
              top: '-4px',
              right: '-4px',
              minWidth: '22px',
              height: '22px',
              padding: '0 6px',
              borderRadius: '11px',
              background: '#ef4444',
              color: '#fff',
              fontSize: '12px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid #0f172a',
              boxShadow: '0 2px 6px rgba(239,68,68,0.45)',
            }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </div>
        )}
      </button>
    </div>
  );
}

// ── Individual bubble message ──────────────────────────────────────────────────

function BubbleMessage({ msg, onAddFootnote, onOpenRubricEditor, formatContent }) {
  if (msg.type === 'user') {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div
          style={{
            maxWidth: '88%',
            background: 'linear-gradient(180deg, #3b475c 0%, #2b3547 100%)',
            border: '1px solid rgba(148,163,184,0.18)',
            color: '#f8fafc',
            padding: '11px 15px',
            borderRadius: '14px 14px 4px 14px',
            fontSize: '14.5px',
            lineHeight: 1.65,
            boxShadow: '0 1px 0 rgba(255,255,255,0.04) inset',
          }}
        >
          {msg.imagePreviewUrl && (
            <img
              src={msg.imagePreviewUrl}
              alt="Imagen enviada"
              style={{
                display: 'block',
                maxWidth: '220px',
                maxHeight: '160px',
                borderRadius: '10px',
                marginBottom: msg.content ? '8px' : 0,
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            />
          )}
          {msg.content || 'Imagen enviada'}
        </div>
      </div>
    );
  }

  if (msg.type === 'selection') {
    return (
      <div
        style={{
          background: 'linear-gradient(180deg, rgba(245,158,11,0.12) 0%, rgba(245,158,11,0.06) 100%)',
          border: '1px solid rgba(245,158,11,0.3)',
          borderRadius: '10px',
          padding: '11px 15px',
          fontSize: '13.5px',
          color: '#fcd34d',
          fontStyle: 'italic',
          lineHeight: 1.55,
        }}
      >
        📌 Evaluando: "{msg.content.slice(0, 140)}{msg.content.length > 140 ? '...' : ''}"
      </div>
    );
  }

  if (msg.type === 'agent') {
    return (
      <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
        <div
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '8px',
            background: 'linear-gradient(135deg, rgba(245,158,11,0.22), rgba(99,102,241,0.18))',
            border: '1px solid rgba(148,163,184,0.18)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
            flexShrink: 0,
            marginTop: '2px',
          }}
        >
          🤖
        </div>
        <div style={{ maxWidth: '88%', display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0 }}>
          <div
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(148,163,184,0.14)',
              color: '#e5eaf2',
              padding: '13px 15px',
              borderRadius: '12px 12px 12px 4px',
              fontSize: '14.5px',
              lineHeight: 1.7,
              wordBreak: 'break-word',
            }}
            dangerouslySetInnerHTML={{ __html: formatContent(msg.content) }}
          />
          {/* Footnote proposal button */}
          {msg.hasFootnoteProposal && msg.proposedFootnote && onAddFootnote && (
            <button
              onClick={() => {
                // Prioridad de contexto:
                //  1) Si el mensaje nació de una captura manuscrita, armamos
                //     un captureContext honesto (source=manuscript_capture).
                //  2) Si no, seguimos el flujo textual original con
                //     selectionContext intacto.
                if (msg.chatImageAsset || Number.isInteger(msg.capturePageHint)) {
                  const asset = msg.chatImageAsset;
                  const captureContext = {
                    source: 'manuscript_capture',
                    capture_asset: {
                      thumbnail_data_url: asset?.thumbnail_data_url || null,
                      mime_type: asset?.mime_type || 'image/png',
                      width: asset?.thumbnail_width || 0,
                      height: asset?.thumbnail_height || 0,
                      original_width: asset?.original_width || 0,
                      original_height: asset?.original_height || 0,
                      filename: asset?.filename || 'captura',
                    },
                    transcription: asset?.transcription || null,
                    page_hint: Number.isInteger(asset?.page_hint) ? asset.page_hint : (Number.isInteger(msg.capturePageHint) ? msg.capturePageHint : null),
                    suggested_footnote: asset?.suggested_footnote || null,
                  };
                  onAddFootnote(msg.proposedFootnote, captureContext);
                } else {
                  onAddFootnote(msg.proposedFootnote, msg.selectionContext);
                }
              }}
              style={{
                alignSelf: 'flex-start',
                padding: '9px 14px',
                background: 'linear-gradient(180deg, rgba(34,197,94,0.18) 0%, rgba(34,197,94,0.12) 100%)',
                border: '1px solid rgba(34,197,94,0.4)',
                borderRadius: '8px',
                color: '#bbf7d0',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                textAlign: 'left',
                letterSpacing: '0.01em',
              }}
            >
              ➕ Añadir como nota al pie incremental
            </button>
          )}
          {msg.rubrica_lista && msg.markdown && onOpenRubricEditor && (
            <button
              onClick={() => onOpenRubricEditor(msg.markdown)}
              style={{
                alignSelf: 'flex-start',
                padding: '9px 14px',
                background: 'linear-gradient(180deg, rgba(99,102,241,0.2) 0%, rgba(99,102,241,0.12) 100%)',
                border: '1px solid rgba(129,140,248,0.4)',
                borderRadius: '8px',
                color: '#c7d2fe',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                textAlign: 'left',
                letterSpacing: '0.01em',
              }}
            >
              ✏️ Abrir como rúbrica editable
            </button>
          )}
        </div>
      </div>
    );
  }

  return null;
}
