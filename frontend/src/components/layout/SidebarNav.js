import React from 'react';

/**
 * Navegación principal del shell SaaS (orden fijo).
 * Desktop: columna lateral. Mobile: drawer controlado por `drawerOpen` / `onCloseDrawer`.
 */
export default function SidebarNav({
  activeSection,
  onSelectSection,
  collapsed = false,
  onToggleCollapsed,
  layout = 'desktop',
  drawerOpen = false,
  onCloseDrawer,
  showAdmin = false,
}) {
  const isDrawer = layout === 'drawer';
  const navItems = [
    { id: 'espacio', label: 'Mi Espacio IB', icon: '📘' },
    { id: 'trabajo', label: 'Evaluar', icon: '📝' },
    { id: 'asistente', label: 'Asistente IA', icon: '🤖' },
    { id: 'configuracion', label: 'Configuración', icon: '⚙️' },
    ...(showAdmin ? [{ id: 'admin', label: 'Admin', icon: '🛡️' }] : []),
  ];

  const shellStyle = isDrawer
    ? {
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
        width: collapsed ? 76 : 268,
        maxWidth: '86vw',
        zIndex: 1250,
        transform: drawerOpen ? 'translateX(0)' : 'translateX(-105%)',
        transition: 'transform 0.24s ease, width 0.2s ease',
        boxShadow: drawerOpen ? '12px 0 40px rgba(0,0,0,0.45)' : 'none',
      }
    : {
        width: collapsed ? 76 : 240,
        minWidth: collapsed ? 76 : 240,
        flex: '0 0 auto',
        transition: 'width 0.2s ease, min-width 0.2s ease',
      };

  return (
    <aside
      className="evaluai-shell-nav"
      style={{
        ...shellStyle,
        display: 'flex',
        flexDirection: 'column',
        background: 'linear-gradient(180deg, rgba(15,23,42,0.98) 0%, rgba(2,6,23,0.98) 100%)',
        borderRight: '1px solid rgba(148,163,184,0.16)',
        minHeight: 0,
      }}
      aria-label="Navegación principal"
    >
      <div
        style={{
          padding: collapsed && !isDrawer ? '14px 10px' : '16px 14px 12px',
          borderBottom: '1px solid rgba(148,163,184,0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed && !isDrawer ? 'center' : 'space-between',
          gap: 8,
        }}
      >
        {!collapsed || isDrawer ? (
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#f8fafc', letterSpacing: 0.2 }}>
              🎓 EvaluAI
            </div>
            <div
              style={{
                marginTop: 2,
                fontSize: 11,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'rgba(148,163,184,0.85)',
                fontWeight: 600,
              }}
            >
              Plataforma docente
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 22, lineHeight: 1 }} title="EvaluAI">
            🎓
          </div>
        )}
        {!isDrawer && typeof onToggleCollapsed === 'function' && (
          <button
            type="button"
            onClick={onToggleCollapsed}
            style={{
              background: 'rgba(148,163,184,0.14)',
              border: '1px solid rgba(148,163,184,0.28)',
              color: '#e2e8f0',
              borderRadius: 8,
              width: 32,
              height: 30,
              cursor: 'pointer',
              fontSize: 13,
              flexShrink: 0,
            }}
            title={collapsed ? 'Expandir menú' : 'Contraer menú'}
            aria-label={collapsed ? 'Expandir menú' : 'Contraer menú'}
          >
            {collapsed ? '▶' : '◀'}
          </button>
        )}
        {isDrawer && (
          <button
            type="button"
            onClick={onCloseDrawer}
            style={{
              background: 'rgba(148,163,184,0.14)',
              border: '1px solid rgba(148,163,184,0.28)',
              color: '#e2e8f0',
              borderRadius: 8,
              width: 34,
              height: 32,
              cursor: 'pointer',
              fontSize: 16,
              flexShrink: 0,
            }}
            aria-label="Cerrar menú"
          >
            ✕
          </button>
        )}
      </div>

      <nav
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          padding: collapsed && !isDrawer ? '10px 8px' : '12px 10px',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        {navItems.map((item) => {
          const selected = activeSection === item.id;
          const showText = !collapsed || isDrawer;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onSelectSection(item.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                justifyContent: collapsed && !isDrawer ? 'center' : 'flex-start',
                textAlign: 'left',
                border: selected ? '1px solid rgba(129,140,248,0.55)' : '1px solid rgba(148,163,184,0.14)',
                borderRadius: 10,
                padding: collapsed && !isDrawer ? '10px 8px' : '11px 12px',
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: selected ? 700 : 600,
                color: selected ? '#e0e7ff' : 'rgba(226,232,240,0.88)',
                background: selected
                  ? 'linear-gradient(135deg, rgba(99,102,241,0.32) 0%, rgba(139,92,246,0.22) 100%)'
                  : 'rgba(15,23,42,0.45)',
                boxShadow: selected ? 'inset 0 0 0 1px rgba(129,140,248,0.35)' : 'none',
                transition: 'background 160ms ease, color 160ms ease, border-color 160ms ease',
              }}
              title={!showText ? item.label : undefined}
            >
              <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }} aria-hidden>
                {item.icon}
              </span>
              {showText && (
                <span style={{ minWidth: 0, flex: 1, lineHeight: 1.35 }}>{item.label}</span>
              )}
            </button>
          );
        })}
      </nav>

      <div
        style={{
          padding: collapsed && !isDrawer ? '12px 8px 14px' : '12px 12px 16px',
          borderTop: '1px solid rgba(148,163,184,0.12)',
          fontSize: 11,
          color: 'rgba(148,163,184,0.75)',
          lineHeight: 1.45,
          textAlign: collapsed && !isDrawer ? 'center' : 'left',
        }}
      >
        {!collapsed || isDrawer ? 'Fase S · Shell interno' : 'S'}
      </div>
    </aside>
  );
}
