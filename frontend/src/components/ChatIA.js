import React, { useState, useRef, useEffect } from 'react';

// Simulacion de respuestas del agente IA
const RESPUESTAS_DEMO = {
  'hola': '¡Hola! Soy tu agente de evaluacion. ¿En que puedo ayudarte hoy?',
  'evaluar': 'Perfecto, puedo ayudarte a evaluar documentos. Sube un archivo y te dare una evaluacion detallada parrafo por parrafo.',
  'como funciona': 'Es sencillo: 1) Subes el documento de tu estudiante, 2) Yo analizo cada parrafo con IA, 3) Recibes calificacion y retroalimentacion detallada segun tu rubrica.',
  'precio': 'El Plan Profesor cuesta $30.000 COP mensuales e incluye 120.000 palabras. ¿Te gustaria suscribirte?',
  'ayuda': 'Puedo ayudarte a: ✅ Evaluar documentos parrafo por parrafo ✅ Crear rubricas personalizadas ✅ Generar retroalimentacion constructiva ✅ Calcular estimaciones de costo',
};

function ChatIA({ documento, onEvaluarDocumento }) {
  const [mensajes, setMensajes] = useState([
    {
      id: 1,
      tipo: 'agente',
      texto: '¡Hola! 👋 Soy tu Agente de Evaluacion IA.\n\nEstoy aqui para ayudarte a evaluar documentos de tus estudiantes de forma personalizada, parrafo por parrafo.\n\n¿Que deseas hacer hoy?',
      tiempo: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [cargando, setCargando] = useState(false);
  const [modoEvaluacion, setModoEvaluacion] = useState(false);
  const chatRef = useRef(null);

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [mensajes]);

  const enviarMensaje = async () => {
    if (!input.trim()) return;

    const mensajeUsuario = {
      id: Date.now(),
      tipo: 'usuario',
      texto: input,
      tiempo: new Date()
    };

    setMensajes(prev => [...prev, mensajeUsuario]);
    setInput('');
    setCargando(true);

    // Simular respuesta del agente
    setTimeout(() => {
      const respuesta = generarRespuesta(input.toLowerCase());
      
      const mensajeAgente = {
        id: Date.now() + 1,
        tipo: 'agente',
        texto: respuesta,
        tiempo: new Date()
      };

      setMensajes(prev => [...prev, mensajeAgente]);
      setCargando(false);
    }, 1500);
  };

  const generarRespuesta = (texto) => {
    // Buscar palabras clave
    if (texto.includes('hola') || texto.includes('buenas')) {
      return RESPUESTAS_DEMO['hola'];
    }
    if (texto.includes('evaluar') || texto.includes('documento') || texto.includes('archivo')) {
      setModoEvaluacion(true);
      return RESPUESTAS_DEMO['evaluar'];
    }
    if (texto.includes('como') && texto.includes('funciona')) {
      return RESPUESTAS_DEMO['como funciona'];
    }
    if (texto.includes('precio') || texto.includes('costo') || texto.includes('pago')) {
      return RESPUESTAS_DEMO['precio'];
    }
    if (texto.includes('ayuda') || texto.includes('?')) {
      return RESPUESTAS_DEMO['ayuda'];
    }
    
    return 'Entiendo. ¿Quieres que evalue un documento? Puedes usar el boton "📎 Subir documento" o arrastrar un archivo aqui.';
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      enviarMensaje();
    }
  };

  const sugerenciasRapidas = [
    { icono: '📄', texto: 'Evaluar documento', accion: () => onEvaluarDocumento() },
    { icono: '📊', texto: 'Crear rubrica', accion: () => setInput('Quiero crear una rubrica personalizada') },
    { icono: '💰', texto: 'Ver mi saldo', accion: () => setInput('¿Cuantas palabras me quedan?') },
  ];

  return (
    <div style={styles.container}>
      {/* Header del Chat */}
      <div style={styles.header}>
        <div style={styles.headerInfo}>
          <div style={styles.avatar}>🤖</div>
          <div>
            <h3 style={styles.nombre}>Agente Evaluador</h3>
            <span style={styles.estado}>● En linea</span>
          </div>
        </div>
        <button style={styles.btnAyuda}>?</button>
      </div>

      {/* Area de mensajes */}
      <div ref={chatRef} style={styles.mensajesArea}>
        {mensajes.map((msg) => (
          <div key={msg.id} style={msg.tipo === 'usuario' ? styles.mensajeUsuario : styles.mensajeAgente}>
            {msg.tipo === 'agente' && <div style={styles.avatarSmall}>🤖</div>}
            <div style={msg.tipo === 'usuario' ? styles.burbujaUsuario : styles.burbujaAgente}>
              <p style={styles.textoMensaje}>{msg.texto}</p>
              <span style={styles.tiempo}>
                {msg.tiempo.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        ))}
        
        {cargando && (
          <div style={styles.mensajeAgente}>
            <div style={styles.avatarSmall}>🤖</div>
            <div style={styles.burbujaAgente}>
              <div style={styles.typingIndicator}>
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        )}

        {/* Sugerencias rapidas */}
        {mensajes.length === 1 && (
          <div style={styles.sugerencias}>
            {sugerenciasRapidas.map((sug, idx) => (
              <button key={idx} onClick={sug.accion} style={styles.btnSugerencia}>
                {sug.icono} {sug.texto}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Input area */}
      <div style={styles.inputArea}>
        <button 
          onClick={onEvaluarDocumento}
          style={styles.btnAdjuntar}
          title="Subir documento"
        >
          📎
        </button>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Escribe tu mensaje o sube un documento..."
          style={styles.input}
          rows={1}
        />
        <button 
          onClick={enviarMensaje}
          disabled={!input.trim() || cargando}
          style={styles.btnEnviar}
        >
          ➤
        </button>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '600px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '16px',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    background: 'rgba(102, 126, 234, 0.1)',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
  },
  headerInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  avatar: {
    width: '44px',
    height: '44px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '24px',
  },
  nombre: {
    margin: 0,
    fontSize: '16px',
    fontWeight: '600',
    color: '#fff',
  },
  estado: {
    fontSize: '13px',
    color: '#22c55e',
    fontWeight: '500',
  },
  btnAyuda: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    border: '1px solid rgba(255,255,255,0.2)',
    background: 'transparent',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '14px',
  },
  mensajesArea: {
    flex: 1,
    overflowY: 'auto',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  mensajeUsuario: {
    display: 'flex',
    justifyContent: 'flex-end',
  },
  mensajeAgente: {
    display: 'flex',
    gap: '10px',
    alignItems: 'flex-end',
  },
  avatarSmall: {
    width: '32px',
    height: '32px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '16px',
    flexShrink: 0,
  },
  burbujaUsuario: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: '#fff',
    padding: '12px 16px',
    borderRadius: '16px 16px 4px 16px',
    maxWidth: '80%',
    wordBreak: 'break-word',
  },
  burbujaAgente: {
    background: 'rgba(255,255,255,0.08)',
    color: '#e0e0e0',
    padding: '12px 16px',
    borderRadius: '16px 16px 16px 4px',
    maxWidth: '80%',
    wordBreak: 'break-word',
  },
  textoMensaje: {
    margin: 0,
    lineHeight: '1.5',
    fontSize: '14px',
    whiteSpace: 'pre-wrap',
  },
  tiempo: {
    fontSize: '11px',
    opacity: 0.7,
    marginTop: '4px',
    display: 'block',
  },
  sugerencias: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    marginTop: '8px',
  },
  btnSugerencia: {
    background: 'rgba(102, 126, 234, 0.15)',
    border: '1px solid rgba(102, 126, 234, 0.3)',
    color: '#a5b4fc',
    padding: '8px 14px',
    borderRadius: '20px',
    fontSize: '13px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  typingIndicator: {
    display: 'flex',
    gap: '4px',
    padding: '4px 8px',
  },
  inputArea: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '16px 20px',
    background: 'rgba(0,0,0,0.2)',
    borderTop: '1px solid rgba(255,255,255,0.08)',
  },
  btnAdjuntar: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    border: 'none',
    background: 'rgba(255,255,255,0.1)',
    color: '#fff',
    fontSize: '20px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '24px',
    padding: '12px 16px',
    color: '#fff',
    fontSize: '14px',
    resize: 'none',
    outline: 'none',
    minHeight: '44px',
    maxHeight: '100px',
  },
  btnEnviar: {
    width: '44px',
    height: '44px',
    borderRadius: '50%',
    border: 'none',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: '#fff',
    fontSize: '18px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: (props) => props.disabled ? 0.5 : 1,
  },
};

export default ChatIA;
