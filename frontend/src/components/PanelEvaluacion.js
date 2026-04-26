import React from 'react';

function PanelEvaluacion({ resultado, onDescargar, onAjustar, onNueva }) {
  if (!resultado) return null;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.titulo}>📊 Resultado de la Evaluación</h3>
        <span style={styles.fecha}>{new Date().toLocaleDateString()}</span>
      </div>

      {/* Calificación general */}
      <div style={styles.calificacionSection}>
        <div style={styles.calificacionPrincipal}>
          <span style={styles.numero}>{resultado.calificacion_global}</span>
          <span style={styles.de}>/10</span>
          <span style={styles.semaforo}>🟢</span>
        </div>
        <p style={styles.estado}>Excelente trabajo</p>
        <p style={styles.palabras}>{resultado.palabras.toLocaleString()} palabras evaluadas</p>
      </div>

      {/* Segmentos evaluados */}
      <div style={styles.segmentosSection}>
        <h4 style={styles.sectionTitle}>📋 Evaluación por Segmentos</h4>
        {resultado.segmentos.map((seg, idx) => (
          <div key={seg.id} style={styles.segmentoCard}>
            <div style={styles.segmentoHeader}>
              <span style={styles.segmentoNumero}>#{idx + 1}</span>
              <span style={styles.segmentoTipo}>{seg.tipo}</span>
              <span style={styles.segmentoCalif}>🟢 {seg.calificacion}</span>
            </div>
            <p style={styles.segmentoFeedback}>{seg.feedback}</p>
          </div>
        ))}
      </div>

      {/* Fortalezas */}
      <div style={styles.fortalezasSection}>
        <h4 style={styles.sectionTitle}>✅ Fortalezas</h4>
        <ul style={styles.lista}>
          {resultado.fortalezas.map((f, idx) => (
            <li key={idx} style={styles.itemPositivo}>{f}</li>
          ))}
        </ul>
      </div>

      {/* Áreas de mejora */}
      <div style={styles.mejorasSection}>
        <h4 style={styles.sectionTitle}>📌 Áreas de Mejora</h4>
        <ul style={styles.lista}>
          {resultado.mejoras.map((m, idx) => (
            <li key={idx} style={styles.itemMejora}>{m}</li>
          ))}
        </ul>
      </div>

      {/* Acciones */}
      <div style={styles.acciones}>
        <button onClick={onDescargar} style={styles.btnDescargar}>
          📥 Descargar Reporte PDF
        </button>
        <button onClick={onAjustar} style={styles.btnAjustar}>
          ✏️ Solicitar Ajustes
        </button>
        <button onClick={onNueva} style={styles.btnNueva}>
          🔄 Nueva Evaluación
        </button>
      </div>
    </div>
  );
}

const styles = {
  container: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '16px',
    padding: '24px',
    marginBottom: '20px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    paddingBottom: '16px',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
  },
  titulo: {
    color: '#fff',
    fontSize: '18px',
    fontWeight: '600',
    margin: 0,
  },
  fecha: {
    color: '#606070',
    fontSize: '13px',
  },
  calificacionSection: {
    textAlign: 'center',
    padding: '24px',
    background: 'rgba(34, 197, 94, 0.1)',
    borderRadius: '12px',
    marginBottom: '24px',
  },
  calificacionPrincipal: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: '8px',
  },
  numero: {
    fontSize: '56px',
    fontWeight: '800',
    color: '#22c55e',
  },
  de: {
    fontSize: '24px',
    color: '#86efac',
  },
  semaforo: {
    fontSize: '40px',
    marginLeft: '12px',
  },
  estado: {
    color: '#86efac',
    fontSize: '18px',
    fontWeight: '600',
    margin: '12px 0 4px 0',
  },
  palabras: {
    color: '#606070',
    fontSize: '14px',
    margin: 0,
  },
  segmentosSection: {
    marginBottom: '24px',
  },
  sectionTitle: {
    color: '#c0c0d0',
    fontSize: '14px',
    fontWeight: '600',
    marginBottom: '12px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  segmentoCard: {
    background: 'rgba(255,255,255,0.05)',
    borderRadius: '10px',
    padding: '14px',
    marginBottom: '10px',
  },
  segmentoHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '8px',
  },
  segmentoNumero: {
    color: '#606070',
    fontSize: '13px',
    fontWeight: '600',
  },
  segmentoTipo: {
    color: '#fff',
    fontSize: '14px',
    fontWeight: '600',
    flex: 1,
  },
  segmentoCalif: {
    color: '#22c55e',
    fontSize: '14px',
    fontWeight: '600',
  },
  segmentoFeedback: {
    color: '#a0a0b0',
    fontSize: '13px',
    margin: 0,
    fontStyle: 'italic',
    lineHeight: '1.5',
  },
  fortalezasSection: {
    marginBottom: '24px',
  },
  mejorasSection: {
    marginBottom: '24px',
  },
  lista: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
  },
  itemPositivo: {
    color: '#86efac',
    fontSize: '14px',
    padding: '8px 0',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    paddingLeft: '24px',
    position: 'relative',
    ':before': {
      content: '"✓"',
      position: 'absolute',
      left: 0,
    },
  },
  itemMejora: {
    color: '#fcd34d',
    fontSize: '14px',
    padding: '8px 0',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    paddingLeft: '24px',
    position: 'relative',
  },
  acciones: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  btnDescargar: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: '#fff',
    border: 'none',
    padding: '14px 20px',
    borderRadius: '10px',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  btnAjustar: {
    background: 'rgba(102, 126, 234, 0.15)',
    color: '#a5b4fc',
    border: '1px solid rgba(102, 126, 234, 0.3)',
    padding: '12px 20px',
    borderRadius: '10px',
    fontSize: '14px',
    cursor: 'pointer',
  },
  btnNueva: {
    background: 'rgba(255,255,255,0.05)',
    color: '#808090',
    border: '1px solid rgba(255,255,255,0.1)',
    padding: '12px 20px',
    borderRadius: '10px',
    fontSize: '14px',
    cursor: 'pointer',
  },
};

export default PanelEvaluacion;
