import React from 'react';

const formatCredits = (value) => {
  const n = Number(value || 0);
  const safe = Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0;
  try {
    return new Intl.NumberFormat('es-CO').format(safe);
  } catch {
    return String(safe);
  }
};

export default function CreditsMeter({ creditsBalance = 0 }) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '7px 10px',
        borderRadius: 999,
        border: '1px solid rgba(148,163,184,0.22)',
        background: 'rgba(15,23,42,0.72)',
        color: 'rgba(226,232,240,0.92)',
        fontSize: 13,
        fontWeight: 700,
        whiteSpace: 'nowrap',
      }}
      title="Saldo global de créditos"
      aria-label={`Créditos disponibles: ${formatCredits(creditsBalance)}`}
    >
      <span style={{ color: 'rgba(148,163,184,0.9)', fontWeight: 800 }}>
        Créditos disponibles:
      </span>
      <span style={{ fontVariantNumeric: 'tabular-nums', color: '#e0e7ff' }}>
        {formatCredits(creditsBalance)}
      </span>
    </div>
  );
}

