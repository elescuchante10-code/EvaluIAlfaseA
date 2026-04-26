// ============================================================================
//  AsistenteIA — Fase E
//  ---------------------------------------------------------------------------
//  Módulo amplio y premium para el profesor: consultas, planeación de clase,
//  diseño de actividades, análisis de materiales y apoyo IB.
//
//  PRINCIPIOS:
//  - Identidad propia: NO reusa ni deforma `ChatBubble.js`.
//  - No toca el motor de evaluación (CentralEvaluator).
//  - Honesto con sus capacidades: reutiliza `agenteAPI.chat` como canal
//    conversacional real con el agente IA de EvaluAI, sin fingir una
//    integración con Mi Espacio IB que aún no existe.
//  - Preparado para recibir `contextoEspacio` en futuras fases (retrieval,
//    contexto automático, etc.) sin cambios estructurales.
// ============================================================================

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { agenteAPI } from '../services/api.js';
import { useTeacherContextPack } from '../hooks/useTeacherContextPack.js';
import {
  buildTeacherContextSummary,
  teacherContextPackToWire,
} from '../utils/teacherContextPack.js';

const ESPACIO_ASIGNATURA_KEY = 'evaluai.espacioIB.asignatura';

const QUICK_PROMPTS = [
  {
    id: 'consulta',
    icon: '💡',
    label: 'Consulta',
    hint: 'Pregunta abierta sobre un concepto, enfoque o criterio IB',
    prompt: 'Explícame, con enfoque IB, el concepto de ',
  },
  {
    id: 'planeacion',
    icon: '🗓️',
    label: 'Planeación de clase',
    hint: 'Diseña una sesión con objetivos, etapas y evidencias',
    prompt:
      'Ayúdame a planear una clase de 60 minutos para {nivel/asignatura} sobre el tema: ',
  },
  {
    id: 'actividades',
    icon: '🎯',
    label: 'Actividades',
    hint: 'Genera ejercicios, rúbricas o tareas guiadas',
    prompt:
      'Propón 3 actividades graduadas (básica, intermedia, avanzada) para trabajar: ',
  },
  {
    id: 'ib',
    icon: '📘',
    label: 'Apoyo IB',
    hint: 'Criterios, command terms, conceptos clave, ATL, TdC',
    prompt:
      'Desde la perspectiva del Programa IB, ayúdame con: ',
  },
];

const styles = {
  root: {
    flex: 1,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    background:
      'radial-gradient(circle at top left, rgba(99,102,241,0.12) 0%, rgba(2,6,23,0) 45%), linear-gradient(180deg, #0b1220 0%, #020617 100%)',
    color: '#e2e8f0',
    fontFamily: "'Inter', system-ui, sans-serif",
    overflow: 'hidden',
  },
  header: {
    padding: '10px 24px 9px',
    borderBottom: '1px solid rgba(148,163,184,0.1)',
    background: 'rgba(2,6,23,0.38)',
    backdropFilter: 'blur(8px)',
  },
  headerInner: {
    maxWidth: '960px',
    margin: '0 auto',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '14px 20px',
    flexWrap: 'wrap',
  },
  titleBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
    minWidth: 0,
    flex: '1 1 280px',
  },
  eyebrow: {
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: '#a5b4fc',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  title: {
    margin: 0,
    fontSize: '22px',
    fontWeight: 800,
    letterSpacing: '-0.015em',
    lineHeight: 1.2,
    background:
      'linear-gradient(135deg, #f8fafc 0%, #c7d2fe 55%, #a5b4fc 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  subtitle: {
    margin: 0,
    fontSize: '13px',
    color: 'rgba(203,213,225,0.82)',
    lineHeight: 1.45,
    maxWidth: '620px',
  },
  metaRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    alignSelf: 'center',
    flex: '0 1 auto',
  },
  metaChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    padding: '4px 10px',
    borderRadius: '999px',
    border: '1px solid rgba(148,163,184,0.22)',
    background: 'rgba(15,23,42,0.55)',
    color: '#e2e8f0',
    fontSize: '12px',
    fontWeight: 500,
  },
  metaChipAccent: {
    borderColor: 'rgba(129,140,248,0.5)',
    background: 'rgba(67,56,202,0.22)',
    color: '#e0e7ff',
  },
  metaChipWarn: {
    borderColor: 'rgba(250,204,21,0.4)',
    background: 'rgba(113,63,18,0.22)',
    color: '#fde68a',
  },
  body: {
    flex: 1,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  scroll: {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    padding: '12px 20px 6px',
  },
  stream: {
    maxWidth: '860px',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  emptyHero: {
    maxWidth: '860px',
    margin: '0 auto',
    padding: '6px 4px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  heroCard: {
    borderRadius: '14px',
    padding: '14px 18px',
    background:
      'linear-gradient(135deg, rgba(99,102,241,0.14) 0%, rgba(139,92,246,0.1) 60%, rgba(2,6,23,0) 100%)',
    border: '1px solid rgba(129,140,248,0.22)',
  },
  heroTitle: {
    margin: 0,
    fontSize: '17px',
    fontWeight: 700,
    color: '#f1f5f9',
    letterSpacing: '-0.01em',
  },
  heroText: {
    margin: '6px 0 0 0',
    fontSize: '13.5px',
    color: 'rgba(203,213,225,0.86)',
    lineHeight: 1.55,
  },
  promptsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '10px',
  },
  promptCard: {
    textAlign: 'left',
    padding: '11px 13px',
    borderRadius: '12px',
    background: 'rgba(15,23,42,0.7)',
    border: '1px solid rgba(148,163,184,0.2)',
    color: '#e2e8f0',
    cursor: 'pointer',
    transition: 'transform 140ms ease, border-color 140ms ease, background 140ms ease',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  promptCardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  promptIcon: {
    fontSize: '18px',
  },
  promptLabel: {
    fontSize: '14.5px',
    fontWeight: 700,
    color: '#f8fafc',
  },
  promptHint: {
    fontSize: '13px',
    color: 'rgba(203,213,225,0.92)',
    lineHeight: 1.55,
  },
  noticeCard: {
    padding: '12px 16px',
    borderRadius: '11px',
    background: 'rgba(8,47,73,0.35)',
    border: '1px solid rgba(56,189,248,0.24)',
    color: '#bae6fd',
    fontSize: '13px',
    lineHeight: 1.55,
  },
  msgRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  msgRowUser: {
    alignItems: 'flex-end',
  },
  msgRowAssistant: {
    alignItems: 'flex-start',
  },
  msgMeta: {
    fontSize: '11.5px',
    letterSpacing: '0.07em',
    textTransform: 'uppercase',
    color: 'rgba(203,213,225,0.85)',
    fontWeight: 700,
  },
  msgBubble: {
    maxWidth: '82%',
    padding: '14px 18px',
    borderRadius: '14px',
    fontSize: '15px',
    lineHeight: 1.7,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  msgBubbleUser: {
    background:
      'linear-gradient(135deg, rgba(99,102,241,0.28) 0%, rgba(139,92,246,0.28) 100%)',
    border: '1px solid rgba(129,140,248,0.45)',
    color: '#f8fafc',
    borderBottomRightRadius: '4px',
  },
  msgBubbleAssistant: {
    background: 'rgba(15,23,42,0.82)',
    border: '1px solid rgba(148,163,184,0.18)',
    color: '#e2e8f0',
    borderBottomLeftRadius: '4px',
  },
  msgBubbleError: {
    background: 'rgba(127,29,29,0.35)',
    borderColor: 'rgba(248,113,113,0.45)',
    color: '#fecaca',
  },
  msgImage: {
    marginTop: '8px',
    maxWidth: '260px',
    maxHeight: '200px',
    borderRadius: '10px',
    border: '1px solid rgba(148,163,184,0.25)',
    objectFit: 'cover',
  },
  composerWrap: {
    padding: '6px 20px 14px',
    marginTop: '-2px',
    borderTop: '1px solid rgba(148,163,184,0.08)',
    background:
      'linear-gradient(180deg, rgba(2,6,23,0.35) 0%, rgba(2,6,23,0.72) 55%, rgba(2,6,23,0.88) 100%)',
  },
  composer: {
    maxWidth: '860px',
    margin: '0 auto',
    background: 'rgba(15,23,42,0.92)',
    border: '1px solid rgba(148,163,184,0.22)',
    borderRadius: '14px',
    padding: '10px 10px 8px',
    boxShadow: '0 8px 28px rgba(2,6,23,0.38)',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  composerFocus: {
    borderColor: 'rgba(129,140,248,0.55)',
    boxShadow: '0 0 0 3px rgba(99,102,241,0.15), 0 12px 40px rgba(2,6,23,0.45)',
  },
  attachmentsRow: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
    padding: '0 4px',
  },
  attachmentChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '5px 10px 5px 5px',
    background: 'rgba(30,41,59,0.9)',
    border: '1px solid rgba(148,163,184,0.3)',
    borderRadius: '10px',
    fontSize: '12.5px',
    color: '#e2e8f0',
  },
  attachmentThumb: {
    width: '28px',
    height: '28px',
    borderRadius: '6px',
    objectFit: 'cover',
  },
  attachmentRemove: {
    background: 'transparent',
    border: 'none',
    color: 'rgba(252,165,165,0.9)',
    cursor: 'pointer',
    fontSize: '13px',
    padding: '0 4px',
    lineHeight: 1,
  },
  textarea: {
    width: '100%',
    resize: 'none',
    minHeight: '64px',
    maxHeight: '240px',
    background: 'transparent',
    border: 'none',
    outline: 'none',
    color: '#f8fafc',
    fontFamily: 'inherit',
    fontSize: '15px',
    lineHeight: 1.6,
    padding: '8px 10px',
  },
  composerFooter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '10px',
    padding: '0 4px',
  },
  composerTools: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    flexWrap: 'wrap',
  },
  toolButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 12px',
    borderRadius: '8px',
    border: '1px solid rgba(148,163,184,0.24)',
    background: 'rgba(30,41,59,0.6)',
    color: '#cbd5e1',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 500,
  },
  hint: {
    fontSize: '12px',
    color: 'rgba(148,163,184,0.85)',
  },
  sendButton: {
    padding: '11px 22px',
    borderRadius: '10px',
    border: '1px solid rgba(129,140,248,0.6)',
    background:
      'linear-gradient(135deg, rgba(99,102,241,0.9) 0%, rgba(139,92,246,0.9) 100%)',
    color: '#ffffff',
    fontWeight: 700,
    fontSize: '14px',
    cursor: 'pointer',
    letterSpacing: '0.01em',
    boxShadow: '0 6px 18px rgba(99,102,241,0.35)',
  },
  sendButtonDisabled: {
    opacity: 0.45,
    cursor: 'not-allowed',
    boxShadow: 'none',
  },
  typing: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    color: 'rgba(203,213,225,0.85)',
    fontSize: '13.5px',
  },
  typingDots: {
    display: 'inline-flex',
    gap: '3px',
  },
  typingDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    background: '#a5b4fc',
    animation: 'pulse 1.1s infinite ease-in-out',
  },
};

const readFileAsDataURL = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve({
        dataUrl: reader.result,
        mimeType: file.type || 'image/png',
        name: file.name || `adjunto-${Date.now()}.png`,
      });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const AsistenteIA = ({ asignaturaActiva: asignaturaActivaProp = '', rubricaActiva = null }) => {
  const teacherContextPack = useTeacherContextPack();

  // Leemos la asignatura activa de Mi Espacio IB sin acoplarnos a su lógica:
  // simplemente consultamos la misma clave de localStorage que ese módulo
  // persiste de forma pública. Si el prop viene definido, tiene prioridad.
  const [asignaturaLocal, setAsignaturaLocal] = useState(() => {
    try {
      if (typeof window !== 'undefined') {
        return window.localStorage.getItem(ESPACIO_ASIGNATURA_KEY) || '';
      }
    } catch (_err) {
      /* noop */
    }
    return '';
  });

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const value = window.localStorage.getItem(ESPACIO_ASIGNATURA_KEY) || '';
        setAsignaturaLocal(value);
      }
    } catch (_err) {
      setAsignaturaLocal('');
    }
  }, [teacherContextPack]);

  const asignaturaActiva = (
    asignaturaActivaProp ||
    asignaturaLocal ||
    teacherContextPack?.asignatura_activa ||
    ''
  ).trim();

  const docCount =
    teacherContextPack?.documents && Array.isArray(teacherContextPack.documents)
      ? teacherContextPack.documents.length
      : 0;

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [pendingImages, setPendingImages] = useState([]); // [{dataUrl, mimeType, name}]
  const [isSending, setIsSending] = useState(false);
  const [focused, setFocused] = useState(false);

  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, isSending]);

  // Auto-resize de la textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }, [input]);

  const addImages = useCallback(async (files) => {
    const imgs = [];
    for (const f of files) {
      if (f && f.type && f.type.startsWith('image/')) {
        try {
          const img = await readFileAsDataURL(f);
          imgs.push(img);
        } catch (_e) {
          // Ignora archivos ilegibles sin bloquear al usuario
        }
      }
    }
    if (imgs.length) {
      setPendingImages((prev) => [...prev, ...imgs]);
    }
  }, []);

  const handlePaste = useCallback(
    async (e) => {
      const items = Array.from(e.clipboardData?.items || []);
      const imageItems = items.filter(
        (it) => it.kind === 'file' && it.type && it.type.startsWith('image/')
      );
      if (!imageItems.length) return;
      e.preventDefault();
      const files = imageItems.map((it) => it.getAsFile()).filter(Boolean);
      await addImages(files);
    },
    [addImages]
  );

  const handleFileInput = useCallback(
    async (e) => {
      const files = Array.from(e.target.files || []);
      await addImages(files);
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    [addImages]
  );

  const removePendingImage = useCallback((idx) => {
    setPendingImages((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const applyPromptTemplate = useCallback((template) => {
    setInput(template);
    setTimeout(() => {
      const el = textareaRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      }
    }, 0);
  }, []);

  const buildHistorial = useCallback((prevMessages) => {
    // Mantiene un historial compacto para el endpoint. Enviamos los últimos
    // turnos en formato {role, content} — compatible con la convención del
    // backend sin asumir un contrato específico.
    return prevMessages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .slice(-10)
      .map((m) => ({
        tipo: m.role === 'user' ? 'usuario' : 'agente',
        contenido: m.content,
      }));
  }, []);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    const images = pendingImages;
    if (!text && !images.length) return;
    if (isSending) return;

    const userMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text,
      images: images.map((i) => ({ dataUrl: i.dataUrl, name: i.name })),
      ts: new Date(),
    };

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput('');
    setPendingImages([]);
    setIsSending(true);

    // Contexto explícito y honesto: aditivo al contrato existente; el backend
    // puede usar o ignorar estos campos. Sin retrieval semántico en esta fase.
    const wirePack = teacherContextPackToWire(teacherContextPack);
    const summary = buildTeacherContextSummary(teacherContextPack);
    const contexto = {
      modo: 'asistente',
      superficie: 'asistente_ia',
      asignatura_activa: asignaturaActiva || null,
      rubrica_activa: rubricaActiva
        ? {
            id: rubricaActiva.id || null,
            nombre: rubricaActiva.nombre || rubricaActiva.title || null,
            asignatura: rubricaActiva.asignatura || null,
          }
        : null,
      teacher_context_pack: wirePack,
      teacher_context_summary: summary,
    };

    const historial = buildHistorial(messages);

    // El endpoint acepta una sola imagen por request. Si el profesor
    // adjuntó varias, enviamos la primera como imagen principal y listamos
    // las demás como nombres en el texto para no perder información.
    const primaryImage = images[0]
      ? {
          data_url: images[0].dataUrl,
          mime_type: images[0].mimeType,
          filename: images[0].name,
        }
      : null;

    let mensajeFinal = text;
    if (!mensajeFinal && primaryImage) {
      mensajeFinal = '[Imagen adjunta sin texto]';
    }
    if (images.length > 1) {
      const extras = images.slice(1).map((i) => i.name).join(', ');
      mensajeFinal = `${mensajeFinal}\n\n(Adjuntos adicionales: ${extras})`;
    }

    try {
      const resp = await agenteAPI.chat(mensajeFinal, contexto, historial, primaryImage);
      if (resp?.success === false) {
        const detail =
          typeof resp?.detail === 'string'
            ? resp.detail
            : resp?.detail
              ? JSON.stringify(resp.detail)
              : null;
        throw new Error(detail || `Error ${resp?.status || ''}`.trim());
      }
      const assistantContent =
        resp?.respuesta ||
        resp?.response ||
        resp?.mensaje ||
        resp?.message ||
        resp?.content ||
        (typeof resp === 'string' ? resp : '');

      if (!assistantContent) {
        throw new Error('Respuesta vacía del asistente.');
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: assistantContent,
          ts: new Date(),
        },
      ]);
    } catch (err) {
      const msg = typeof err?.message === 'string' && err.message.trim()
        ? err.message.trim()
        : null;
      setMessages((prev) => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          role: 'assistant',
          content:
            msg
              ? `No pude obtener una respuesta del asistente. Detalle: ${msg}`
              : 'No pude obtener una respuesta del asistente en este momento. Revisa tu conexión con el backend e inténtalo de nuevo.',
          error: true,
          ts: new Date(),
        },
      ]);
    } finally {
      setIsSending(false);
    }
  }, [
    asignaturaActiva,
    buildHistorial,
    input,
    isSending,
    messages,
    pendingImages,
    rubricaActiva,
    teacherContextPack,
  ]);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    },
    [sendMessage]
  );

  const hasContent = useMemo(
    () => Boolean(input.trim() || pendingImages.length),
    [input, pendingImages]
  );

  const isEmptyConversation = messages.length === 0;

  return (
    <div style={styles.root}>
      {/* ── Header ────────────────────────────────────────────── */}
      <div style={styles.header}>
        <div style={styles.headerInner}>
          <div style={styles.titleBlock}>
            <span style={styles.eyebrow}>
              <span>🤖</span>
              <span>Asistente IA · Fase E</span>
            </span>
            <h1 style={styles.title}>Tu copiloto docente</h1>
            <p style={styles.subtitle}>
              Un espacio amplio para pensar, planear y construir tus clases con IA.
              Consulta conceptos, diseña actividades y analiza materiales.
              Independiente del evaluador; no altera tus rúbricas ni tus documentos en curso.
            </p>
          </div>
          <div style={styles.metaRow}>
            {asignaturaActiva ? (
              <span style={{ ...styles.metaChip, ...styles.metaChipAccent }} title="Asignatura activa en Mi Espacio IB">
                <span>📘</span>
                <span>Asignatura: {asignaturaActiva}</span>
              </span>
            ) : (
              <span style={{ ...styles.metaChip, ...styles.metaChipWarn }} title="Selecciona una asignatura en Mi Espacio IB">
                <span>📘</span>
                <span>Sin asignatura activa</span>
              </span>
            )}
            <span
              style={{
                ...styles.metaChip,
                ...(docCount > 0 ? styles.metaChipAccent : {}),
              }}
              title="Índice local de Mi Espacio IB; el backend puede recuperar fragmentos del Markdown con coincidencia simple (sin embeddings)"
            >
              <span>🧠</span>
              <span>
                {docCount > 0
                  ? `Mi Espacio: ${docCount} doc(s) indexados`
                  : 'Mi Espacio: sin documentos indexados'}
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* ── Body ──────────────────────────────────────────────── */}
      <div style={styles.body}>
        <div ref={scrollRef} style={styles.scroll} className="chat-panel-scroll">
          {isEmptyConversation ? (
            <div style={styles.emptyHero}>
              <div style={styles.heroCard}>
                <h2 style={styles.heroTitle}>¿Con qué quieres empezar hoy?</h2>
                <p style={styles.heroText}>
                  Escribe una pregunta, pega una imagen o una captura de
                  pantalla, o elige uno de los accesos rápidos para acelerar tu
                  trabajo. Este módulo está pensado para sesiones largas,
                  distinto al chat contextual dentro de <em>Evaluar</em>.
                </p>
              </div>

              <div style={styles.promptsGrid}>
                {QUICK_PROMPTS.map((qp) => (
                  <button
                    key={qp.id}
                    type="button"
                    style={styles.promptCard}
                    onClick={() => applyPromptTemplate(qp.prompt)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(129,140,248,0.55)';
                      e.currentTarget.style.background = 'rgba(30,41,59,0.85)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(148,163,184,0.2)';
                      e.currentTarget.style.background = 'rgba(15,23,42,0.7)';
                    }}
                  >
                    <div style={styles.promptCardHeader}>
                      <span style={styles.promptIcon}>{qp.icon}</span>
                      <span style={styles.promptLabel}>{qp.label}</span>
                    </div>
                    <span style={styles.promptHint}>{qp.hint}</span>
                  </button>
                ))}
              </div>

              <div style={styles.noticeCard}>
                <strong>Nota honesta.</strong> El asistente está conectado al
                agente IA de EvaluAI y puede trabajar con texto e imágenes.
                {docCount > 0 ? (
                  <>
                    {' '}
                    Se envía al modelo un <strong>índice auditable</strong> de tu{' '}
                    <em>Mi Espacio IB</em> (asignatura, <code>document_id</code>,
                    nombre y categoría documental). No hay recuperación profunda de
                    contenido todavía: si necesitas analizar un PDF, pégalo o
                    adjunta captura.
                  </>
                ) : (
                  <>
                    {' '}
                    Aún no hay documentos guardados en <em>Mi Espacio IB</em> para
                    la asignatura activa; el chat funciona igual sin ese
                    enriquecimiento.
                  </>
                )}
              </div>
            </div>
          ) : (
            <div style={styles.stream}>
              {messages.map((msg) => {
                const isUser = msg.role === 'user';
                return (
                  <div
                    key={msg.id}
                    style={{
                      ...styles.msgRow,
                      ...(isUser ? styles.msgRowUser : styles.msgRowAssistant),
                    }}
                  >
                    <span style={styles.msgMeta}>
                      {isUser ? 'Tú' : 'Asistente IA'}
                    </span>
                    <div
                      style={{
                        ...styles.msgBubble,
                        ...(isUser ? styles.msgBubbleUser : styles.msgBubbleAssistant),
                        ...(msg.error ? styles.msgBubbleError : {}),
                      }}
                    >
                      {msg.content}
                      {isUser && msg.images && msg.images.length > 0 && (
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
                          {msg.images.map((img, idx) => (
                            <img
                              key={idx}
                              src={img.dataUrl}
                              alt={img.name || `adjunto-${idx}`}
                              style={styles.msgImage}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {isSending && (
                <div style={{ ...styles.msgRow, ...styles.msgRowAssistant }}>
                  <span style={styles.msgMeta}>Asistente IA</span>
                  <div style={{ ...styles.msgBubble, ...styles.msgBubbleAssistant }}>
                    <span style={styles.typing}>
                      Pensando
                      <span style={styles.typingDots}>
                        <span style={{ ...styles.typingDot, animationDelay: '0s' }} />
                        <span style={{ ...styles.typingDot, animationDelay: '0.2s' }} />
                        <span style={{ ...styles.typingDot, animationDelay: '0.4s' }} />
                      </span>
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Composer ───────────────────────────────────────── */}
        <div style={styles.composerWrap}>
          <div
            style={{
              ...styles.composer,
              ...(focused ? styles.composerFocus : {}),
            }}
          >
            {pendingImages.length > 0 && (
              <div style={styles.attachmentsRow}>
                {pendingImages.map((img, idx) => (
                  <span key={idx} style={styles.attachmentChip}>
                    <img src={img.dataUrl} alt={img.name} style={styles.attachmentThumb} />
                    <span style={{ maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {img.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => removePendingImage(idx)}
                      style={styles.attachmentRemove}
                      title="Quitar imagen"
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}

            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder="Escribe tu consulta, pega una captura o adjunta una imagen…   (Enter envía · Shift+Enter salto de línea)"
              style={styles.textarea}
              rows={3}
              disabled={isSending}
            />

            <div style={styles.composerFooter}>
              <div style={styles.composerTools}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileInput}
                  style={{ display: 'none' }}
                />
                <button
                  type="button"
                  style={styles.toolButton}
                  onClick={() => fileInputRef.current?.click()}
                  title="Adjuntar imagen o captura"
                  disabled={isSending}
                >
                  📎 Adjuntar imagen
                </button>
                <span style={styles.hint}>
                  Soporta pegar imágenes directamente (Ctrl/Cmd+V)
                </span>
              </div>
              <button
                type="button"
                onClick={sendMessage}
                disabled={!hasContent || isSending}
                style={{
                  ...styles.sendButton,
                  ...(!hasContent || isSending ? styles.sendButtonDisabled : {}),
                }}
              >
                {isSending ? 'Enviando…' : 'Enviar ↵'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AsistenteIA;
