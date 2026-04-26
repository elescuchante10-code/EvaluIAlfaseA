import React from 'react';

/**
 * Vista mínima de configuración (solo UI, sin endpoints nuevos).
 */
export default function SettingsView({
  user,
  teacherContextPack,
  onLogout,
  onOpenEvaluarFlujo,
  onOpenEvaluarRubricas,
  onOpenNewRubricEditor,
}) {
  const email = user?.email || '—';
  const displayName = user?.full_name || user?.name || '';

  const asignaturaActiva = teacherContextPack?.asignatura_activa || null;

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        overflow: 'auto',
        padding: '22px 22px 32px',
        background: 'linear-gradient(180deg, #0b1220 0%, #020617 100%)',
      }}
    >
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <h2 style={{ margin: '0 0 6px 0', color: '#f8fafc', fontSize: 22, fontWeight: 800 }}>Configuración</h2>
        <p style={{ margin: 0, color: 'rgba(203,213,225,0.82)', fontSize: 14, lineHeight: 1.55 }}>
          Ajustes de cuenta y accesos rápidos al workspace. No se crean preferencias en servidor en esta fase.
        </p>

        <section
          style={{
            marginTop: 22,
            padding: 18,
            borderRadius: 14,
            border: '1px solid rgba(148,163,184,0.18)',
            background: 'rgba(15,23,42,0.55)',
          }}
        >
          <h3 style={{ margin: '0 0 12px 0', color: '#e2e8f0', fontSize: 14, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Cuenta
          </h3>
          <div style={{ color: '#f1f5f9', fontSize: 15, fontWeight: 700, lineHeight: 1.4 }}>
            {displayName || 'Usuario'}
          </div>
          <div style={{ marginTop: 6, color: 'rgba(203,213,225,0.88)', fontSize: 14 }}>{email}</div>
          <button
            type="button"
            onClick={onLogout}
            style={{
              marginTop: 14,
              width: '100%',
              maxWidth: 320,
              padding: '11px 14px',
              borderRadius: 10,
              border: '1px solid rgba(248,113,113,0.45)',
              background: 'rgba(127,29,29,0.35)',
              color: '#fecaca',
              fontWeight: 700,
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            Cerrar sesión
          </button>
        </section>

        <section
          style={{
            marginTop: 16,
            padding: 18,
            borderRadius: 14,
            border: '1px solid rgba(148,163,184,0.18)',
            background: 'rgba(15,23,42,0.45)',
          }}
        >
          <h3 style={{ margin: '0 0 12px 0', color: '#e2e8f0', fontSize: 14, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Contexto docente (local)
          </h3>
          <p style={{ margin: 0, color: 'rgba(203,213,225,0.85)', fontSize: 14, lineHeight: 1.55 }}>
            El asistente contextual y las evaluaciones pueden usar el material indexado en{' '}
            <strong style={{ color: '#e2e8f0' }}>Mi Espacio IB</strong>. Aquí solo se muestra el estado leído del
            navegador.
          </p>
          <div
            style={{
              marginTop: 12,
              padding: '12px 14px',
              borderRadius: 10,
              border: '1px dashed rgba(148,163,184,0.28)',
              color: 'rgba(226,232,240,0.92)',
              fontSize: 14,
            }}
          >
            Asignatura activa en índice local:{' '}
            <strong style={{ color: '#dbeafe' }}>{asignaturaActiva || 'Sin seleccionar'}</strong>
          </div>
        </section>

        <section
          style={{
            marginTop: 16,
            padding: 18,
            borderRadius: 14,
            border: '1px solid rgba(148,163,184,0.18)',
            background: 'rgba(15,23,42,0.45)',
          }}
        >
          <h3 style={{ margin: '0 0 12px 0', color: '#e2e8f0', fontSize: 14, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Atajos al módulo Evaluar
          </h3>
          <p style={{ margin: '0 0 12px 0', color: 'rgba(203,213,225,0.85)', fontSize: 14, lineHeight: 1.55 }}>
            Accesos directos a las mismas herramientas del panel operativo, sin cambiar la lógica del evaluador.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 420 }}>
            <button
              type="button"
              onClick={onOpenEvaluarFlujo}
              style={{
                padding: '11px 14px',
                borderRadius: 10,
                border: '1px solid rgba(59,130,246,0.45)',
                background: 'rgba(37,99,235,0.22)',
                color: '#dbeafe',
                fontWeight: 700,
                cursor: 'pointer',
                fontSize: 14,
                textAlign: 'left',
              }}
            >
              Abrir panel · Flujo
            </button>
            <button
              type="button"
              onClick={onOpenEvaluarRubricas}
              style={{
                padding: '11px 14px',
                borderRadius: 10,
                border: '1px solid rgba(148,163,184,0.28)',
                background: 'rgba(15,23,42,0.65)',
                color: '#e2e8f0',
                fontWeight: 650,
                cursor: 'pointer',
                fontSize: 14,
                textAlign: 'left',
              }}
            >
              Abrir panel · Rúbricas
            </button>
            <button
              type="button"
              onClick={onOpenNewRubricEditor}
              style={{
                padding: '11px 14px',
                borderRadius: 10,
                border: '1px solid rgba(129,140,248,0.4)',
                background: 'rgba(76,29,149,0.22)',
                color: '#ede9fe',
                fontWeight: 650,
                cursor: 'pointer',
                fontSize: 14,
                textAlign: 'left',
              }}
            >
              Crear rúbrica en editor
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
