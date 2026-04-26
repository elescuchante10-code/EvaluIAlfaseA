import React, { useState, useEffect } from 'react';
import './rubricas.css';

/**
 * Panel de gestión de rúbricas en el panel izquierdo
 * Muestra lista de rúbricas Markdown y permite gestionarlas
 */
function PanelRubricas({ 
  rubricas, 
  rubricaActiva, 
  onSeleccionarRubrica, 
  onCrearRubrica,
  onEditarRubrica,
  onEliminarRubrica,
  onImportarRubrica
}) {
  const [vista, setVista] = useState('lista'); // 'lista' | 'detalle' | 'preview'
  const [rubricaSeleccionada, setRubricaSeleccionada] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [filtroAsignatura, setFiltroAsignatura] = useState('todas');

  // Filtrar rúbricas
  const rubricasFiltradas = rubricas.filter(rubrica => {
    const coincideBusqueda = rubrica.titulo?.toLowerCase().includes(busqueda.toLowerCase()) ||
                            rubrica.infoGeneral?.asignatura?.toLowerCase().includes(busqueda.toLowerCase());
    const coincideAsignatura = filtroAsignatura === 'todas' || 
                               rubrica.infoGeneral?.asignatura === filtroAsignatura;
    return coincideBusqueda && coincideAsignatura;
  });

  // Obtener lista única de asignaturas
  const asignaturas = [...new Set(rubricas.map(r => r.infoGeneral?.asignatura).filter(Boolean))];

  // Formatear fecha
  const formatearFecha = (fechaString) => {
    if (!fechaString) return 'Fecha desconocida';
    const fecha = new Date(fechaString);
    return fecha.toLocaleDateString('es-ES', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric' 
    });
  };

  // Renderizar vista de lista
  const renderLista = () => (
    <>
      {/* Header */}
      <div className="panel-rubricas-header">
        <h3>📋 Mis Rúbricas</h3>
        <button 
          className="btn-nueva-rubrica"
          onClick={onCrearRubrica}
        >
          ➕
        </button>
      </div>

      {/* Búsqueda y filtros */}
      <div className="panel-rubricas-filtros">
        <input
          type="text"
          placeholder="Buscar rúbrica..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="input-busqueda"
        />
        <select
          value={filtroAsignatura}
          onChange={(e) => setFiltroAsignatura(e.target.value)}
          className="select-filtro"
        >
          <option value="todas">Todas las asignaturas</option>
          {asignaturas.map(asig => (
            <option key={asig} value={asig}>{asig}</option>
          ))}
        </select>
      </div>

      {/* Acciones rápidas */}
      <div className="panel-rubricas-acciones">
        <button 
          className="btn-accion-secundaria"
          onClick={onImportarRubrica}
        >
          📥 Importar
        </button>
        <button className="btn-accion-secundaria">
          🌐 Biblioteca
        </button>
      </div>

      {/* Lista de rúbricas */}
      <div className="rubricas-lista">
        {(rubricasFiltradas?.length || 0) === 0 ? (
          <div className="rubricas-vacio">
            <p>No tienes rúbricas guardadas</p>
            <button onClick={onCrearRubrica}>
              Crear primera rúbrica
            </button>
          </div>
        ) : (
          rubricasFiltradas.map(rubrica => (
            <div 
              key={rubrica.id}
              className={`rubrica-card ${rubricaActiva?.id === rubrica.id ? 'activa' : ''}`}
              onClick={() => {
                setRubricaSeleccionada(rubrica);
                setVista('detalle');
              }}
            >
              <div className="rubrica-card-header">
                <span className="rubrica-icono">📄</span>
                <span className="rubrica-nombre">
                  {rubrica.titulo || 'Rúbrica sin título'}
                </span>
              </div>
              
              <div className="rubrica-meta">
                <span className="rubrica-asignatura">
                  {rubrica.infoGeneral?.asignatura || 'General'}
                </span>
                <span className="rubrica-nivel">
                  {rubrica.infoGeneral?.nivel || ''}
                </span>
              </div>

              <div className="rubrica-stats">
                <span>{rubrica.infoGeneral?.puntuacionMaxima || 10} pts</span>
                <span>•</span>
                <span>{rubrica.criterios?.length || 0} criterios</span>
                <span>•</span>
                <span>Usada {rubrica.usadaVeces || 0} veces</span>
              </div>

              <div className="rubrica-fecha">
                {formatearFecha(rubrica.fechaModificacion)}
              </div>

              {rubricaActiva?.id === rubrica.id && (
                <div className="rubrica-badge-activa">
                  ✓ ACTIVA
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </>
  );

  // Renderizar vista de detalle
  const renderDetalle = () => {
    if (!rubricaSeleccionada) return null;

    return (
      <div className="rubrica-detalle">
        {/* Header con navegación */}
        <div className="rubrica-detalle-header">
          <button 
            className="btn-volver"
            onClick={() => {
              setVista('lista');
              setRubricaSeleccionada(null);
            }}
          >
            ← Volver
          </button>
          <h3>{rubricaSeleccionada.titulo}</h3>
        </div>

        {/* Información general */}
        <div className="rubrica-info-section">
          <h4>Información General</h4>
          <div className="rubrica-info-grid">
            <div className="info-item">
              <span className="info-label">Asignatura:</span>
              <span className="info-valor">{rubricaSeleccionada.infoGeneral?.asignatura || 'No especificada'}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Nivel:</span>
              <span className="info-valor">{rubricaSeleccionada.infoGeneral?.nivel || 'No especificado'}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Tipo:</span>
              <span className="info-valor">{rubricaSeleccionada.infoGeneral?.tipoTrabajo || 'Ensayo'}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Puntuación máxima:</span>
              <span className="info-valor">{rubricaSeleccionada.infoGeneral?.puntuacionMaxima || 10} pts</span>
            </div>
          </div>
        </div>

        {/* Criterios */}
        {rubricaSeleccionada.criterios && rubricaSeleccionada.criterios.length > 0 && (
          <div className="rubrica-criterios-section">
            <h4>Criterios ({rubricaSeleccionada.criterios.length})</h4>
            <div className="rubrica-criterios-lista">
              {rubricaSeleccionada.criterios.map((criterio, index) => (
                <div key={index} className="criterio-item">
                  <div className="criterio-header">
                    <span className="criterio-nombre">{criterio.nombre}</span>
                    <span className="criterio-peso">{criterio.peso}%</span>
                  </div>
                  {criterio.descripcion && (
                    <p className="criterio-descripcion">{criterio.descripcion}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Niveles */}
        {rubricaSeleccionada.niveles && rubricaSeleccionada.niveles.length > 0 && (
          <div className="rubrica-niveles-section">
            <h4>Niveles de Desempeño</h4>
            <div className="rubrica-niveles-lista">
              {rubricaSeleccionada.niveles.map((nivel, index) => (
                <div key={index} className="nivel-item">
                  <div className="nivel-header">
                    <span className="nivel-rango">{nivel.min}-{nivel.max} pts</span>
                    <span className="nivel-label">{nivel.label}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Acciones */}
        <div className="rubrica-detalle-acciones">
          <button 
            className="btn-usar-rubrica"
            onClick={() => {
              onSeleccionarRubrica(rubricaSeleccionada);
              setVista('lista');
            }}
          >
            📋 Usar esta rúbrica
          </button>
          <button 
            className="btn-editar-rubrica"
            onClick={() => onEditarRubrica(rubricaSeleccionada)}
          >
            ✏️ Editar Markdown
          </button>
          <button 
            className="btn-eliminar-rubrica"
            onClick={() => {
              if (window.confirm('¿Eliminar esta rúbrica permanentemente?')) {
                onEliminarRubrica(rubricaSeleccionada.id);
                setVista('lista');
                setRubricaSeleccionada(null);
              }
            }}
          >
            🗑️ Eliminar
          </button>
        </div>

        {/* Archivo */}
        <div className="rubrica-archivo-info">
          <p><strong>Archivo:</strong> {rubricaSeleccionada.nombreArchivo}</p>
          <p><strong>Creada:</strong> {formatearFecha(rubricaSeleccionada.fechaCreacion)}</p>
          <p><strong>Modificada:</strong> {formatearFecha(rubricaSeleccionada.fechaModificacion)}</p>
          <p><strong>ID:</strong> <code>{rubricaSeleccionada.id}</code></p>
        </div>
      </div>
    );
  };

  return (
    <div className="panel-rubricas">
      {vista === 'lista' ? renderLista() : renderDetalle()}
    </div>
  );
}

export default PanelRubricas;
