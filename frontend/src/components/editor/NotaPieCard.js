import React, { useState } from 'react';
import './editor.css';

/**
 * Componente individual para cada nota al pie
 * Muestra la corrección y permite aceptar/rechazar/editar
 */
function NotaPieCard({ nota, onAceptar, onRechazar, onEditar, onEliminar }) {
  const [mostrarExplicacion, setMostrarExplicacion] = useState(false);
  const [comentario, setComentario] = useState(nota.comentario_profesor || '');
  const [modoEdicion, setModoEdicion] = useState(false);
  const [sugerenciaEditada, setSugerenciaEditada] = useState(nota.sugerencia_ia?.texto_sugerido || '');

  const getColorClass = (tipo) => {
    switch (tipo) {
      case 'ROJO': return 'nota-rojo';
      case 'AZUL': return 'nota-azul';
      case 'VERDE': return 'nota-verde';
      case 'NARANJA': return 'nota-naranja';
      default: return 'nota-default';
    }
  };

  const getIcono = (tipo) => {
    switch (tipo) {
      case 'ROJO': return '🔴';
      case 'AZUL': return '🔵';
      case 'VERDE': return '🟢';
      case 'NARANJA': return '🟠';
      default: return '⚪';
    }
  };

  const getLabelTipo = (tipo) => {
    switch (tipo) {
      case 'ROJO': return 'Error Crítico';
      case 'AZUL': return 'Referencia';
      case 'VERDE': return 'Mejora Sugerida';
      case 'NARANJA': return 'Estructura';
      default: return 'Corrección';
    }
  };

  const getEstadoClass = (estado) => {
    switch (estado) {
      case 'aceptada': return 'estado-aceptada';
      case 'rechazada': return 'estado-rechazada';
      case 'modificada': return 'estado-modificada';
      default: return 'estado-pendiente';
    }
  };

  const getEstadoLabel = (estado) => {
    switch (estado) {
      case 'aceptada': return '✓ Aceptada';
      case 'rechazada': return '✗ Rechazada';
      case 'modificada': return '✎ Modificada';
      default: return '⏳ Pendiente';
    }
  };

  const handleAceptar = () => {
    onAceptar(nota.id, comentario);
  };

  const handleRechazar = () => {
    onRechazar(nota.id, comentario);
  };

  const handleGuardarEdicion = () => {
    onEditar(nota.id, {
      comentario_profesor: comentario,
      sugerencia_modificada: sugerenciaEditada,
      estado: 'modificada'
    });
    setModoEdicion(false);
  };

  return (
    <div className={`nota-pie-card ${getColorClass(nota.tipo)} ${getEstadoClass(nota.estado)}`}>
      {/* Header de la nota */}
      <div className="nota-header">
        <div className="nota-numero-tipo">
          <span className="nota-numero">{nota.numero}</span>
          <span className="nota-icono">{getIcono(nota.tipo)}</span>
          <span className="nota-tipo-label">{getLabelTipo(nota.tipo)}</span>
        </div>
        <div className="nota-estado">
          <span className={`estado-badge ${getEstadoClass(nota.estado)}`}>
            {getEstadoLabel(nota.estado)}
          </span>
        </div>
      </div>

      {/* Contenido de la corrección */}
      <div className="nota-contenido">
        {/* Ubicación en el texto */}
        <div className="nota-ubicacion">
          <span className="label">Ubicación:</span>
          <span className="texto-seleccionado">"{nota.texto_seleccionado || nota.sugerencia_ia?.texto_original}"</span>
        </div>

        {/* Sugerencia de la IA */}
        <div className="nota-sugerencia">
          <span className="label">Sugerencia de la IA:</span>
          
          {modoEdicion ? (
            <div className="edicion-sugerencia">
              <div className="campo-original">
                <label>Original:</label>
                <input 
                  type="text" 
                  value={nota.sugerencia_ia?.texto_original || ''} 
                  disabled 
                  className="input-original"
                />
              </div>
              <div className="campo-sugerido">
                <label>Tu versión:</label>
                <textarea
                  value={sugerenciaEditada}
                  onChange={(e) => setSugerenciaEditada(e.target.value)}
                  className="input-sugerido"
                  rows={2}
                />
              </div>
            </div>
          ) : (
            <div className="sugerencia-display">
              {nota.estado === 'modificada' && nota.sugerencia_modificada ? (
                <>
                  <div className="cambio-original">
                    <span className="arrow">→</span>
                    <span className="texto-nuevo">"{nota.sugerencia_modificada}"</span>
                    <span className="badge-modificado">(Modificado por ti)</span>
                  </div>
                  <div className="cambio-ia-original">
                    <small>Sugerencia IA original: "{nota.sugerencia_ia?.texto_sugerido}"</small>
                  </div>
                </>
              ) : nota.estado === 'aceptada' ? (
                <div className="cambio-aplicado">
                  <span className="arrow">→</span>
                  <span className="texto-nuevo">"{nota.sugerencia_ia?.texto_sugerido}"</span>
                </div>
              ) : (
                <div className="cambio-propuesto">
                  <span className="arrow">→</span>
                  <span className="texto-nuevo">"{nota.sugerencia_ia?.texto_sugerido}"</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Explicación de la IA */}
        {nota.sugerencia_ia?.explicacion && (
          <div className="nota-explicacion">
            <button 
              className="btn-toggle-explicacion"
              onClick={() => setMostrarExplicacion(!mostrarExplicacion)}
            >
              {mostrarExplicacion ? '▼' : '▶'} Explicación de la IA
            </button>
            {mostrarExplicacion && (
              <p className="explicacion-texto">{nota.sugerencia_ia.explicacion}</p>
            )}
          </div>
        )}

        {/* Comentario del profesor */}
        <div className="nota-comentario-profesor">
          <label>Comentario del profesor (opcional):</label>
          <textarea
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            placeholder="Agrega tu observación sobre esta corrección..."
            rows={2}
            disabled={nota.estado === 'rechazada'}
            className="textarea-comentario"
          />
        </div>

        {/* Botones de acción */}
        <div className="nota-acciones">
          {nota.estado === 'pendiente' && (
            <>
              {!modoEdicion ? (
                <>
                  <button 
                    className="btn-aceptar"
                    onClick={handleAceptar}
                    title="Aceptar sugerencia de la IA"
                  >
                    ✓ Aceptar
                  </button>
                  <button 
                    className="btn-modificar"
                    onClick={() => setModoEdicion(true)}
                    title="Modificar la sugerencia antes de aceptar"
                  >
                    ✎ Modificar
                  </button>
                  <button 
                    className="btn-rechazar"
                    onClick={handleRechazar}
                    title="Rechazar esta corrección"
                  >
                    ✗ Rechazar
                  </button>
                </>
              ) : (
                <>
                  <button 
                    className="btn-guardar"
                    onClick={handleGuardarEdicion}
                  >
                    💾 Guardar cambio
                  </button>
                  <button 
                    className="btn-cancelar"
                    onClick={() => {
                      setModoEdicion(false);
                      setSugerenciaEditada(nota.sugerencia_ia?.texto_sugerido || '');
                    }}
                  >
                    Cancelar
                  </button>
                </>
              )}
            </>
          )}

          {nota.estado === 'aceptada' && (
            <>
              <button 
                className="btn-editar"
                onClick={() => setModoEdicion(true)}
              >
                ✎ Editar nota
              </button>
              <button 
                className="btn-deshaacer"
                onClick={() => onRechazar(nota.id, comentario)}
              >
                ↩ Deshacer
              </button>
              {onEliminar && (
                <button 
                  className="btn-eliminar"
                  onClick={() => onEliminar(nota.id)}
                >
                  🗑️ Eliminar
                </button>
              )}
            </>
          )}

          {nota.estado === 'rechazada' && (
            <>
              <button 
                className="btn-cambiar-aceptar"
                onClick={handleAceptar}
              >
                ✓ Cambiar a aceptada
              </button>
              {onEliminar && (
                <button 
                  className="btn-eliminar"
                  onClick={() => onEliminar(nota.id)}
                >
                  🗑️ Eliminar nota
                </button>
              )}
            </>
          )}

          {nota.estado === 'modificada' && (
            <>
              <button 
                className="btn-editar"
                onClick={() => setModoEdicion(true)}
              >
                ✎ Editar de nuevo
              </button>
              <button 
                className="btn-rechazar"
                onClick={handleRechazar}
              >
                ✗ Rechazar
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default NotaPieCard;
