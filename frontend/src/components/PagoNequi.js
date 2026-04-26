import React, { useState } from 'react';

// CONFIGURACION - Reemplazar con tus datos reales
const NEQUI_NUMERO = '3123456789'; // Tu numero de Nequi
const NEQUI_QR_URL = '/qr-nequi.png'; // Ruta a tu imagen QR

function PagoNequi({ email, onPagoCompleto, onVolver }) {
  const [comprobante, setComprobante] = useState('');
  const [verificando, setVerificando] = useState(false);
  const [paso, setPaso] = useState(1); // 1: Mostrar QR, 2: Verificar comprobante

  const handleVerificarPago = async () => {
    if (!comprobante || comprobante.length < 6) {
      alert('Por favor ingresa el numero de comprobante valido');
      return;
    }

    setVerificando(true);
    
    // Simulacion de verificacion (en produccion esto va al backend)
    setTimeout(() => {
      setVerificando(false);
      onPagoCompleto();
    }, 2000);
  };

  const copiarNumero = () => {
    navigator.clipboard.writeText(NEQUI_NUMERO);
    alert('Numero copiado: ' + NEQUI_NUMERO);
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <button onClick={onVolver} style={styles.backButton}>← Volver</button>
        
        <div style={styles.logo}>🎓 EvaluAPP</div>
        <h1 style={styles.title}>Suscribirse al Plan Profesor</h1>
        
        {paso === 1 ? (
          <>
            <div style={styles.resumen}>
              <div style={styles.resumenRow}>
                <span>Plan:</span>
                <span style={styles.resumenValue}>Profesor (1 mes)</span>
              </div>
              <div style={styles.resumenRow}>
                <span>Email:</span>
                <span style={styles.resumenValue}>{email}</span>
              </div>
              <div style={styles.resumenTotal}>
                <span>Total a pagar:</span>
                <span style={styles.totalAmount}>$30.000 COP</span>
              </div>
            </div>

            <div style={styles.pagoSection}>
              <h3 style={styles.pagoTitle}>💜 Paga con Nequi</h3>
              
              <div style={styles.qrContainer}>
                <p style={styles.qrLabel}>Escanea este QR:</p>
                <div style={styles.qrBox}>
                  <div style={styles.qrPlaceholder}>
                    <span style={styles.qrIcon}>📱</span>
                    <p style={styles.qrText}>QR NEQUI</p>
                    <p style={styles.qrSubtext}>{NEQUI_NUMERO}</p>
                  </div>
                </div>
              </div>

              <div style={styles.numeroContainer}>
                <p style={styles.numeroLabel}>O envia al numero:</p>
                <div style={styles.numeroBox}>
                  <span style={styles.numero}>{NEQUI_NUMERO}</span>
                  <button onClick={copiarNumero} style={styles.copiarBtn}>
                    📋 Copiar
                  </button>
                </div>
              </div>

              <div style={styles.instrucciones}>
                <p style={styles.instruccion}>1. Abre la app de Nequi</p>
                <p style={styles.instruccion}>2. Escanea el QR o busca el numero</p>
                <p style={styles.instruccion}>3. Envía exactamente <strong>$30.000 COP</strong></p>
                <p style={styles.instruccion}>4. Guarda el numero de comprobante</p>
              </div>

              <button 
                onClick={() => setPaso(2)}
                style={styles.continuarBtn}
              >
                Ya realice el pago →
              </button>
            </div>

            <div style={styles.otrosMetodos}>
              <p style={styles.otrosTitle}>¿No tienes Nequi?</p>
              <div style={styles.metodosGrid}>
                <button style={styles.metodoBtn}>🏦 Bancolombia</button>
                <button style={styles.metodoBtn}>💳 Tarjeta</button>
                <button style={styles.metodoBtn}>🏪 Efecty</button>
              </div>
            </div>
          </>
        ) : (
          <>
            <div style={styles.verificacionBox}>
              <div style={styles.checkIcon}>✓</div>
              <h3 style={styles.verificacionTitle}>Verificar pago</h3>
              <p style={styles.verificacionText}>
                Ingresa el numero de comprobante que te envio Nequi para activar tu cuenta automaticamente.
              </p>

              <div style={styles.inputGroup}>
                <label style={styles.inputLabel}>Numero de comprobante:</label>
                <input
                  type="text"
                  placeholder="Ej: 1234567890"
                  value={comprobante}
                  onChange={(e) => setComprobante(e.target.value)}
                  style={styles.input}
                />
                <p style={styles.inputHint}>
                  Lo encuentras en la notificacion de Nequi o en movimientos
                </p>
              </div>

              <button 
                onClick={handleVerificarPago}
                disabled={verificando}
                style={styles.verificarBtn}
              >
                {verificando ? '⏳ Verificando...' : '✅ Verificar y activar cuenta'}
              </button>

              <button 
                onClick={() => setPaso(1)}
                style={styles.volverPagoBtn}
              >
                ← Volver al pago
              </button>

              <p style={styles.notaVerificacion}>
                💡 Si no tienes el comprobante aun, puedes continuar y verificaremos manualmente en las proximas 24 horas.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#0f0f23',
    padding: '20px',
  },
  card: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '20px',
    padding: '40px',
    width: '100%',
    maxWidth: '440px',
    position: 'relative',
  },
  backButton: {
    position: 'absolute',
    top: '20px',
    left: '20px',
    background: 'none',
    border: 'none',
    color: '#808090',
    cursor: 'pointer',
    fontSize: '14px',
  },
  logo: {
    textAlign: 'center',
    fontSize: '36px',
    marginBottom: '8px',
  },
  title: {
    fontSize: '22px',
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    marginBottom: '24px',
  },
  resumen: {
    background: 'rgba(102, 126, 234, 0.1)',
    borderRadius: '12px',
    padding: '16px',
    marginBottom: '24px',
  },
  resumenRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '6px 0',
    color: '#a0a0b0',
    fontSize: '14px',
  },
  resumenValue: {
    color: '#fff',
    fontWeight: '500',
  },
  resumenTotal: {
    display: 'flex',
    justifyContent: 'space-between',
    paddingTop: '12px',
    marginTop: '8px',
    borderTop: '1px solid rgba(255,255,255,0.1)',
    color: '#fff',
    fontWeight: '600',
  },
  totalAmount: {
    color: '#22c55e',
    fontSize: '20px',
  },
  pagoSection: {
    marginBottom: '24px',
  },
  pagoTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#fff',
    marginBottom: '16px',
    textAlign: 'center',
  },
  qrContainer: {
    marginBottom: '20px',
  },
  qrLabel: {
    fontSize: '14px',
    color: '#a0a0b0',
    marginBottom: '8px',
    textAlign: 'center',
  },
  qrBox: {
    background: '#fff',
    borderRadius: '12px',
    padding: '20px',
    display: 'flex',
    justifyContent: 'center',
  },
  qrPlaceholder: {
    textAlign: 'center',
    padding: '20px',
  },
  qrIcon: {
    fontSize: '48px',
    display: 'block',
    marginBottom: '8px',
  },
  qrText: {
    color: '#1f2937',
    fontWeight: '700',
    margin: '0 0 4px 0',
  },
  qrSubtext: {
    color: '#6b7280',
    fontSize: '14px',
    margin: 0,
  },
  numeroContainer: {
    marginBottom: '20px',
  },
  numeroLabel: {
    fontSize: '14px',
    color: '#a0a0b0',
    marginBottom: '8px',
    textAlign: 'center',
  },
  numeroBox: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    background: 'rgba(255,255,255,0.05)',
    padding: '12px 20px',
    borderRadius: '10px',
  },
  numero: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#fff',
    letterSpacing: '1px',
  },
  copiarBtn: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    border: 'none',
    color: '#fff',
    padding: '8px 16px',
    borderRadius: '6px',
    fontSize: '13px',
    cursor: 'pointer',
  },
  instrucciones: {
    background: 'rgba(255,255,255,0.03)',
    borderRadius: '10px',
    padding: '16px',
    marginBottom: '20px',
  },
  instruccion: {
    fontSize: '13px',
    color: '#c0c0d0',
    margin: '6px 0',
    lineHeight: '1.5',
  },
  continuarBtn: {
    width: '100%',
    background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
    border: 'none',
    color: '#fff',
    padding: '16px',
    borderRadius: '10px',
    fontSize: '16px',
    fontWeight: '700',
    cursor: 'pointer',
  },
  otrosMetodos: {
    borderTop: '1px solid rgba(255,255,255,0.1)',
    paddingTop: '20px',
  },
  otrosTitle: {
    fontSize: '14px',
    color: '#808090',
    textAlign: 'center',
    marginBottom: '12px',
  },
  metodosGrid: {
    display: 'flex',
    gap: '10px',
    justifyContent: 'center',
  },
  metodoBtn: {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: '#c0c0d0',
    padding: '10px 16px',
    borderRadius: '8px',
    fontSize: '13px',
    cursor: 'pointer',
  },
  verificacionBox: {
    textAlign: 'center',
  },
  checkIcon: {
    width: '60px',
    height: '60px',
    background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 20px',
    fontSize: '28px',
    color: '#fff',
  },
  verificacionTitle: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#fff',
    marginBottom: '12px',
  },
  verificacionText: {
    fontSize: '14px',
    color: '#a0a0b0',
    marginBottom: '24px',
    lineHeight: '1.5',
  },
  inputGroup: {
    marginBottom: '20px',
    textAlign: 'left',
  },
  inputLabel: {
    display: 'block',
    fontSize: '14px',
    fontWeight: '600',
    color: '#fff',
    marginBottom: '8px',
  },
  input: {
    width: '100%',
    padding: '14px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: '10px',
    color: '#fff',
    fontSize: '16px',
    textAlign: 'center',
    letterSpacing: '2px',
    outline: 'none',
  },
  inputHint: {
    fontSize: '12px',
    color: '#606070',
    marginTop: '8px',
  },
  verificarBtn: {
    width: '100%',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    border: 'none',
    color: '#fff',
    padding: '16px',
    borderRadius: '10px',
    fontSize: '16px',
    fontWeight: '700',
    cursor: 'pointer',
    marginBottom: '12px',
  },
  volverPagoBtn: {
    background: 'transparent',
    border: 'none',
    color: '#808090',
    fontSize: '14px',
    cursor: 'pointer',
  },
  notaVerificacion: {
    fontSize: '12px',
    color: '#606070',
    marginTop: '20px',
    lineHeight: '1.4',
  },
};

export default PagoNequi;
