/**
 * ARCHIVO DE EJEMPLO: Integración de nuevos componentes en App.js
 * 
 * Este archivo muestra cómo integrar los nuevos componentes:
 * - PanelRubricas (panel izquierdo)
 * - EditorNotasPie (editor de correcciones)
 * - EditorMarkdown (editor de rúbricas)
 * 
 * Copiar las secciones marcadas a App.js
 */

// ============================================
// 1. IMPORTS ADICIONALES (Agregar al inicio de App.js)
// ============================================

import { EditorNotasPie } from './components/editor';
import { PanelRubricas, EditorMarkdown } from './components/rubricas';
import { parseRubricaMarkdown, generateRubricaMarkdown } from './utils/rubricaParser';

// ============================================
// 2. ESTADOS ADICIONALES (Agregar en el componente App)
// ============================================

const App = () => {
  // ... estados existentes ...
  
  // NUEVOS ESTADOS PARA RÚBRICAS
  const [rubricas, setRubricas] = useState([]);
  const [rubricaActiva, setRubricaActiva] = useState(null);
  const [mostrarEditorRubrica, setMostrarEditorRubrica] = useState(false);
  const [rubricaEditando, setRubricaEditando] = useState(null);
  
  // NUEVOS ESTADOS PARA EDITOR DE NOTAS
  const [mostrarEditorNotas, setMostrarEditorNotas] = useState(false);
  const [documentoEnRevision, setDocumentoEnRevision] = useState(null);
  
  // VISTAS DEL PANEL
  const [vistaPanel, setVistaPanel] = useState('chat'); // 'chat' | 'rubricas'

  // ============================================
  // 3. FUNCIONES PARA GESTIÓN DE RÚBRICAS
  // ============================================

  // Cargar rúbricas guardadas (localStorage por ahora)
  const cargarRubricas = () => {
    const guardadas = localStorage.getItem('rubricas');
    if (guardadas) {
      try {
        const parsed = JSON.parse(guardadas);
        setRubricas(parsed.map(r => parseRubricaMarkdown(r.markdownOriginal)));
      } catch (e) {
        console.error('Error cargando rúbricas:', e);
      }
    }
  };

  // Guardar rúbrica
  const guardarRubrica = (rubrica) => {
    const nuevasRubricas = [...rubricas];
    const index = nuevasRubricas.findIndex(r => r.id === rubrica.id);
    
    if (index >= 0) {
      nuevasRubricas[index] = rubrica;
    } else {
      nuevasRubricas.push(rubrica);
    }
    
    setRubricas(nuevasRubricas);
    localStorage.setItem('rubricas', JSON.stringify(nuevasRubricas.map(r => ({
      id: r.id,
      markdownOriginal: r.markdownOriginal
    }))));
  };

  // Eliminar rúbrica
  const eliminarRubrica = (id) => {
    const nuevasRubricas = rubricas.filter(r => r.id !== id);
    setRubricas(nuevasRubricas);
    localStorage.setItem('rubricas', JSON.stringify(nuevasRubricas.map(r => ({
      id: r.id,
      markdownOriginal: r.markdownOriginal
    }))));
  };

  // ============================================
  // 4. RENDER DEL PANEL IZQUIERDO (Modificar renderDashboard)
  // ============================================

  const renderPanelIzquierdo = () => (
    <div style={styles.dashboard.sidebar}>
      {/* Header del panel */}
      <div style={styles.dashboard.sidebarHeader}>
        <div style={styles.dashboard.navTabs}>
          <button 
            style={{
              ...styles.dashboard.navTab,
              ...(vistaPanel === 'chat' ? styles.dashboard.navTabActive : {})
            }}
            onClick={() => setVistaPanel('chat')}
          >
            💬 Chat
          </button>
          <button 
            style={{
              ...styles.dashboard.navTab,
              ...(vistaPanel === 'rubricas' ? styles.dashboard.navTabActive : {})
            }}
            onClick={() => setVistaPanel('rubricas')}
          >
            📋 Rúbricas
          </button>
        </div>
      </div>

      {/* Contenido del panel según vista */}
      <div style={styles.dashboard.sidebarContent}>
        {vistaPanel === 'rubricas' ? (
          <PanelRubricas
            rubricas={rubricas}
            rubricaActiva={rubricaActiva}
            onSeleccionarRubrica={(rubrica) => {
              setRubricaActiva(rubrica);
              setVistaPanel('chat');
            }}
            onCrearRubrica={() => {
              setRubricaEditando(null);
              setMostrarEditorRubrica(true);
            }}
            onEditarRubrica={(rubrica) => {
              setRubricaEditando(rubrica);
              setMostrarEditorRubrica(true);
            }}
            onEliminarRubrica={eliminarRubrica}
            onImportarRubrica={() => {
              // Abrir modal para importar desde imagen/doc
              alert('Función de importación desde imagen/documento');
            }}
          />
        ) : (
          /* Panel de chat/historial existente */
          <div>
            {/* Aquí iría el contenido actual del sidebar */}
            <div style={styles.dashboard.sidebarSection}>
              <h4 style={styles.dashboard.sidebarTitle}>Acciones rápidas</h4>
              <button 
                style={styles.dashboard.sidebarButton}
                onClick={() => setMostrarEditorNotas(true)}
              >
                📄 Nueva Evaluación
              </button>
            </div>
            
            {/* Info de rúbrica activa */}
            {rubricaActiva && (
              <div style={styles.dashboard.sidebarSection}>
                <h4 style={styles.dashboard.sidebarTitle}>Rúbrica Activa</h4>
                <div style={{
                  padding: '0.75rem',
                  background: 'rgba(255,255,255,0.1)',
                  borderRadius: '6px',
                  fontSize: '0.875rem'
                }}>
                  <strong>{rubricaActiva.titulo}</strong>
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', opacity: 0.8 }}>
                    {rubricaActiva.infoGeneral?.asignatura}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer del panel */}
      <div style={styles.dashboard.sidebarFooter}>
        {user && (
          <div style={styles.dashboard.userInfo}>
            <span>👤 {user.full_name || user.email}</span>
            <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>
              {user.words_available - user.words_used} palabras
            </span>
          </div>
        )}
      </div>
    </div>
  );

  // ============================================
  // 5. RENDER DEL EDITOR DE NOTAS (Modal/Overlay)
  // ============================================

  const renderEditorNotas = () => {
    if (!mostrarEditorNotas) return null;

    // Datos de ejemplo para el editor
    const documentoEjemplo = {
      titulo: 'Ensayo sobre la Revolución Francesa',
      parrafos: [
        {
          id: 'p-1',
          indice: 1,
          tipo: 'Introducción',
          texto_original: 'La Revolución Francesa fue un período de gran cambio social que tuvo lugar en Francia durante el siglo XVIII. Este evento histórico marcó el inicio de una nueva era para Europa.',
          calificacion: 7.5,
          semaforo: 'AMARILLO',
          notas_pie: [
            {
              id: 'nota-1',
              numero: 1,
              tipo: 'VERDE',
              posicion_inicio: 55,
              posicion_fin: 60,
              texto_seleccionado: 'cambio',
              sugerencia_ia: {
                texto_original: 'cambio',
                texto_sugerido: 'transformación social radical',
                explicacion: 'Término más académico y preciso para describir la magnitud del evento'
              },
              estado: 'pendiente'
            },
            {
              id: 'nota-2',
              numero: 2,
              tipo: 'AZUL',
              posicion_inicio: 12,
              posicion_fin: 32,
              texto_seleccionado: 'Revolución Francesa',
              sugerencia_ia: {
                texto_original: 'Revolución Francesa',
                texto_sugerido: 'Revolución Francesa (1789-1799)',
                explicacion: 'Añadir fechas para precisión histórica'
              },
              estado: 'pendiente'
            },
            {
              id: 'nota-3',
              numero: 3,
              tipo: 'ROJO',
              posicion_inicio: 81,
              posicion_fin: 92,
              texto_seleccionado: 'tuvo lugar',
              sugerencia_ia: {
                texto_original: 'tuvo lugar',
                texto_sugerido: 'se produjo',
                explicacion: 'Verbo más formal para contexto académico'
              },
              estado: 'pendiente'
            }
          ]
        },
        {
          id: 'p-2',
          indice: 2,
          tipo: 'Desarrollo',
          texto_original: 'Las causas de la revolución fueron múltiples. Entre ellas se destacan la crisis económica, la desigualdad social y las ideas ilustradas que circulaban por Europa.',
          calificacion: 8.5,
          semaforo: 'VERDE',
          notas_pie: [
            {
              id: 'nota-4',
              numero: 1,
              tipo: 'VERDE',
              posicion_inicio: 0,
              posicion_fin: 44,
              texto_seleccionado: 'Las causas de la revolución fueron múltiples',
              sugerencia_ia: {
                texto_original: 'Las causas de la revolución fueron múltiples',
                texto_sugerido: 'Las causas de la Revolución Francesa fueron multifactoriales',
                explicacion: 'Vocabulario más académico: multifactoriales en lugar de múltiples'
              },
              estado: 'aceptada'
            }
          ]
        }
      ]
    };

    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.5)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{
          width: '95vw',
          height: '95vh',
          background: '#f3f4f6',
          borderRadius: '12px',
          overflow: 'hidden',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
        }}>
          <EditorNotasPie
            evaluacionId="eval-ejemplo-001"
            documento={documentoEjemplo}
            rubrica={rubricaActiva || {
              titulo: 'Rúbrica Genérica',
              criterios: [
                { nombre: 'Contenido', peso: 40 },
                { nombre: 'Estructura', peso: 30 },
                { nombre: 'Lenguaje', peso: 30 }
              ],
              semaforoConfig: {
                niveles: {
                  verde: { min: 8, max: 10 },
                  amarillo: { min: 6, max: 7.9 },
                  rojo: { min: 0, max: 5.9 }
                }
              }
            }}
            modo="revision"
            onGuardarBorrador={() => {
              alert('Borrador guardado');
            }}
            onGenerarFinal={() => {
              alert('Generando informe final...');
            }}
            onCancelar={() => setMostrarEditorNotas(false)}
          />
        </div>
      </div>
    );
  };

  // ============================================
  // 6. RENDER DEL EDITOR DE RÚBRICA (Modal)
  // ============================================

  const renderEditorRubrica = () => {
    if (!mostrarEditorRubrica) return null;

    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.5)',
        zIndex: 1001,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{
          width: '90vw',
          height: '90vh',
          background: 'white',
          borderRadius: '12px',
          overflow: 'hidden',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
        }}>
          <EditorMarkdown
            rubrica={rubricaEditando}
            onGuardar={(rubrica) => {
              guardarRubrica(rubrica);
              setMostrarEditorRubrica(false);
            }}
            onCancelar={() => setMostrarEditorRubrica(false)}
          />
        </div>
      </div>
    );
  };

  // ============================================
  // 7. MODIFICAR renderDashboard
  // ============================================

  const renderDashboard = () => (
    <div style={styles.dashboard.container}>
      {/* Panel izquierdo */}
      {renderPanelIzquierdo()}

      {/* Panel central */}
      <div style={styles.dashboard.main}>
        <ChatPrincipal
          user={user}
          asignaturas={asignaturas}
          evaluacionActiva={evaluacionActiva}
          procesoEvaluacion={procesoEvaluacion}
          resultadoEvaluacion={resultadoEvaluacion}
          onSubirDocumento={handleSubirDocumento}
          onLogout={handleLogout}
          onEvaluarOtro={handleEvaluarOtro}
        />
      </div>

      {/* Panel derecho */}
      <div style={styles.dashboard.rightPanel}>
        {/* Panel derecho existente */}
      </div>

      {/* Modales */}
      {renderEditorNotas()}
      {renderEditorRubrica()}
    </div>
  );

  // ============================================
  // 8. ESTILOS ADICIONALES (Agregar a styles)
  // ============================================

  const stylesAdicionales = {
    navTabs: {
      display: 'flex',
      gap: '0.5rem',
      padding: '0.75rem',
      borderBottom: '1px solid rgba(255,255,255,0.1)'
    },
    navTab: {
      flex: 1,
      padding: '0.5rem',
      background: 'rgba(255,255,255,0.1)',
      border: 'none',
      borderRadius: '6px',
      color: 'rgba(255,255,255,0.7)',
      cursor: 'pointer',
      fontSize: '0.875rem'
    },
    navTabActive: {
      background: 'rgba(255,255,255,0.2)',
      color: 'white',
      fontWeight: 500
    },
    sidebarContent: {
      flex: 1,
      overflow: 'auto',
      padding: '0.75rem'
    },
    sidebarSection: {
      marginBottom: '1rem'
    },
    sidebarTitle: {
      fontSize: '0.75rem',
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      opacity: 0.6,
      marginBottom: '0.5rem'
    },
    sidebarButton: {
      width: '100%',
      padding: '0.75rem',
      background: 'rgba(255,255,255,0.1)',
      border: '1px solid rgba(255,255,255,0.2)',
      borderRadius: '6px',
      color: 'white',
      cursor: 'pointer',
      fontSize: '0.875rem',
      textAlign: 'left'
    }
  };

  // ... resto del componente App ...
};

export default App;
