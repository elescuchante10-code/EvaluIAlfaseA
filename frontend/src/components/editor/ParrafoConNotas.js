import React, { useState, useCallback } from 'react';
import './editor.css';

/**
 * Componente que muestra un párrafo con las marcas de notas al pie
 * Renderiza el texto con los superíndices [¹], [²], etc.
 */
function ParrafoConNotas({ 
  parrafo, 
  onNotaClick,
  onTextoSeleccionado,
  mostrarNotas = true,
  modoEdicion = true
}) {
  const [textoSeleccionando, setTextoSeleccionando] = useState(false);
  const [seleccion, setSeleccion] = useState(null);

  // Genera los segmentos del texto con las marcas de notas
  const generarSegmentos = useCallback(() => {
    if (!parrafo.notas_pie || parrafo.notas_pie.length === 0) {
      return [{ tipo: 'texto', contenido: parrafo.texto_original }];
    }

    // Filtrar notas rechazadas y ordenar por posición (de atrás hacia adelante)
    const notasActivas = parrafo.notas_pie
      .filter(n => n.estado !== 'rechazada')
      .sort((a, b) => b.posicion_inicio - a.posicion_inicio);

    const segmentos = [];
    let posicionActual = parrafo.texto_original.length;

    notasActivas.forEach(nota => {
      // Texto después de la nota
      if (posicionActual > nota.posicion_fin) {
        segmentos.unshift({
          tipo: 'texto',
          contenido: parrafo.texto_original.slice(nota.posicion_fin, posicionActual)
        });
      }

      // La marca de la nota
      segmentos.unshift({
        tipo: 'nota',
        numero: nota.numero,
        tipoNota: nota.tipo,
        notaId: nota.id,
        estado: nota.estado
      });

      // Texto antes de la nota
      posicionActual = nota.posicion_inicio;
    });

    // Texto inicial
    if (posicionActual > 0) {
      segmentos.unshift({
        tipo: 'texto',
        contenido: parrafo.texto_original.slice(0, posicionActual)
      });
    }

    return segmentos;
  }, [parrafo]);

  // Obtiene la clase CSS para el semáforo
  const getSemaforoClass = (semaforo) => {
    switch (semaforo) {
      case 'VERDE': return 'semaforo-verde';
      case 'AMARILLO': return 'semaforo-amarillo';
      case 'NARANJA': return 'semaforo-naranja';
      case 'ROJO': return 'semaforo-rojo';
      default: return 'semaforo-gris';
    }
  };

  // Obtiene el icono del semáforo
  const getSemaforoIcono = (semaforo) => {
    switch (semaforo) {
      case 'VERDE': return '🟢';
      case 'AMARILLO': return '🟡';
      case 'NARANJA': return '🟠';
      case 'ROJO': return '🔴';
      default: return '⚪';
    }
  };

  // Obtiene la clase CSS para el tipo de nota
  const getNotaClass = (tipoNota, estado) => {
    const baseClass = 'nota-ref';
    const tipoClass = `nota-ref-${tipoNota.toLowerCase()}`;
    const estadoClass = estado === 'aceptada' ? 'nota-aceptada' : 
                       estado === 'modificada' ? 'nota-modificada' : '';
    return `${baseClass} ${tipoClass} ${estadoClass}`;
  };

  // Maneja la selección de texto para agregar nota manual
  const handleMouseUp = () => {
    if (!modoEdicion) return;
    
    const selection = window.getSelection();
    const texto = selection.toString().trim();
    
    if (texto.length > 0) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      
      setSeleccion({
        texto,
        posicion_inicio: range.startOffset, // Simplificado, en realidad necesitaría calcular
        posicion_fin: range.endOffset,
        rect
      });
      setTextoSeleccionando(true);
    }
  };

  // Agrega una nota manual al texto seleccionado
  const handleAgregarNotaManual = () => {
    if (seleccion && onTextoSeleccionado) {
      onTextoSeleccionado({
        parrafo_id: parrafo.id,
        texto_seleccionado: seleccion.texto,
        posicion_inicio: seleccion.posicion_inicio,
        posicion_fin: seleccion.posicion_fin
      });
    }
    setTextoSeleccionando(false);
    setSeleccion(null);
    window.getSelection().removeAllRanges();
  };

  // Cancela la selección
  const handleCancelarSeleccion = () => {
    setTextoSeleccionando(false);
    setSeleccion(null);
    window.getSelection().removeAllRanges();
  };

  const segmentos = generarSegmentos();

  return (
    <div className={`parrafo-con-notas ${getSemaforoClass(parrafo.semaforo)}`}>
      {/* Header del párrafo */}
      <div className="parrafo-header">
        <div className="parrafo-info">
          <span className="parrafo-numero">Párrafo {parrafo.indice}</span>
          {parrafo.tipo && (
            <span className="parrafo-tipo"> - {parrafo.tipo}</span>
          )}
        </div>
        <div className="parrafo-calificacion">
          <span className="semaforo-icono">{getSemaforoIcono(parrafo.semaforo)}</span>
          <span className="calificacion-valor">{parrafo.calificacion}/10</span>
        </div>
      </div>

      {/* Contenido del párrafo con marcas */}
      <div 
        className="parrafo-texto"
        onMouseUp={handleMouseUp}
      >
        {segmentos.map((segmento, index) => {
          if (segmento.tipo === 'nota') {
            return (
              <sup
                key={`nota-${segmento.notaId}-${index}`}
                className={getNotaClass(segmento.tipoNota, segmento.estado)}
                onClick={() => onNotaClick && onNotaClick(segmento.notaId)}
                title={`Nota ${segmento.numero}: ${segmento.tipoNota}`}
              >
                {segmento.numero}
              </sup>
            );
          } else {
            return (
              <span key={`texto-${index}`}>
                {segmento.contenido}
              </span>
            );
          }
        })}
      </div>

      {/* Tooltip para agregar nota manual */}
      {textoSeleccionando && seleccion && (
        <div 
          className="tooltip-seleccion"
          style={{
            position: 'absolute',
            left: seleccion.rect.left,
            top: seleccion.rect.bottom + 5
          }}
        >
          <div className="tooltip-contenido">
            <p>¿Agregar nota a "{seleccion.texto.substring(0, 30)}..."?</p>
            <div className="tooltip-botones">
              <button onClick={handleAgregarNotaManual} className="btn-aceptar">
                ➕ Agregar nota
              </button>
              <button onClick={handleCancelarSeleccion} className="btn-cancelar">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notas al pie del párrafo */}
      {mostrarNotas && parrafo.notas_pie && parrafo.notas_pie.length > 0 && (
        <div className="notas-pie-container">
          <div className="notas-pie-separador">
            <span>Notas al pie de este párrafo ({parrafo.notas_pie.length})</span>
          </div>
          <div className="notas-pie-lista">
            {parrafo.notas_pie.map(nota => (
              <div 
                key={nota.id}
                id={`nota-pie-${nota.id}`}
                className={`nota-pie-item nota-${nota.tipo.toLowerCase()} estado-${nota.estado}`}
              >
                <sup className="nota-pie-numero">{nota.numero}</sup>
                <span className="nota-pie-texto">
                  {nota.tipo === 'VERDE' && '✓ '}
                  {nota.tipo === 'ROJO' && '✗ '}
                  {nota.tipo === 'AZUL' && 'ℹ️ '}
                  {nota.tipo === 'NARANJA' && '⚠️ '}
                  {nota.sugerencia_ia?.texto_sugerido || nota.texto_sugerido || 'Corrección'}
                  {nota.estado === 'aceptada' && <span className="badge-estado">(Aplicada)</span>}
                  {nota.estado === 'rechazada' && <span className="badge-estado rechazada">(Rechazada)</span>}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Acciones del párrafo */}
      <div className="parrafo-acciones">
        <button className="btn-agregar-nota" onClick={() => {}}>
          ➕ Agregar nota manual
        </button>
        {parrafo.notas_pie && parrafo.notas_pie.filter(n => n.estado === 'pendiente' && n.tipo === 'VERDE').length > 0 && (
          <button className="btn-aceptar-verdes">
            ✓ Aceptar todas las verdes ({parrafo.notas_pie.filter(n => n.estado === 'pendiente' && n.tipo === 'VERDE').length})
          </button>
        )}
      </div>
    </div>
  );
}

export default ParrafoConNotas;
