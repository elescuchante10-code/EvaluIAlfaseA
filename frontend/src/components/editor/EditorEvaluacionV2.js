import React, { useState, useMemo } from 'react';
import './editor-v2.css';

/**
 * Editor de Evaluación V2 - Diseño de 3 paneles
 * 
 * Panel Izquierdo: Navegación (Rúbricas, Trabajos)
 * Panel Central: Documento con filtros por color
 * Panel Derecho: Estadísticas y gráficos
 * Abajo: Chat integrado
 */
function EditorEvaluacionV2({
  documento,
  rubrica,
  modoEdicion = 'manual', // 'manual' | 'automatico'
  onCambiarModo,
  onGuardar,
  onDescargar,
  onCancelar
}) {
  // Estados
  const [filtroColor, setFiltroColor] = useState('todos'); // 'todos' | 'rojo' | 'amarillo' | 'verde' | 'azul'
  const [comentariosProfesor, setComentariosProfesor] = useState({});
  const [vistaPanelIzquierdo, setVistaPanelIzquierdo] = useState('trabajos'); // 'trabajos' | 'rubricas'
  const [trabajoSeleccionado, setTrabajoSeleccionado] = useState(null);
  const [mostrarChat, setMostrarChat] = useState(true);
  const [mensajeChat, setMensajeChat] = useState('');
  const [mensajesChat, setMensajesChat] = useState([
    { tipo: 'ia', texto: '¡Hola! He analizado el documento. ¿En qué puedo ayudarte con la evaluación?' }
  ]);

  // Datos de ejemplo para trabajos
  const trabajosPendientes = [
    { id: 1, nombre: 'Ensayo_Revolucion_JuanPerez.docx', estudiante: 'Juan Pérez', fecha: '10 Abr', estado: 'pendiente' },
    { id: 2, nombre: 'Analisis_Literario_MariaGarcia.pdf', estudiante: 'María García', fecha: '9 Abr', estado: 'pendiente' },
    { id: 3, nombre: 'Ensayo_Filosofia_CarlosLopez.docx', estudiante: 'Carlos López', fecha: '8 Abr', estado: 'procesando' },
  ];

  const trabajosCorregidos = [
    { id: 4, nombre: 'Ensayo_Historia_AnaMartinez.docx', estudiante: 'Ana Martínez', fecha: '7 Abr', estado: 'completado', nota: 8.5 },
    { id: 5, nombre: 'Analisis_Poema_LuisTorres.pdf', estudiante: 'Luis Torres', fecha: '6 Abr', estado: 'completado', nota: 7.2 },
  ];

  // Obtener todas las notas del documento
  const todasLasNotas = useMemo(() => {
    const notas = [];
    documento?.parrafos?.forEach((parrafo, pIndex) => {
      parrafo.notas_pie?.forEach(nota => {
        notas.push({
          ...nota,
          parrafoIndex: pIndex,
          parrafoId: parrafo.id
        });
      });
    });
    return notas;
  }, [documento]);

  // Estadísticas
  const estadisticas = useMemo(() => {
    const stats = {
      total: todasLasNotas.length,
      porTipo: { ROJO: 0, AMARILLO: 0, VERDE: 0, AZUL: 0 },
      aceptadas: 0,
      rechazadas: 0,
      pendientes: 0,
      promedio: 0
    };

    let sumaCalificaciones = 0;
    documento?.parrafos?.forEach(p => {
      sumaCalificaciones += p.calificacion || 0;
    });
    stats.promedio = documento?.parrafos?.length ? (sumaCalificaciones / documento.parrafos.length).toFixed(1) : 0;

    todasLasNotas.forEach(nota => {
      stats.porTipo[nota.tipo]++;
      if (nota.estado === 'aceptada') stats.aceptadas++;
      else if (nota.estado === 'rechazada') stats.rechazadas++;
      else stats.pendientes++;
    });

    return stats;
  }, [todasLasNotas, documento]);

  // Habilidades/problemáticas recurrentes (ejemplo)
  const problemasRecurrentes = [
    { nombre: 'Uso de referencias bibliográficas', frecuencia: 85, tipo: 'mejora' },
    { nombre: 'Estructura argumentativa', frecuencia: 72, tipo: 'fortaleza' },
    { nombre: 'Vocabulario académico', frecuencia: 68, tipo: 'mejora' },
    { nombre: 'Conectores lógicos', frecuencia: 45, tipo: 'mejora' },
  ];

  // Generar texto con notas insertadas
  const renderDocumentoConNotas = () => {
    return documento?.parrafos?.map((parrafo, pIndex) => {
      // Si hay filtro activo, resaltar solo las notas de ese color
      const notasDeParrafo = parrafo.notas_pie || [];
      
      // Ordenar notas por posición (de atrás hacia adelante para insertar)
      const notasOrdenadas = [...notasDeParrafo]
        .sort((a, b) => b.posicion_inicio - a.posicion_inicio);
      
      // Si hay filtro, aplicar estilos visuales
      const hayFiltroActivo = filtroColor !== 'todos';
      
      return (
        <div 
          key={parrafo.id} 
          className={`ev2-parrafo ev2-semaforo-${parrafo.semaforo?.toLowerCase()}`}
        >
          <div className="ev2-parrafo-header">
            <span className="ev2-parrafo-numero">Párrafo {parrafo.indice}</span>
            <span className="ev2-parrafo-tipo">{parrafo.tipo}</span>
            <span className={`ev2-parrafo-semaforo ev2-semaforo-${parrafo.semaforo?.toLowerCase()}`}>
              {parrafo.semaforo === 'VERDE' && '🟢'}
              {parrafo.semaforo === 'AMARILLO' && '🟡'}
              {parrafo.semaforo === 'NARANJA' && '🟠'}
              {parrafo.semaforo === 'ROJO' && '🔴'}
              {' '}{parrafo.calificacion}/10
            </span>
          </div>
          
          <div className="ev2-parrafo-texto">
            {renderTextoConMarcas(parrafo, notasOrdenadas, hayFiltroActivo)}
          </div>

          {/* Notas al pie del párrafo */}
          {notasDeParrafo.length > 0 && (
            <div className="ev2-notas-pie">
              {notasDeParrafo.map(nota => (
                <div 
                  key={nota.id}
                  className={`ev2-nota-pie ev2-nota-${nota.tipo.toLowerCase()} ${nota.estado}`}
                  style={{ 
                    display: hayFiltroActivo && nota.tipo.toLowerCase() !== filtroColor ? 'none' : 'flex' 
                  }}
                >
                  <span className="ev2-nota-numero">{nota.numero}</span>
                  <div className="ev2-nota-contenido">
                    <span className="ev2-nota-texto">
                      {nota.sugerencia_ia?.texto_original} → <strong>{nota.sugerencia_ia?.texto_sugerido}</strong>
                    </span>
                    {modoEdicion === 'manual' && (
                      <div className="ev2-nota-acciones">
                        <button 
                          className="ev2-btn-mini ev2-btn-aceptar"
                          onClick={() => handleAceptarNota(nota.id)}
                          title="Aceptar corrección"
                        >
                          ✓
                        </button>
                        <button 
                          className="ev2-btn-mini ev2-btn-rechazar"
                          onClick={() => handleRechazarNota(nota.id)}
                          title="Rechazar corrección"
                        >
                          ✗
                        </button>
                        <button 
                          className="ev2-btn-mini ev2-btn-comentar"
                          onClick={() => toggleComentario(nota.id)}
                          title="Agregar comentario"
                        >
                          💬
                        </button>
                      </div>
                    )}
                  </div>
                  {comentariosProfesor[nota.id] && (
                    <div className="ev2-comentario-profesor">
                      <textarea
                        value={comentariosProfesor[nota.id] || ''}
                        onChange={(e) => setComentariosProfesor({
                          ...comentariosProfesor,
                          [nota.id]: e.target.value
                        })}
                        placeholder="Tu comentario..."
                        rows={2}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      );
    });
  };

  const renderTextoConMarcas = (parrafo, notas, hayFiltro) => {
    // Crear segmentos de texto con marcas
    const segmentos = [];
    let lastIndex = 0;
    
    // Ordenar notas de izquierda a derecha para renderizado
    const notasOrdenadas = [...(parrafo.notas_pie || [])]
      .sort((a, b) => a.posicion_inicio - b.posicion_inicio);

    notasOrdenadas.forEach((nota, index) => {
      // Texto antes de la nota
      if (nota.posicion_inicio > lastIndex) {
        segmentos.push(
          <span key={`text-${index}`}>
            {parrafo.texto_original.substring(lastIndex, nota.posicion_inicio)}
          </span>
        );
      }

      // Texto marcado
      const estaFiltrada = hayFiltro && nota.tipo.toLowerCase() === filtroColor;
      const estaActiva = !hayFiltro || estaFiltrada;
      
      segmentos.push(
        <span
          key={`nota-${nota.id}`}
          className={`ev2-marcado ev2-marcado-${nota.tipo.toLowerCase()} ${estaFiltrada ? 'ev2-marcado-activo' : ''} ${!estaActiva ? 'ev2-marcado-atenuado' : ''}`}
          onClick={() => handleClickNota(nota)}
          title={`${nota.tipo}: ${nota.sugerencia_ia?.explicacion}`}
        >
          {parrafo.texto_original.substring(nota.posicion_inicio, nota.posicion_fin)}
          <sup className="ev2-marcado-numero">{nota.numero}</sup>
        </span>
      );

      lastIndex = nota.posicion_fin;
    });

    // Texto restante
    if (lastIndex < parrafo.texto_original.length) {
      segmentos.push(
        <span key="text-final">
          {parrafo.texto_original.substring(lastIndex)}
        </span>
      );
    }

    return segmentos;
  };

  const handleClickNota = (nota) => {
    // Scroll a la nota al pie correspondiente
    const elemento = document.getElementById(`nota-pie-${nota.id}`);
    if (elemento) {
      elemento.scrollIntoView({ behavior: 'smooth', block: 'center' });
      elemento.classList.add('ev2-nota-resaltada');
      setTimeout(() => elemento.classList.remove('ev2-nota-resaltada'), 2000);
    }
  };

  const handleAceptarNota = (notaId) => {
    console.log('Aceptar nota:', notaId);
    // Aquí iría la lógica para aceptar
  };

  const handleRechazarNota = (notaId) => {
    console.log('Rechazar nota:', notaId);
    // Aquí iría la lógica para rechazar
  };

  const toggleComentario = (notaId) => {
    setComentariosProfesor(prev => ({
      ...prev,
      [notaId]: prev[notaId] ? '' : ' '
    }));
  };

  const enviarMensajeChat = () => {
    if (!mensajeChat.trim()) return;
    
    setMensajesChat([...mensajesChat, { tipo: 'usuario', texto: mensajeChat }]);
    setMensajeChat('');
    
    // Simular respuesta de IA
    setTimeout(() => {
      setMensajesChat(prev => [...prev, {
        tipo: 'ia',
        texto: 'He analizado esa sección. Según la rúbrica, el párrafo 2 tiene buena estructura pero podría mejorar las referencias. ¿Quieres que profundice en algo específico?'
      }]);
    }, 1000);
  };

  const aplicarTodasVerdes = () => {
    // Lógica para aceptar automáticamente todas las notas verdes
    alert('✓ Aplicando automáticamente todas las correcciones VERDES');
  };

  return (
    <div className="ev2-container">
      {/* HEADER */}
      <header className="ev2-header">
        <div className="ev2-header-left">
          <button className="ev2-btn-volver" onClick={onCancelar}>← Volver</button>
          <h1 className="ev2-titulo-documento">{documento?.titulo || 'Documento sin título'}</h1>
          <span className="ev2-modo-badge ev2-modo-{modoEdicion}">
            {modoEdicion === 'automatico' ? '🤖 Automático' : '✏️ Manual'}
          </span>
        </div>
        <div className="ev2-header-right">
          {modoEdicion === 'manual' && (
            <button className="ev2-btn-auto" onClick={aplicarTodasVerdes}>
              ✨ Aplicar VERDES automáticamente
            </button>
          )}
          <button className="ev2-btn-guardar" onClick={onGuardar}>💾 Guardar</button>
          <button className="ev2-btn-descargar" onClick={onDescargar}>📄 Descargar</button>
        </div>
      </header>

      {/* MAIN CONTENT - 3 PANELES */}
      <div className="ev2-main">
        {/* PANEL IZQUIERDO - NAVEGACIÓN */}
        <aside className="ev2-panel-izquierdo">
          <div className="ev2-tabs">
            <button 
              className={`ev2-tab ${vistaPanelIzquierdo === 'trabajos' ? 'activo' : ''}`}
              onClick={() => setVistaPanelIzquierdo('trabajos')}
            >
              📁 Trabajos
            </button>
            <button 
              className={`ev2-tab ${vistaPanelIzquierdo === 'rubricas' ? 'activo' : ''}`}
              onClick={() => setVistaPanelIzquierdo('rubricas')}
            >
              📋 Rúbricas
            </button>
          </div>

          <div className="ev2-panel-content">
            {vistaPanelIzquierdo === 'trabajos' ? (
              <>
                <div className="ev2-seccion-trabajos">
                  <h4 className="ev2-seccion-titulo">⏳ Pendientes ({trabajosPendientes.length})</h4>
                  {trabajosPendientes.map(trabajo => (
                    <div 
                      key={trabajo.id} 
                      className={`ev2-trabajo-item ${trabajoSeleccionado?.id === trabajo.id ? 'seleccionado' : ''}`}
                      onClick={() => setTrabajoSeleccionado(trabajo)}
                    >
                      <span className="ev2-trabajo-nombre">{trabajo.nombre}</span>
                      <span className="ev2-trabajo-meta">{trabajo.estudiante} • {trabajo.fecha}</span>
                      {trabajo.estado === 'procesando' && (
                        <span className="ev2-trabajo-estado procesando">🔄 Procesando...</span>
                      )}
                    </div>
                  ))}
                </div>

                <div className="ev2-seccion-trabajos">
                  <h4 className="ev2-seccion-titulo">✓ Corregidos ({trabajosCorregidos.length})</h4>
                  {trabajosCorregidos.map(trabajo => (
                    <div 
                      key={trabajo.id} 
                      className="ev2-trabajo-item completado"
                      onClick={() => setTrabajoSeleccionado(trabajo)}
                    >
                      <span className="ev2-trabajo-nombre">{trabajo.nombre}</span>
                      <span className="ev2-trabajo-meta">
                        {trabajo.estudiante} • Nota: {trabajo.nota}/10
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="ev2-rubrica-activa">
                <h4 className="ev2-seccion-titulo">Rúbrica Activa</h4>
                <div className="ev2-rubrica-card">
                  <strong>{rubrica?.titulo}</strong>
                  <p>{rubrica?.infoGeneral?.asignatura}</p>
                  <div className="ev2-rubrica-criterios">
                    {rubrica?.criterios?.map((c, i) => (
                      <div key={i} className="ev2-criterio-mini">
                        <span>{c.nombre}</span>
                        <span>{c.peso}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* PANEL CENTRAL - DOCUMENTO */}
        <main className="ev2-panel-central">
          {/* Botones de filtro por color */}
          <div className="ev2-filtros-colores">
            <button 
              className={`ev2-filtro-btn ${filtroColor === 'todos' ? 'activo' : ''}`}
              onClick={() => setFiltroColor('todos')}
            >
              <span className="ev2-filtro-todos">Todos</span>
              <span className="ev2-filtro-contador">{estadisticas.total}</span>
            </button>
            <button 
              className={`ev2-filtro-btn ev2-filtro-rojo ${filtroColor === 'rojo' ? 'activo' : ''}`}
              onClick={() => setFiltroColor('rojo')}
            >
              <span className="ev2-filtro-dot" style={{background: '#ef4444'}}></span>
              🔴 Errores
              <span className="ev2-filtro-contador">{estadisticas.porTipo.ROJO}</span>
            </button>
            <button 
              className={`ev2-filtro-btn ev2-filtro-amarillo ${filtroColor === 'amarillo' ? 'activo' : ''}`}
              onClick={() => setFiltroColor('amarillo')}
            >
              <span className="ev2-filtro-dot" style={{background: '#fbbf24'}}></span>
              🟡 Observaciones
              <span className="ev2-filtro-contador">{estadisticas.porTipo.AMARILLO}</span>
            </button>
            <button 
              className={`ev2-filtro-btn ev2-filtro-verde ${filtroColor === 'verde' ? 'activo' : ''}`}
              onClick={() => setFiltroColor('verde')}
            >
              <span className="ev2-filtro-dot" style={{background: '#22c55e'}}></span>
              🟢 Mejoras
              <span className="ev2-filtro-contador">{estadisticas.porTipo.VERDE}</span>
            </button>
            <button 
              className={`ev2-filtro-btn ev2-filtro-azul ${filtroColor === 'azul' ? 'activo' : ''}`}
              onClick={() => setFiltroColor('azul')}
            >
              <span className="ev2-filtro-dot" style={{background: '#3b82f6'}}></span>
              🔵 Referencias
              <span className="ev2-filtro-contador">{estadisticas.porTipo.AZUL}</span>
            </button>
          </div>

          {/* Documento */}
          <div className="ev2-documento">
            {renderDocumentoConNotas()}
          </div>
        </main>

        {/* PANEL DERECHO - ESTADÍSTICAS */}
        <aside className="ev2-panel-derecho">
          <div className="ev2-stats-header">
            <h3>📊 Estadísticas</h3>
            <div className="ev2-nota-global">
              <span className="ev2-nota-valor">{estadisticas.promedio}</span>
              <span className="ev2-nota-max">/10</span>
            </div>
          </div>

          <div className="ev2-stats-seccion">
            <h4>Correcciones</h4>
            <div className="ev2-stats-barras">
              <div className="ev2-barra-item">
                <span className="ev2-barra-label">✓ Aceptadas</span>
                <div className="ev2-barra">
                  <div className="ev2-barra-fill" style={{width: `${(estadisticas.aceptadas/estadisticas.total)*100}%`, background: '#22c55e'}}></div>
                </div>
                <span className="ev2-barra-valor">{estadisticas.aceptadas}</span>
              </div>
              <div className="ev2-barra-item">
                <span className="ev2-barra-label">✗ Rechazadas</span>
                <div className="ev2-barra">
                  <div className="ev2-barra-fill" style={{width: `${(estadisticas.rechazadas/estadisticas.total)*100}%`, background: '#ef4444'}}></div>
                </div>
                <span className="ev2-barra-valor">{estadisticas.rechazadas}</span>
              </div>
              <div className="ev2-barra-item">
                <span className="ev2-barra-label">⏳ Pendientes</span>
                <div className="ev2-barra">
                  <div className="ev2-barra-fill" style={{width: `${(estadisticas.pendientes/estadisticas.total)*100}%`, background: '#fbbf24'}}></div>
                </div>
                <span className="ev2-barra-valor">{estadisticas.pendientes}</span>
              </div>
            </div>
          </div>

          <div className="ev2-stats-seccion">
            <h4>🎯 Habilidades / Problemáticas</h4>
            <div className="ev2-habilidades">
              {problemasRecurrentes.map((item, index) => (
                <div key={index} className="ev2-habilidad-item">
                  <div className="ev2-habilidad-header">
                    <span className="ev2-habilidad-nombre">{item.nombre}</span>
                    <span className={`ev2-habilidad-tipo ${item.tipo}`}>
                      {item.tipo === 'fortaleza' ? '💪' : '⚠️'}
                    </span>
                  </div>
                  <div className="ev2-habilidad-barra">
                    <div 
                      className="ev2-habilidad-fill" 
                      style={{width: `${item.frecuencia}%`}}
                    ></div>
                  </div>
                  <span className="ev2-habilidad-porcentaje">{item.frecuencia}%</span>
                </div>
              ))}
            </div>
          </div>

          <div className="ev2-stats-seccion">
            <h4>📈 Por Criterio</h4>
            {rubrica?.criterios?.map((criterio, index) => (
              <div key={index} className="ev2-criterio-stat">
                <span>{criterio.nombre}</span>
                <div className="ev2-criterio-barra">
                  <div className="ev2-criterio-fill" style={{width: `${Math.random() * 40 + 60}%`}}></div>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>

      {/* CHAT ABAJO */}
      {mostrarChat && (
        <div className="ev2-chat-container">
          <div className="ev2-chat-header">
            <span>💬 Asistente IA</span>
            <button onClick={() => setMostrarChat(false)}>−</button>
          </div>
          <div className="ev2-chat-mensajes">
            {mensajesChat.map((msg, index) => (
              <div key={index} className={`ev2-chat-mensaje ${msg.tipo}`}>
                <span className="ev2-chat-autor">
                  {msg.tipo === 'usuario' ? '👤' : '🤖'}
                </span>
                <p>{msg.texto}</p>
              </div>
            ))}
          </div>
          <div className="ev2-chat-input">
            <input
              type="text"
              value={mensajeChat}
              onChange={(e) => setMensajeChat(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && enviarMensajeChat()}
              placeholder="Pregunta sobre la evaluación..."
            />
            <button onClick={enviarMensajeChat}>➤</button>
          </div>
        </div>
      )}

      {/* BOTÓN MOSTRAR CHAT (cuando está oculto) */}
      {!mostrarChat && (
        <button 
          className="ev2-chat-toggle"
          onClick={() => setMostrarChat(true)}
        >
          💬 Abrir Chat
        </button>
      )}
    </div>
  );
}

export default EditorEvaluacionV2;
