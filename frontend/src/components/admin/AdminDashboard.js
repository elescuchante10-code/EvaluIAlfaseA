import React, { useCallback, useEffect, useMemo, useState } from 'react';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const getAuthHeaders = (contentType = 'application/json') => {
  const token = localStorage.getItem('token') || '';
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (contentType) headers['Content-Type'] = contentType;
  return headers;
};

const fmtDate = (value) => {
  const d = value ? new Date(value) : null;
  if (!d || Number.isNaN(d.getTime())) return '';
  return d.toLocaleString();
};

const formatApiError = (data, fallback) => {
  const detail = data?.detail;
  if (typeof detail === 'string') return detail;
  if (detail && typeof detail === 'object') {
    if (typeof detail.message === 'string') return detail.message;
    try {
      return JSON.stringify(detail);
    } catch {
      return fallback;
    }
  }
  if (typeof data?.message === 'string') return data.message;
  return fallback;
};

export default function AdminDashboard() {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [error, setError] = useState('');

  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedLedger, setSelectedLedger] = useState([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerBusy, setDrawerBusy] = useState(false);

  const [createForm, setCreateForm] = useState({
    email: '',
    password: '',
    full_name: '',
    credits_initial: 0,
    account_type: 'individual',
    institution_name: '',
  });

  const [topup, setTopup] = useState({ credits_delta: 0, reason: '' });
  const [resetPwd, setResetPwd] = useState({ new_password: '' });

  const loadUsers = useCallback(async () => {
    setLoadingUsers(true);
    setError('');
    try {
      const params = query.trim() ? `?query=${encodeURIComponent(query.trim())}` : '';
      const res = await fetch(`${API_URL}/api/admin/users${params}`, {
        method: 'GET',
        headers: getAuthHeaders(null),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.detail?.message || data?.detail || `Error ${res.status}`);
      setUsers(data.users || []);
    } catch (e) {
      setError(e?.message || 'Error cargando usuarios');
    } finally {
      setLoadingUsers(false);
    }
  }, [query]);

  const openUser = useCallback(async (userId) => {
    setDrawerBusy(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/admin/users/${userId}`, {
        method: 'GET',
        headers: getAuthHeaders(null),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.detail?.message || data?.detail || `Error ${res.status}`);
      setSelectedUser(data.user);
      setSelectedLedger(data.ledger_events || []);
      setDrawerOpen(true);
    } catch (e) {
      setError(e?.message || 'Error cargando usuario');
    } finally {
      setDrawerBusy(false);
    }
  }, []);

  const createUser = useCallback(async () => {
    setDrawerBusy(true);
    setError('');
    try {
      const payload = {
        email: createForm.email.trim(),
        password: createForm.password,
        full_name: createForm.full_name?.trim() || null,
        credits_initial: Number(createForm.credits_initial || 0),
        account_type: createForm.account_type,
        institution_name: createForm.institution_name?.trim() || null,
      };
      const res = await fetch(`${API_URL}/api/admin/users`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(formatApiError(data, `Error ${res.status}`));
      await loadUsers();
      setSelectedUser(data.user);
      setSelectedLedger(data.ledger_events || []);
      setDrawerOpen(true);
    } catch (e) {
      setError(e?.message || 'Error creando usuario');
    } finally {
      setDrawerBusy(false);
    }
  }, [createForm, loadUsers]);

  const doTopup = useCallback(async () => {
    if (!selectedUser) return;
    setDrawerBusy(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/admin/users/${selectedUser.id}/topup`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          credits_delta: Number(topup.credits_delta || 0),
          reason: topup.reason,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(formatApiError(data, `Error ${res.status}`));
      setSelectedUser(data.user);
      setSelectedLedger(data.ledger_events || []);
      await loadUsers();
      setTopup({ credits_delta: 0, reason: '' });
    } catch (e) {
      setError(e?.message || 'Error haciendo top-up');
    } finally {
      setDrawerBusy(false);
    }
  }, [selectedUser, topup, loadUsers]);

  const doResetPassword = useCallback(async () => {
    if (!selectedUser) return;
    setDrawerBusy(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/admin/users/${selectedUser.id}/reset-password`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ new_password: resetPwd.new_password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(formatApiError(data, `Error ${res.status}`));
      setResetPwd({ new_password: '' });
    } catch (e) {
      setError(e?.message || 'Error reseteando password');
    } finally {
      setDrawerBusy(false);
    }
  }, [selectedUser, resetPwd]);

  const toggleActive = useCallback(async () => {
    if (!selectedUser) return;
    setDrawerBusy(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/admin/users/${selectedUser.id}/set-active`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ is_active: !selectedUser.is_active }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.detail?.message || data?.detail || `Error ${res.status}`);
      await openUser(selectedUser.id);
      await loadUsers();
    } catch (e) {
      setError(e?.message || 'Error cambiando estado');
    } finally {
      setDrawerBusy(false);
    }
  }, [selectedUser, openUser, loadUsers]);

  const exportCsvHref = useMemo(() => {
    const base = `${API_URL}/api/admin/ledger/export.csv`;
    if (!selectedUser) return base;
    return `${base}?user_id=${encodeURIComponent(selectedUser.id)}`;
  }, [selectedUser]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 0 }}>
      <div style={{ flex: 1, minWidth: 0, padding: 18, overflow: 'auto' }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#e2e8f0', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            Panel Admin (MVP)
          </div>
          <div style={{ flex: 1 }} />
          <a
            href={`${API_URL}/api/admin/ledger/export.csv`}
            style={{
              fontSize: 13,
              textDecoration: 'none',
              color: '#bae6fd',
              border: '1px solid rgba(56,189,248,0.35)',
              padding: '8px 12px',
              borderRadius: 10,
              background: 'rgba(14,116,144,0.16)',
            }}
          >
            Export CSV (global)
          </a>
        </div>

        {error ? (
          <div style={{ marginTop: 12, padding: 12, borderRadius: 12, border: '1px solid rgba(248,113,113,0.35)', background: 'rgba(127,29,29,0.22)', color: '#fecaca' }}>
            {error}
          </div>
        ) : null}

        <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div style={{ padding: 14, borderRadius: 14, border: '1px solid rgba(148,163,184,0.16)', background: 'rgba(2,6,23,0.35)' }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'rgba(203,213,225,0.92)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Usuarios
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por email…"
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: '1px solid rgba(148,163,184,0.22)',
                  background: 'rgba(15,23,42,0.65)',
                  color: '#e2e8f0',
                }}
              />
              <button
                type="button"
                onClick={loadUsers}
                disabled={loadingUsers}
                style={{
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: '1px solid rgba(148,163,184,0.22)',
                  background: 'rgba(15,23,42,0.65)',
                  color: '#e2e8f0',
                  cursor: 'pointer',
                  fontWeight: 700,
                }}
              >
                {loadingUsers ? '...' : 'Buscar'}
              </button>
            </div>

            <div style={{ marginTop: 12, overflow: 'hidden', borderRadius: 12, border: '1px solid rgba(148,163,184,0.14)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 0.6fr 0.7fr 0.9fr 0.5fr', gap: 10, padding: '10px 12px', background: 'rgba(15,23,42,0.7)', color: 'rgba(203,213,225,0.85)', fontSize: 12, fontWeight: 700 }}>
                <div>Email</div>
                <div>Créditos</div>
                <div>Tipo</div>
                <div>Institución</div>
                <div>Activo</div>
              </div>
              <div style={{ maxHeight: 420, overflowY: 'auto', background: 'rgba(2,6,23,0.18)' }}>
                {(users || []).map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => openUser(u.id)}
                    disabled={drawerBusy}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      display: 'grid',
                      gridTemplateColumns: '1.6fr 0.6fr 0.7fr 0.9fr 0.5fr',
                      gap: 10,
                      padding: '10px 12px',
                      border: 'none',
                      borderTop: '1px solid rgba(148,163,184,0.08)',
                      background: 'transparent',
                      color: '#e2e8f0',
                      cursor: 'pointer',
                      fontSize: 13,
                    }}
                    title="Abrir detalle"
                  >
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.email}</div>
                    <div style={{ fontVariantNumeric: 'tabular-nums' }}>{u.credits_balance}</div>
                    <div>{u.account_type}</div>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.institution_name || '—'}</div>
                    <div>{u.is_active ? 'Sí' : 'No'}</div>
                  </button>
                ))}
                {users.length === 0 ? (
                  <div style={{ padding: 12, color: 'rgba(203,213,225,0.7)', fontSize: 13 }}>Sin resultados.</div>
                ) : null}
              </div>
            </div>
          </div>

          <div style={{ padding: 14, borderRadius: 14, border: '1px solid rgba(148,163,184,0.16)', background: 'rgba(2,6,23,0.35)' }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'rgba(203,213,225,0.92)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Crear usuario
            </div>
            <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <input
                value={createForm.email}
                onChange={(e) => setCreateForm((p) => ({ ...p, email: e.target.value }))}
                placeholder="email"
                style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(148,163,184,0.22)', background: 'rgba(15,23,42,0.65)', color: '#e2e8f0' }}
              />
              <input
                value={createForm.password}
                onChange={(e) => setCreateForm((p) => ({ ...p, password: e.target.value }))}
                placeholder="password"
                type="text"
                spellCheck={false}
                autoComplete="off"
                style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(148,163,184,0.22)', background: 'rgba(15,23,42,0.65)', color: '#e2e8f0' }}
              />
              <input
                value={createForm.full_name}
                onChange={(e) => setCreateForm((p) => ({ ...p, full_name: e.target.value }))}
                placeholder="full_name (opcional)"
                style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(148,163,184,0.22)', background: 'rgba(15,23,42,0.65)', color: '#e2e8f0' }}
              />
              <input
                value={createForm.credits_initial}
                onChange={(e) => setCreateForm((p) => ({ ...p, credits_initial: e.target.value }))}
                placeholder="créditos iniciales"
                type="number"
                min="0"
                style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(148,163,184,0.22)', background: 'rgba(15,23,42,0.65)', color: '#e2e8f0' }}
              />
              <select
                value={createForm.account_type}
                onChange={(e) => setCreateForm((p) => ({ ...p, account_type: e.target.value }))}
                style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(148,163,184,0.22)', background: 'rgba(15,23,42,0.65)', color: '#e2e8f0' }}
              >
                <option value="individual">individual</option>
                <option value="colegio">colegio</option>
              </select>
              <input
                value={createForm.institution_name}
                onChange={(e) => setCreateForm((p) => ({ ...p, institution_name: e.target.value }))}
                placeholder="institution_name (etiqueta)"
                style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(148,163,184,0.22)', background: 'rgba(15,23,42,0.65)', color: '#e2e8f0' }}
              />
            </div>
            <button
              type="button"
              onClick={createUser}
              disabled={drawerBusy}
              style={{
                marginTop: 12,
                width: '100%',
                padding: '11px 12px',
                borderRadius: 12,
                border: '1px solid rgba(129,140,248,0.55)',
                background: 'linear-gradient(135deg, rgba(99,102,241,0.32) 0%, rgba(139,92,246,0.22) 100%)',
                color: '#e0e7ff',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              Crear
            </button>
          </div>
        </div>
      </div>

      {drawerOpen ? (
        <div style={{ width: 440, minWidth: 440, borderLeft: '1px solid rgba(148,163,184,0.14)', background: 'rgba(2,6,23,0.55)', padding: 14, overflow: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 900, color: '#f8fafc', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {selectedUser?.email || 'Usuario'}
              </div>
              <div style={{ marginTop: 4, color: 'rgba(203,213,225,0.78)', fontSize: 13 }}>
                Créditos: <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 800, color: '#e0e7ff' }}>{selectedUser?.credits_balance ?? '—'}</span>
                {' · '}
                Tipo: {selectedUser?.account_type}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              style={{ border: '1px solid rgba(148,163,184,0.22)', background: 'rgba(15,23,42,0.7)', color: '#e2e8f0', borderRadius: 10, width: 36, height: 34, cursor: 'pointer' }}
              aria-label="Cerrar"
            >
              ✕
            </button>
          </div>

          <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
            <div style={{ padding: 12, borderRadius: 14, border: '1px solid rgba(148,163,184,0.16)', background: 'rgba(15,23,42,0.45)' }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: 'rgba(203,213,225,0.92)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Acciones
              </div>
              <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <input
                  value={topup.credits_delta}
                  onChange={(e) => setTopup((p) => ({ ...p, credits_delta: e.target.value }))}
                  type="number"
                  min="1"
                  placeholder="créditos +"
                  style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(148,163,184,0.22)', background: 'rgba(2,6,23,0.35)', color: '#e2e8f0' }}
                />
                <input
                  value={topup.reason}
                  onChange={(e) => setTopup((p) => ({ ...p, reason: e.target.value }))}
                  placeholder="razón"
                  style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(148,163,184,0.22)', background: 'rgba(2,6,23,0.35)', color: '#e2e8f0' }}
                />
                <button
                  type="button"
                  onClick={doTopup}
                  disabled={drawerBusy}
                  style={{ gridColumn: '1 / span 2', padding: '10px 12px', borderRadius: 12, border: '1px solid rgba(34,197,94,0.4)', background: 'rgba(22,163,74,0.18)', color: '#bbf7d0', fontWeight: 900, cursor: 'pointer' }}
                >
                  Top-up
                </button>
              </div>

              <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <input
                  value={resetPwd.new_password}
                  onChange={(e) => setResetPwd({ new_password: e.target.value })}
                  placeholder="nuevo password"
                  type="text"
                  spellCheck={false}
                  autoComplete="off"
                  style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(148,163,184,0.22)', background: 'rgba(2,6,23,0.35)', color: '#e2e8f0' }}
                />
                <button
                  type="button"
                  onClick={doResetPassword}
                  disabled={drawerBusy}
                  style={{ padding: '10px 12px', borderRadius: 12, border: '1px solid rgba(248,113,113,0.35)', background: 'rgba(127,29,29,0.18)', color: '#fecaca', fontWeight: 900, cursor: 'pointer' }}
                >
                  Reset
                </button>
              </div>

              <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={toggleActive}
                  disabled={drawerBusy}
                  style={{ flex: 1, padding: '10px 12px', borderRadius: 12, border: '1px solid rgba(148,163,184,0.22)', background: 'rgba(2,6,23,0.35)', color: '#e2e8f0', fontWeight: 800, cursor: 'pointer' }}
                >
                  {selectedUser?.is_active ? 'Desactivar' : 'Activar'}
                </button>
                <a
                  href={exportCsvHref}
                  style={{ flex: 1, textAlign: 'center', padding: '10px 12px', borderRadius: 12, border: '1px solid rgba(56,189,248,0.35)', background: 'rgba(14,116,144,0.16)', color: '#bae6fd', fontWeight: 900, textDecoration: 'none' }}
                >
                  Export CSV
                </a>
              </div>
            </div>

            <div style={{ padding: 12, borderRadius: 14, border: '1px solid rgba(148,163,184,0.16)', background: 'rgba(15,23,42,0.45)' }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: 'rgba(203,213,225,0.92)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Ledger (últimos 50)
              </div>
              <div style={{ marginTop: 10, maxHeight: 420, overflowY: 'auto', borderRadius: 12, border: '1px solid rgba(148,163,184,0.14)' }}>
                {(selectedLedger || []).map((e) => (
                  <div key={e.id} style={{ padding: '10px 12px', borderTop: '1px solid rgba(148,163,184,0.08)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                      <div style={{ fontWeight: 900, color: '#e2e8f0', fontSize: 13 }}>
                        {e.action} · {e.surface}
                      </div>
                      <div style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 900, color: e.credits_delta >= 0 ? '#bbf7d0' : '#fecaca' }}>
                        {e.credits_delta >= 0 ? `+${e.credits_delta}` : e.credits_delta}
                      </div>
                    </div>
                    <div style={{ marginTop: 4, fontSize: 12.5, color: 'rgba(203,213,225,0.72)' }}>
                      {fmtDate(e.created_at)} · before {e.credits_before} → after {e.credits_after}
                    </div>
                    <div style={{ marginTop: 4, fontSize: 11.5, color: 'rgba(148,163,184,0.75)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      request_id: {e.request_id}
                    </div>
                  </div>
                ))}
                {selectedLedger.length === 0 ? (
                  <div style={{ padding: 12, color: 'rgba(203,213,225,0.7)', fontSize: 13 }}>Sin eventos.</div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

