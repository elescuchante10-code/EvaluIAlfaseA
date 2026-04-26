import React, { useEffect, useState } from 'react';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const formatMb = (bytes) => {
  const n = Number(bytes || 0);
  const safe = Number.isFinite(n) ? Math.max(0, n) : 0;
  return (safe / (1024 * 1024)).toFixed(safe >= 100 * 1024 * 1024 ? 0 : 1);
};

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

  const [quota, setQuota] = useState({ status: 'idle', data: null });

  useEffect(() => {
    let cancel = false;
    const run = async () => {
      const token = localStorage.getItem('token') || '';
      if (!token) {
        setQuota({ status: 'idle', data: null });
        return;
      }
      setQuota((p) => ({ ...p, status: 'loading' }));
      try {
        const res = await fetch(`${API_URL}/api/storage/quota`, {
          method: 'GET',
          mode: 'cors',
          headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => null);
        if (cancel) return;
        if (!res.ok || !data) {
          setQuota({ status: 'error', data: null });
          return;
        }
        setQuota({ status: 'ready', data });
      } catch {
        if (cancel) return;
        setQuota({ status: 'error', data: null });
      }
    };
    run();

    const onQuotaChanged = () => run();
    if (typeof window !== 'undefined') {
      window.addEventListener('evaluai:storage-quota-changed', onQuotaChanged);
    }
    return () => {
      cancel = true;
      if (typeof window !== 'undefined') {
        window.removeEventListener('evaluai:storage-quota-changed', onQuotaChanged);
      }
    };
  }, [user?.id]);

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

          <div
            style={{
              marginTop: 12,
              padding: '12px 14px',
              borderRadius: 10,
              border: '1px solid rgba(148,163,184,0.18)',
              background: 'rgba(2,6,23,0.25)',
              color: 'rgba(226,232,240,0.92)',
              fontSize: 14,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ fontWeight: 800, color: '#e2e8f0' }}>Almacenamiento wiki</div>
              <div style={{ fontVariantNumeric: 'tabular-nums', color: 'rgba(203,213,225,0.9)' }}>
                {quota.status === 'ready' && quota.data
                  ? `${formatMb(quota.data.total_bytes_used)} MB / ${formatMb(quota.data.max_bytes)} MB`
                  : quota.status === 'loading'
                    ? 'Cargando…'
                    : 'No disponible'}
              </div>
            </div>
            {quota.status === 'ready' && quota.data ? (
              <div style={{ marginTop: 10, height: 8, borderRadius: 999, background: 'rgba(148,163,184,0.16)', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${Math.min(100, (Number(quota.data.total_bytes_used || 0) / Math.max(1, Number(quota.data.max_bytes || 1))) * 100)}%`,
                    background: 'linear-gradient(90deg, rgba(99,102,241,0.65), rgba(56,189,248,0.55))',
                  }}
                />
              </div>
            ) : null}
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
