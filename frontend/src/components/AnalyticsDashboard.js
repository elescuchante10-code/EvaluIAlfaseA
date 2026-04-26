import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  LineChart, Line, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const COLORS = {
  error: '#ef4444',
  improvement: '#22c55e',
  observation: '#f59e0b',
  total: '#6366f1',
};

const SEVERITY_COLORS = {
  'CRÍTICO': '#ef4444',
  RELEVANTE: '#f97316',
  MENOR: '#eab308',
  FORMAL: '#3b82f6',
};

const SEVERITY_ORDER = ['CRÍTICO', 'RELEVANTE', 'MENOR', 'FORMAL'];

function normalizeSeverity(value) {
  const normalized = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();

  switch (normalized) {
    case 'CRITICO':
      return 'CRÍTICO';
    case 'RELEVANTE':
      return 'RELEVANTE';
    case 'MENOR':
      return 'MENOR';
    case 'FORMAL':
      return 'FORMAL';
    default:
      return '';
  }
}

export default function AnalyticsDashboard({ evaluacionResultado, currentFootnotes = [] }) {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(false);
  const severitySummary = useMemo(() => {
    const counts = currentFootnotes.reduce((acc, footnote) => {
      const severity = normalizeSeverity(footnote?.severity);
      if (severity) {
        acc[severity] += 1;
      }
      return acc;
    }, {
      'CRÍTICO': 0,
      RELEVANTE: 0,
      MENOR: 0,
      FORMAL: 0,
    });

    return SEVERITY_ORDER
      .map((severity) => ({
        key: severity,
        label: severity,
        value: counts[severity],
        color: SEVERITY_COLORS[severity],
      }))
      .filter((item) => item.value > 0);
  }, [currentFootnotes]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token') || '';
      const res = await fetch(`${API_BASE}/api/evaluate/analytics`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAnalytics(data);
      }
    } catch (err) {
      console.error('Error fetching analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [evaluacionResultado, currentFootnotes.length]);

  const pieData = analytics
    ? [
        { name: 'Errores', value: analytics.totals?.errors || 0, fill: COLORS.error },
        { name: 'Mejoras', value: analytics.totals?.improvements || 0, fill: COLORS.improvement },
        { name: 'Observ.', value: analytics.totals?.observations || 0, fill: COLORS.observation },
      ].filter((d) => d.value > 0)
    : [];

  if (loading) {
    return (
      <div style={s.panel}>
        <h3 style={s.title}>📊 Analíticas</h3>
        <div style={s.center}>
          <div style={s.spinner} />
          <p style={{ color: '#64748b', marginTop: '12px', fontSize: '13px' }}>Cargando...</p>
        </div>
      </div>
    );
  }

  if (!analytics || analytics.total_evaluations === 0) {
    return (
      <div style={s.panel}>
        <h3 style={s.title}>📊 Analíticas del Agente</h3>
        <div style={s.emptyState}>
          <span style={{ fontSize: '40px' }}>📈</span>
          <p style={{ color: '#64748b', textAlign: 'center', fontSize: '13px', lineHeight: 1.5 }}>
            Realiza tu primera evaluación para ver estadísticas y gráficas de progreso aquí.
          </p>
          {evaluacionResultado && (
            <CurrentMetrics data={evaluacionResultado} />
          )}
          {severitySummary.length > 0 && (
            <CurrentSeverityMetrics summary={severitySummary} />
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={s.panel}>
      <div style={s.header}>
        <h3 style={s.title}>📊 Analíticas del Agente</h3>
        <button onClick={fetchAnalytics} style={s.refreshBtn} title="Actualizar">
          ↻
        </button>
      </div>

      {/* Summary cards */}
      <div style={s.cardsRow}>
        <StatCard label="Evaluaciones" value={analytics.total_evaluations} icon="📄" color="#6366f1" />
        <StatCard label="Prom. Notas/doc" value={analytics.avg_footnotes} icon="📌" color="#22c55e" />
      </div>

      {/* Pie chart */}
      {pieData.length > 0 && (
        <div style={s.chartSection}>
          <h4 style={s.chartTitle}>Distribución de Anotaciones</h4>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={70}
                dataKey="value"
                label={({ name, value }) => `${name}: ${value}`}
                labelLine={false}
                fontSize={10}
              >
                {pieData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip formatter={(v, n) => [v, n]} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Line chart — history */}
      {analytics.history?.length > 1 && (
        <div style={s.chartSection}>
          <h4 style={s.chartTitle}>Evolución Histórica</h4>
          <ResponsiveContainer width="100%" height={150}>
            <LineChart data={analytics.history}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#f8fafc', fontSize: '12px' }}
              />
              <Line type="monotone" dataKey="errors" stroke={COLORS.error} dot={false} strokeWidth={2} name="Errores" />
              <Line type="monotone" dataKey="improvements" stroke={COLORS.improvement} dot={false} strokeWidth={2} name="Mejoras" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Bar chart — last 5 */}
      {analytics.history?.length > 0 && (
        <div style={s.chartSection}>
          <h4 style={s.chartTitle}>Últimas Evaluaciones</h4>
          <ResponsiveContainer width="100%" height={130}>
            <BarChart data={analytics.history.slice(-5)}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#f8fafc', fontSize: '12px' }}
              />
              <Bar dataKey="errors" fill={COLORS.error} name="Errores" radius={[3, 3, 0, 0]} />
              <Bar dataKey="improvements" fill={COLORS.improvement} name="Mejoras" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Totals breakdown */}
      <div style={s.totalsSection}>
        <h4 style={s.chartTitle}>Totales Acumulados</h4>
        <TotalRow label="Errores detectados" value={analytics.totals?.errors || 0} color={COLORS.error} />
        <TotalRow label="Mejoras sugeridas" value={analytics.totals?.improvements || 0} color={COLORS.improvement} />
        <TotalRow label="Observaciones" value={analytics.totals?.observations || 0} color={COLORS.observation} />
      </div>

      {severitySummary.length > 0 && <CurrentSeverityMetrics summary={severitySummary} />}
      {evaluacionResultado && <CurrentMetrics data={evaluacionResultado} />}
    </div>
  );
}

function CurrentMetrics({ data }) {
  if (!data?.metrics) return null;
  const m = data.metrics;
  return (
    <div style={{ marginTop: '16px', padding: '14px', background: 'rgba(99,102,241,0.1)', borderRadius: '10px', border: '1px solid rgba(99,102,241,0.2)' }}>
      <h4 style={{ color: '#a5b4fc', fontSize: '13px', margin: '0 0 10px 0', fontWeight: '600' }}>
        📌 Evaluación Actual
      </h4>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {[
          { k: 'total', label: 'Notas', c: '#6366f1' },
          { k: 'error', label: 'Errores', c: '#ef4444' },
          { k: 'improvement', label: 'Mejoras', c: '#22c55e' },
          { k: 'observation', label: 'Observ.', c: '#f59e0b' },
        ].map(({ k, label, c }) => (
          <div key={k} style={{ flex: 1, minWidth: '60px', textAlign: 'center', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '8px 4px' }}>
            <div style={{ fontSize: '20px', fontWeight: '800', color: c }}>{m[k] || 0}</div>
            <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase' }}>{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CurrentSeverityMetrics({ summary }) {
  if (!summary?.length) return null;

  return (
    <div style={{ marginTop: '16px', padding: '14px', background: 'rgba(148,163,184,0.08)', borderRadius: '10px', border: '1px solid rgba(148,163,184,0.18)' }}>
      <h4 style={{ color: '#e2e8f0', fontSize: '13px', margin: '0 0 10px 0', fontWeight: '600' }}>
        Severidad Actual
      </h4>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px' }}>
        {summary.map((item) => (
          <div key={item.key} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '10px 8px', border: `1px solid ${item.color}33` }}>
            <div style={{ fontSize: '10px', color: item.color, fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {item.label}
            </div>
            <div style={{ fontSize: '20px', fontWeight: '800', color: '#f8fafc', marginTop: '4px' }}>
              {item.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, color }) {
  return (
    <div style={{ flex: 1, background: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '14px', textAlign: 'center', border: `1px solid ${color}25` }}>
      <div style={{ fontSize: '20px', marginBottom: '4px' }}>{icon}</div>
      <div style={{ fontSize: '22px', fontWeight: '800', color }}>{value}</div>
      <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
    </div>
  );
}

function TotalRow({ label, value, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#e2e8f0' }}>
        <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: color }} />
        {label}
      </div>
      <span style={{ fontWeight: '700', color, fontSize: '14px' }}>{value}</span>
    </div>
  );
}

const s = {
  panel: {
    height: '100%',
    overflowY: 'auto',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '0',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  },
  title: {
    margin: 0,
    fontSize: '16px',
    fontWeight: '700',
    color: '#f8fafc',
  },
  refreshBtn: {
    background: 'rgba(255,255,255,0.06)',
    border: 'none',
    color: '#94a3b8',
    fontSize: '18px',
    cursor: 'pointer',
    borderRadius: '6px',
    padding: '4px 8px',
  },
  cardsRow: {
    display: 'flex',
    gap: '10px',
    marginBottom: '20px',
  },
  chartSection: { marginBottom: '20px' },
  chartTitle: {
    color: '#94a3b8',
    fontSize: '12px',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    margin: '0 0 10px 0',
  },
  totalsSection: { marginBottom: '16px' },
  center: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 20px',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
    padding: '24px 0',
  },
  spinner: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    border: '3px solid rgba(255,255,255,0.08)',
    borderTop: '3px solid #6366f1',
    animation: 'spin 0.8s linear infinite',
  },
};
