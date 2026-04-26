import React, { useState, useRef, useEffect } from 'react';
import { agenteAPI } from '../services/api.js';

function ChatPrincipal({
  asignaturas,
  evaluacionActiva,
  procesoEvaluacion,
  resultadoEvaluacion,
  onSubirDocumento,
  user,
  onGuardarRubrica,
  rubricaActiva,
  onRubricaActualizada,
  setRubricaActiva,
  setRubricas,
  onAbrirEditor,
}) {
  const [mensajes, setMensajes] = useState([
    {
      id: 1,
      tipo: 'agente',
      contenido:
        '¡Hola! 👋 Soy tu **Agente Evaluador IA**.\n\nPuedo ayudarte a:\n\n📋 **Crear rúbricas** — *"Crea una rúbrica de filosofía"*\n📤 **Evaluar documentos** párrafo por párrafo\n📊 **Interpretar resultados** de evaluaciones\n💡 **Sugerir mejoras** pedagógicas\n\n¿Qué te gustaría hacer hoy?',
      tiempo: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [cargando, setCargando] = useState(false);
  const [contexto] = useState({});
  const chatEndRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensajes]);

  useEffect(() => {
    if (procesoEvaluacion?.length > 0) {
      const ultimoPaso = procesoEvaluacion[procesoEvaluacion.length - 1];
      const existe = mensajes.some(
        (m) => m.tipo === 'proceso' && m.pasoId === ultimoPaso.id
      );
      if (!existe) {
        setMensajes((prev) => [
          ...prev,
          {
            id: `proceso-${Date.now()}`,
            tipo: 'proceso',
            pasoId: ultimoPaso.id,
            contenido: ultimoPaso.titulo,
            detalle: ultimoPaso.descripcion,
            tiempo: new Date(),
          },
        ]);
      }
    }
    // Intencional: no incluir `mensajes` (evita bucles; solo reaccionamos a nuevos pasos de proceso)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [procesoEvaluacion]);

  useEffect(() => {
    if (resultadoEvaluacion && !mensajes.find((m) => m.tipo === 'resultado')) {
      setMensajes((prev) => [
        ...prev,
        {
          id: `resultado-${Date.now()}`,
          tipo: 'resultado',
          resultado: resultadoEvaluacion,
          tiempo: new Date(),
        },
      ]);
    }
    // Intencional: excluir `mensajes` del array para no duplicar bloques de resultado
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultadoEvaluacion]);

  const agregarMensajeAgente = (contenido, extra = {}) => {
    setMensajes((prev) => [
      ...prev,
      { id: Date.now() + Math.random(), tipo: 'agente', contenido, tiempo: new Date(), ...extra },
    ]);
  };

  const enviarMensaje = async () => {
    if (!input.trim()) return;

    const mensajeUsuario = input.trim();
    setMensajes((prev) => [
      ...prev,
      { id: Date.now(), tipo: 'usuario', contenido: mensajeUsuario, tiempo: new Date() },
    ]);
    setInput('');
    setCargando(true);

    try {
      const historial = mensajes
        .filter((m) => m.tipo === 'usuario' || m.tipo === 'agente')
        .slice(-8)
        .map((m) => ({ tipo: m.tipo, contenido: m.contenido }));

      const respuesta = await agenteAPI.chat(mensajeUsuario, contexto, historial);

      if (respuesta.success) {
        agregarMensajeAgente(respuesta.respuesta);

        // Agent generated a rubric ready to save
        if (respuesta.rubrica_lista && respuesta.markdown_rubrica) {
          setTimeout(() => {
            setMensajes((prev) => [
              ...prev,
              {
                id: Date.now() + 1,
                tipo: 'rubrica_accion',
                markdown: respuesta.markdown_rubrica,
                tiempo: new Date(),
              },
            ]);
          }, 300);
        }
      } else {
        const detail =
          typeof respuesta?.detail === 'string'
            ? respuesta.detail
            : respuesta?.detail
              ? JSON.stringify(respuesta.detail)
              : null;
        agregarMensajeAgente(
          `Lo siento, hubo un error: ${detail || JSON.stringify(respuesta)}`
        );
      }
    } catch (err) {
      agregarMensajeAgente(
        `No pude conectar con el servidor. Error: ${err.message}`
      );
    } finally {
      setCargando(false);
    }
  };

  const handleGuardarRubricaDesdeChat = async (markdown) => {
    if (!onAbrirEditor) {
      console.error('[CHAT] Falta prop onAbrirEditor');
      return;
    }
    onAbrirEditor(markdown);
    agregarMensajeAgente(
      '✅ ¡He abierto el **Editor de Rúbrica** para que confirmes el título y asignatura antes de guardarla en el sistema.'
    );
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      enviarMensaje();
    }
  };

  const handleTextareaResize = (e) => {
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  };

  const sugerenciasRapidas = [
    {
      icono: '📋',
      texto: 'Crear rúbrica de Filosofía',
      accion: () => setInput('Crea una rúbrica de Filosofía para bachillerato'),
    },
    {
      icono: '📄',
      texto: 'Evaluar documento',
      accion: () => fileInputRef.current?.click(),
    },
    {
      icono: '❓',
      texto: 'Cómo funciona',
      accion: () => setInput('¿Cómo funciona la evaluación con notas al pie?'),
    },
  ];

  const formatearContenido = (contenido) =>
    contenido
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br/>');

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h2 style={styles.headerTitle}>
            🤖 {evaluacionActiva ? `Evaluando: ${evaluacionActiva.nombre}` : 'Agente Evaluador IA'}
          </h2>
          {rubricaActiva && (
            <p style={{ margin: 0, fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>
              Rúbrica activa: <strong style={{ color: '#a5b4fc' }}>{rubricaActiva.nombre}</strong>
            </p>
          )}
        </div>
        {user && (
          <span style={styles.saldoBadge}>
            👤 {user.full_name || user.email}
          </span>
        )}
      </div>

      {/* Messages */}
      <div style={styles.mensajesArea}>
        {mensajes.map((msg) => (
          <MensajeItem
            key={msg.id}
            msg={msg}
            onGuardarRubrica={handleGuardarRubricaDesdeChat}
            formatearContenido={formatearContenido}
          />
        ))}

        {cargando && (
          <div style={styles.mensajeAgenteContainer}>
            <div style={styles.avatar}>🤖</div>
            <div style={styles.burbujaAgente}>
              <div style={styles.typingIndicator}>
                <span style={styles.dot} />
                <span style={styles.dot} />
                <span style={styles.dot} />
              </div>
            </div>
          </div>
        )}

        {mensajes.length === 1 && (
          <div style={styles.sugerenciasContainer}>
            {sugerenciasRapidas.map((sug, idx) => (
              <button key={idx} onClick={sug.accion} style={styles.btnSugerencia}>
                {sug.icono} {sug.texto}
              </button>
            ))}
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <div style={styles.inputArea}>
        <input
          type="file"
          ref={fileInputRef}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f && onSubirDocumento) onSubirDocumento(f);
          }}
          accept=".pdf,.docx,.txt,.doc"
          style={{ display: 'none' }}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          style={styles.btnAdjuntar}
          title="Subir documento"
        >
          📎
        </button>
        <div style={styles.inputWrapper}>
          <textarea
            value={input}
            onChange={(e) => { setInput(e.target.value); handleTextareaResize(e); }}
            onKeyPress={handleKeyPress}
            placeholder="Escribe un mensaje... Shift+Enter para nueva línea. Ej: 'Crea una rúbrica de Literatura'"
            style={styles.input}
            rows={1}
          />
        </div>
        <button
          onClick={enviarMensaje}
          disabled={!input.trim() || cargando}
          style={{ ...styles.btnEnviar, opacity: !input.trim() || cargando ? 0.5 : 1 }}
        >
          ➤
        </button>
      </div>
    </div>
  );
}

// ── Mensaje individual ────────────────────────────────────────────────────────

function MensajeItem({ msg, onGuardarRubrica, formatearContenido }) {
  if (msg.tipo === 'usuario') {
    return (
      <div style={styles.mensajeUsuarioContainer}>
        <div style={styles.mensajeContent}>
          <div style={styles.burbujaUsuario}>
            <p style={styles.textoMensaje}>{msg.contenido}</p>
          </div>
          <span style={styles.tiempo}>
            {msg.tiempo.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>
    );
  }

  if (msg.tipo === 'agente') {
    return (
      <div style={styles.mensajeAgenteContainer}>
        <div style={styles.avatar}>🤖</div>
        <div style={styles.mensajeContent}>
          <div style={styles.burbujaAgente}>
            <div dangerouslySetInnerHTML={{ __html: formatearContenido(msg.contenido) }} />
          </div>
          <span style={styles.tiempo}>
            {msg.tiempo.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>
    );
  }

  if (msg.tipo === 'rubrica_accion') {
    return (
      <div style={styles.mensajeAgenteContainer}>
        <div style={styles.avatar}>🤖</div>
        <div style={styles.mensajeContent}>
          <div style={styles.rubricaCard}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <span style={{ fontSize: '20px' }}>📋</span>
              <strong style={{ color: '#a5b4fc' }}>Rúbrica generada lista para guardar</strong>
            </div>
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', margin: '0 0 12px 0' }}>
              La IA ha creado la rúbrica. ¿Deseas guardarla en el sistema?
            </p>
            <button
              onClick={() => onGuardarRubrica(msg.markdown)}
              style={styles.btnGuardarRubrica}
            >
              💾 Guardar en Sistema
            </button>
          </div>
          <span style={styles.tiempo}>
            {msg.tiempo.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>
    );
  }

  if (msg.tipo === 'proceso') {
    return (
      <div style={{ ...styles.mensajeAgenteContainer, paddingLeft: '44px' }}>
        <div style={styles.burbujaProceso}>
          <span style={{ color: '#a5b4fc', fontWeight: 600 }}>⚙️ {msg.contenido}</span>
          {msg.detalle && <p style={{ color: '#808090', fontSize: '13px', margin: '4px 0 0 0' }}>{msg.detalle}</p>}
        </div>
      </div>
    );
  }

  return null;
}

// ── Estilos ───────────────────────────────────────────────────────────────────

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    width: '100%',
    maxWidth: '900px',
    margin: '0 auto',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 24px',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
  },
  headerTitle: { color: '#c0c0d0', fontSize: '16px', fontWeight: '600', margin: 0 },
  saldoBadge: {
    background: 'rgba(148,163,184,0.12)',
    color: '#cbd5e1',
    padding: '6px 12px',
    borderRadius: '20px',
    fontSize: '13px',
    fontWeight: '600',
  },
  mensajesArea: {
    flex: 1,
    overflowY: 'auto',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  mensajeUsuarioContainer: { display: 'flex', justifyContent: 'flex-end' },
  mensajeAgenteContainer: { display: 'flex', gap: '12px' },
  avatar: {
    width: '32px',
    height: '32px',
    background: '#334155',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    fontSize: '16px',
  },
  mensajeContent: { maxWidth: '80%', display: 'flex', flexDirection: 'column', gap: '4px' },
  burbujaUsuario: {
    background: '#334155',
    color: '#fff',
    padding: '12px 16px',
    borderRadius: '16px 16px 4px 16px',
  },
  burbujaAgente: {
    background: 'rgba(255,255,255,0.08)',
    color: '#e0e0e0',
    padding: '16px',
    borderRadius: '12px',
    lineHeight: '1.6',
    fontSize: '14px',
  },
  rubricaCard: {
    background: 'rgba(148,163,184,0.10)',
    border: '1px solid rgba(148,163,184,0.24)',
    borderRadius: '12px',
    padding: '16px',
  },
  burbujaProceso: {
    background: 'rgba(148,163,184,0.08)',
    border: '1px solid rgba(148,163,184,0.18)',
    padding: '12px 16px',
    borderRadius: '12px',
  },
  textoMensaje: { margin: 0, fontSize: '15px', lineHeight: '1.5' },
  tiempo: { fontSize: '11px', color: '#606070', marginTop: '4px' },
  sugerenciasContainer: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px',
    paddingLeft: '44px',
    marginTop: '8px',
  },
  btnSugerencia: {
    background: 'rgba(148,163,184,0.10)',
    border: '1px solid rgba(148,163,184,0.18)',
    color: '#cbd5e1',
    padding: '10px 16px',
    borderRadius: '20px',
    fontSize: '13px',
    cursor: 'pointer',
  },
  btnGuardarRubrica: {
    background: '#334155',
    color: '#fff',
    border: 'none',
    padding: '10px 20px',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    width: '100%',
  },
  typingIndicator: { display: 'flex', gap: '4px', padding: '8px', alignItems: 'center' },
  dot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: '#94a3b8',
    animation: 'pulse 1.4s infinite',
  },
  inputArea: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: '12px',
    padding: '16px 32px 24px',
    borderTop: '1px solid rgba(255,255,255,0.08)',
  },
  btnAdjuntar: {
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    border: 'none',
    background: 'rgba(255,255,255,0.08)',
    color: '#a0a0b0',
    fontSize: '20px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  inputWrapper: {
    flex: 1,
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '16px',
    padding: '14px 18px',
  },
  input: {
    width: '100%',
    background: 'transparent',
    border: 'none',
    color: '#fff',
    fontSize: '15px',
    outline: 'none',
    resize: 'none',
    minHeight: '24px',
    maxHeight: '200px',
    lineHeight: '1.6',
    fontFamily: 'inherit',
    overflowY: 'auto',
  },
  btnEnviar: {
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    border: 'none',
    background: '#334155',
    color: '#fff',
    fontSize: '18px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
};

export default ChatPrincipal;
