import React from 'react';
import CreditsMeter from '../CreditsMeter.js';

/**
 * Barra superior del workspace: título contextual y acciones de shell
 * (sin tabs de sección; la sección vive en SidebarNav).
 */
export default function TopBar({
  title,
  subtitle,
  compact = false,
  creditsBalance = 0,
  showMobileNavButton = false,
  onOpenMobileNav,
  showOperationalToggle = false,
  operationalPanelOpen = true,
  onToggleOperationalPanel,
}) {
  return (
    <header
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: compact ? 'center' : 'flex-start',
        gap: 14,
        padding: compact ? '9px 16px 10px' : '12px 18px 14px',
        borderBottom: '1px solid rgba(148,163,184,0.14)',
        background: 'rgba(2,6,23,0.78)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <div style={{ display: 'flex', alignItems: compact ? 'center' : 'flex-start', gap: 12, minWidth: 0 }}>
        {showMobileNavButton && (
          <button
            type="button"
            onClick={onOpenMobileNav}
            style={{
              flexShrink: 0,
              width: 40,
              height: 36,
              borderRadius: 10,
              border: '1px solid rgba(148,163,184,0.28)',
              background: 'rgba(15,23,42,0.72)',
              color: '#e2e8f0',
              cursor: 'pointer',
              fontSize: 18,
            }}
            aria-label="Abrir menú de navegación"
          >
            ☰
          </button>
        )}
        <div style={{ minWidth: 0 }}>
          <h1
            style={{
              margin: 0,
              color: '#f8fafc',
              fontSize: compact ? 17 : 18.5,
              fontWeight: 700,
              letterSpacing: '-0.01em',
              lineHeight: 1.2,
            }}
          >
            {title}
          </h1>
          {subtitle ? (
            <p
              style={{
                margin: compact ? '3px 0 0 0' : '6px 0 0 0',
                color: 'rgba(203,213,225,0.82)',
                fontSize: compact ? 12.5 : 13.5,
                lineHeight: 1.45,
                maxWidth: 'min(760px, 100%)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        <CreditsMeter creditsBalance={creditsBalance} />
        {showOperationalToggle && typeof onToggleOperationalPanel === 'function' && (
          <button
            type="button"
            onClick={onToggleOperationalPanel}
            style={{
              border: '1px solid rgba(148,163,184,0.32)',
              background: 'rgba(15,23,42,0.76)',
              color: '#e2e8f0',
              borderRadius: 9,
              padding: '8px 12px',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
            title={operationalPanelOpen ? 'Ocultar panel de flujo y rúbricas' : 'Mostrar panel de flujo y rúbricas'}
          >
            {operationalPanelOpen ? '◀ Ocultar acciones' : '▶ Mostrar acciones'}
          </button>
        )}
      </div>
    </header>
  );
}
