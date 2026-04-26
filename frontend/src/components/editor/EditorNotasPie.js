import React, { useState, useEffect, useCallback } from 'react';
import ParrafoConNotas from './ParrafoConNotas';
import NotaPieCard from './NotaPieCard';
import { calcularCalificacionParrafo } from '../../utils/rubricaParser';
import './editor.css';

/**
 * Editor principal de notas al pie
 * Gestiona la vista de párrafos y sus correcciones
 */
function EditorNotasPie({
  evaluacionId,
  documento,
  rubrica,
  modo = 'revision', // 'revision' | 'solo_lectura'
  onGuardarBorrador,
  onGenerarFinal,
  onCancelar
}) {
  const [parrafos, setParrafos] = useState([]);
  const [parrafoActivo, setParrafoActivo] = useState(0);
  const [vistaMode, setVistaMode] = useState('individual'); // 'individual' | 'completa'
  const [filtroSemaforo, setFiltroSemaforo] = useState('todos');
  const [mostrarChat, setMostrarChat] = useState(true);
  const [mensajesChat, setMensajesChat] = useState([]);
  const [inputChat, setInputChat] = useState('');
  const [procesando, setProcesando] = useState(false);

  // Inicializar párrafos desde el documento
  useEffect(() => {
    if (documento && documento.parrafos) {
      setParrafos(documento.parrafos);
    }
  }, [documento]);

  // Calcular estadísticas
  const estadisticas = useCallback(() => {
    const stats = {
      totalParrafos: parrafos.length,
      parrafosRevisados: parrafos.filter(p => p.estado_revision === 'completado').length,
      notasTotales: 0,
      notasPendientes: 0,
      notasAceptadas: 0,
      notasRechazadas: 0,
      porTipo: { ROJO: 0, AZUL: 0, VERDE: 0, NARANJA: 0 },
      calificacionGlobal: 0
    };

    parrafos.forEach(parrafo => {
      if (parrafo.notas_pie) {
        parrafo.notas_pie.forEach(nota => {
          stats.notasTotales++;
          stats.porTipo[nota.tipo]++;
          
          if (nota.estado === 'pendiente') stats.notasPendientes++;
          else if (nota.estado === 'aceptada') stats.notasAceptadas++;
          else if (nota.estado === 'rechazada') stats.notasRechazadas++;
        });
      }
      stats.calificacionGlobal += parrafo.calificacion || 0;
    });

    stats.calificacionGlobal = stats.calificacionGlobal / (parrafos.length || 1);
    
    return stats;
  }, [parrafos]);

  const stats = estadisticas();

  // Manejar aceptar nota
  const handleAceptarNota = (parrafoId, notaId, comentario) => {
    setParrafos(prev => prev.map(parrafo => {
      if (parrafo.id !== parrafoId) return parrafo;
      
      const nuevasNotas = parrafo.notas_pie.map(nota => {
        if (nota.id !== notaId) return nota;
        return {
          ...nota,
          estado: 'aceptada',
          comentario_profesor: comentario,
          fecha_decision: new Date().toISOString()
        };
      });

      // Recalcular calificación
      const nuevaCalificacion = calcularCalificacionParrafo(nuevasNotas, rubrica);
      
      return {
        ...parrafo,
        notas_pie: nuevasNotas,
        calificacion: nuevaCalificacion.nota,
        semaforo: nuevaCalificacion.semaforo
      };
    }));

    // Agregar mensaje al chat
    agregarMensajeChat('sistema', `✓ Nota aceptada en párrafo ${parrafoActivo + 1}`);
  };

  // Manejar rechazar nota
  const handleRechazarNota = (parrafoId, notaId, comentario) => {
    setParrafos(prev => prev.map(parrafo => {
      if (parrafo.id !== parrafoId) return parrafo;
      
      const nuevasNotas = parrafo.notas_pie.map(nota => {
        if (nota.id !== notaId) return nota;
        return {
          ...nota,
          estado: 'rechazada',
          comentario_profesor: comentario,
          fecha_decision: new Date().toISOString()
        };
      });

      // Recalcular calificación
      const nuevaCalificacion = calcularCalificacionParrafo(nuevasNotas, rubrica);
      
      return {
        ...parrafo,
        notas_pie: nuevasNotas,
        calificacion: nuevaCalificacion.nota,
        semaforo: nuevaCalificacion.semaforo
      };
    }));

    agregarMensajeChat('sistema', `✗ Nota rechazada en párrafo ${parrafoActivo + 1}`);
  };

  // Manejar editar nota
  const handleEditarNota = (parrafoId, notaId, datos) => {
    setParrafos(prev => prev.map(parrafo => {
      if (parrafo.id !== parrafoId) return parrafo;
      
      const nuevasNotas = parrafo.notas_pie.map(nota => {
        if (nota.id !== notaId) return nota;
        return {
          ...nota,
          ...datos,
          fecha_decision: new Date().toISOString()
        };
      });

      const nuevaCalificacion = calcularCalificacionParrafo(nuevasNotas, rubrica);
      
      return {
        ...parrafo,
        notas_pie: nuevasNotas,
        calificacion: nuevaCalificacion.nota,
        semaforo: nuevaCalificacion.semaforo
      };
    }));
  };

  // Aceptar todas las notas VERDES pendientes
  const handleAceptarTodasVerdes = (parrafoId) => {
    setParrafos(prev => prev.map(parrafo => {
      if (parrafo.id !== parrafoId) return parrafo;
      
      const nuevasNotas = parrafo.notas_pie.map(nota => {
        if (nota.tipo === 'VERDE' && nota.estado === 'pendiente') {
          return {
            ...nota,
            estado: 'aceptada',
            fecha_decision: new Date().toISOString()
          };
        }
        return nota;
      });

      const nuevaCalificacion = calcularCalificacionParrafo(nuevasNotas, rubrica);
      
      return {
        ...parrafo,
        notas_pie: nuevasNotas,
        calificacion: nuevaCalificacion.nota,
        semaforo: nuevaCalificacion.semaforo
      };
    }));

    agregarMensajeChat('sistema', `✓ Aceptadas todas las correcciones VERDES del párrafo ${parrafoActivo + 1}`);
  };

  // Aceptar TODAS las verdes del documento
  const handleAceptarTodasVerdesGlobal = () => {
    setParrafos(prev => prev.map(parrafo => {
      const nuevasNotas = parrafo.notas_pie.map(nota => {
        if (nota.tipo === 'VERDE' && nota.estado === 'pendiente') {
          return {
            ...nota,
            estado: 'aceptada',
            fecha_decision: new Date().toISOString()
          };
        }
        return nota;
      });

      const nuevaCalificacion = calcularCalificacionParrafo(nuevasNotas, rubrica);
      
      return {
        ...parrafo,
        notas_pie: nuevasNotas,
        calificacion: nuevaCalificacion.nota,
        semaforo: nuevaCalificacion.semaforo
      };
    }));

    agregarMensajeChat('sistema', '✓ Aceptadas todas las correcciones VERDES del documento');
  };

  // Agregar mensaje al chat
  const agregarMensajeChat = (tipo, contenido) => {
    setMensajesChat(prev => [...prev, {
      id: Date.now(),
      tipo,
      contenido,
      tiempo: new Date()
    }]);
  };

  // Enviar mensaje al chat
  const handleEnviarChat = () => {
    if (!inputChat.trim()) return;
    
    agregarMensajeChat('usuario', inputChat);
    setInputChat('');
    setProcesando(true);

    // Simular respuesta de IA
    setTimeout(() => {
      agregarMensajeChat('ia', `Entiendo tu pregunta sobre "${inputChat}". En el párrafo ${parrafoActivo + 1}, puedo ayudarte a analizar las correcciones propuestas. ¿Necesitas que profundice en alguna nota específica?`);
      setProcesando(false);
    }, 1000);
  };

  // Navegar entre párrafos
  const handleAnterior = () => {
    if (parrafoActivo > 0) setParrafoActivo(prev => prev - 1);
  };

  const handleSiguiente = () => {
    if (parrafoActivo < parrafos.length - 1) setParrafoActivo(prev => prev + 1);
  };

  // Renderizar vista individual
  const renderVistaIndividual = () => {
    const parrafo = parrafos[parrafoActivo];
    if (!parrafo) return null;

    return (
      <div className="vista-individual">
        {/* Navegación */}
        <div className="navegacion-parrafos">
          <button 
            onClick={handleAnterior} 
            disabled={parrafoActivo === 0}
            className="btn-navegacion"
          >
            ◀ Anterior
          </button>
          <span className="contador-parrafos">
            Párrafo {parrafoActivo + 1} de {parrafos.length}
          </span>
          <button 
            onClick={handleSiguiente} 
            disabled={parrafoActivo === parrafos.length - 1}
            className="btn-navegacion"
          >
            Siguiente ▶
          </button>
        </div>

        {/* Párrafo con notas */}
        <ParrafoConNotas
          parrafo={parrafo}
          onNotaClick={(notaId) => {
            // Scroll a la nota correspondiente
            const elemento = document.getElementById(`nota-card-${notaId}`);
            if (elemento) {
              elemento.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }}
          mostrarNotas={false} // Las mostramos separadas abajo
        />

        {/* Notas al pie del párrafo */}
        <div className="notas-detalle">
          <h4>Notas al pie de este párrafo ({parrafo.notas_pie?.length || 0})</h4>
          
          {parrafo.notas_pie && parrafo.notas_pie.length > 0 ? (
            <div className="notas-cards">
              {parrafo.notas_pie.map(nota => (
                <div key={nota.id} id={`nota-card-${nota.id}`}>
                  <NotaPieCard
                    nota={nota}
                    onAceptar={(notaId, comentario) => handleAceptarNota(parrafo.id, notaId, comentario)}
                    onRechazar={(notaId, comentario) => handleRechazarNota(parrafo.id, notaId, comentario)}
                    onEditar={(notaId, datos) => handleEditarNota(parrafo.id, notaId, datos)}
                  />
                </div>
              ))}
            </div>
          ) : (
            <p className="sin-notas">No hay correcciones en este párrafo.</p>
          )}

          {/* Acciones rápidas del párrafo */}
          {parrafo.notas_pie && parrafo.notas_pie.some(n => n.tipo === 'VERDE' && n.estado === 'pendiente') && (
            <button 
              className="btn-aceptar-todas-verdes"
              onClick={() => handleAceptarTodasVerdes(parrafo.id)}
            >
              ✨ Aceptar todas las VERDES de este párrafo
            </button>
          )}
        </div>
      </div>
    );
  };

  // Renderizar vista completa
  const renderVistaCompleta = () => {
    return (
      <div className="vista-completa">
        {parrafos.map((parrafo, index) => (
          <div 
            key={parrafo.id} 
            className={`parrafo-resumen ${index === parrafoActivo ? 'activo' : ''}`}
            onClick={() => {
              setParrafoActivo(index);
              setVistaMode('individual');
            }}
          >
            <div className="parrafo-header-resumen">
              <span className="parrafo-numero">Párrafo {index + 1}</span>
              <span className={`semaforo-badge semaforo-${parrafo.semaforo?.toLowerCase()}`}>
                {parrafo.semaforo === 'VERDE' && '🟢'}
                {parrafo.semaforo === 'AMARILLO' && '🟡'}
                {parrafo.semaforo === 'NARANJA' && '🟠'}
                {parrafo.semaforo === 'ROJO' && '🔴'}
                {' '}
                {parrafo.calificacion}/10
              </span>
            </div>
            <p className="parrafo-preview">
              {parrafo.texto_original?.substring(0, 100)}...
            </p>
            <div className="parrafo-notas-resumen">
              {parrafo.notas_pie?.length || 0} correcciones
              {' '}
              ({parrafo.notas_pie?.filter(n => n.estado === 'pendiente').length || 0} pendientes)
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="editor-notas-pie">
      {/* Header del editor */}
      <div className="editor-header">
        <div className="editor-titulo">
          <h2>📄 Revisión de Correcciones</h2>
          <span className="documento-nombre">{documento?.titulo || 'Documento sin título'}</span>
        </div>
        <div className="editor-acciones-header">
          <button className="btn-guardar" onClick={onGuardarBorrador}>
            💾 Guardar borrador
          </button>
          <button className="btn-finalizar" onClick={onGenerarFinal}>
            📄 Generar informe final
          </button>
          <button className="btn-cancelar" onClick={onCancelar}>
            ✖
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="editor-toolbar">
        <div className="vista-selector">
          <button 
            className={vistaMode === 'individual' ? 'activo' : ''}
            onClick={() => setVistaMode('individual')}
          >
            👁️ Vista por párrafo
          </button>
          <button 
            className={vistaMode === 'completa' ? 'activo' : ''}
            onClick={() => setVistaMode('completa')}
          >
            📋 Vista completa
          </button>
        </div>
        <div className="filtro-semaforo">
          <label>Filtrar:</label>
          <select value={filtroSemaforo} onChange={(e) => setFiltroSemaforo(e.target.value)}>
            <option value="todos">Todos los párrafos</option>
            <option value="pendientes">Con correcciones pendientes</option>
            <option value="criticos">Semaforo rojo 🔴</option>
          </select>
        </div>
      </div>

      <div className="editor-contenido">
        {/* Panel principal */}
        <div className="editor-panel-principal">
          {vistaMode === 'individual' ? renderVistaIndividual() : renderVistaCompleta()}
        </div>

        {/* Panel lateral derecho */}
        <div className="editor-panel-lateral">
          {/* Progreso */}
          <div className="panel-seccion">
            <h4>📊 Progreso</h4>
            <div className="progreso-barra">
              <div 
                className="progreso-fill" 
                style={{ width: `${(stats.parrafosRevisados / stats.totalParrafos) * 100}%` }}
              />
            </div>
            <p>{stats.parrafosRevisados} de {stats.totalParrafos} párrafos revisados</p>
          </div>

          {/* Estadísticas de notas */}
          <div className="panel-seccion">
            <h4>📝 Correcciones</h4>
            <div className="stats-notas">
              <div className="stat-item">
                <span className="stat-total">{stats.notasTotales}</span>
                <span>Total</span>
              </div>
              <div className="stat-item pendientes">
                <span className="stat-numero">{stats.notasPendientes}</span>
                <span>Pendientes</span>
              </div>
              <div className="stat-item aceptadas">
                <span className="stat-numero">{stats.notasAceptadas}</span>
                <span>Aceptadas</span>
              </div>
            </div>
            
            {stats.porTipo.ROJO > 0 && (
              <div className="alerta-roja">
                🔴 {stats.porTipo.ROJO} errores críticos pendientes
              </div>
            )}
          </div>

          {/* Acciones globales */}
          <div className="panel-seccion">
            <h4>⚡ Acciones rápidas</h4>
            {stats.porTipo.VERDE > 0 && (
              <button 
                className="btn-accion-global"
                onClick={handleAceptarTodasVerdesGlobal}
              >
                ✨ Aceptar todas las VERDES
                <small>({stats.porTipo.VERDE} correcciones)</small>
              </button>
            )}
          </div>

          {/* Calificación global */}
          <div className="panel-seccion calificacion-global">
            <h4>🎯 Calificación Global</h4>
            <div className="calificacion-valor-global">
              {stats.calificacionGlobal.toFixed(1)}/10
            </div>
            <div className={`semaforo-global semaforo-${stats.calificacionGlobal >= 7 ? 'verde' : stats.calificacionGlobal >= 5 ? 'amarillo' : 'rojo'}`}>
              {stats.calificacionGlobal >= 7 ? '🟢 Aprobado' : 
               stats.calificacionGlobal >= 5 ? '🟡 Regular' : '🔴 Necesita revisión'}
            </div>
          </div>
        </div>
      </div>

      {/* Chat integrado */}
      {mostrarChat && (
        <div className="editor-chat">
          <div className="chat-header">
            <span>💬 Chat con EvaluAI</span>
            <button onClick={() => setMostrarChat(false)}>−</button>
          </div>
          <div className="chat-mensajes">
            {mensajesChat.length === 0 ? (
              <div className="chat-bienvenida">
                <p>🤖 Estoy aquí para ayudarte con la revisión.</p>
                <p>Puedes preguntarme sobre cualquier corrección o pedirme que explique algo del párrafo actual.</p>
              </div>
            ) : (
              mensajesChat.map(msg => (
                <div key={msg.id} className={`chat-mensaje ${msg.tipo}`}>
                  <span className="chat-autor">
                    {msg.tipo === 'usuario' ? '👤' : msg.tipo === 'ia' ? '🤖' : '🔔'}
                  </span>
                  <span className="chat-contenido">{msg.contenido}</span>
                </div>
              ))
            )}
            {procesando && (
              <div className="chat-procesando">
                <span className="puntos">...</span> EvaluAI está escribiendo
              </div>
            )}
          </div>
          <div className="chat-input">
            <input
              type="text"
              value={inputChat}
              onChange={(e) => setInputChat(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleEnviarChat()}
              placeholder="Escribe tu pregunta..."
              disabled={procesando}
            />
            <button onClick={handleEnviarChat} disabled={procesando}>
              ➤
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default EditorNotasPie;
