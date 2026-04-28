import React, { useState, useEffect, useRef, useCallback } from 'react';
import { authAPI, evaluacionesAPI } from './services/api.js';
import ChatPrincipal from './components/ChatPrincipal.js';
import ChatBubble from './components/ChatBubble.js';
import { CentralEvaluator } from './components/editor';
import EditorMarkdown from './components/rubricas/EditorMarkdown.js';
import EvaluationSummaryPanel from './components/EvaluationSummaryPanel.js';
import BatchProcessor from './components/BatchProcessor.js';
import MiEspacioIB from './components/MiEspacioIB.js';
import AsistenteIA from './components/AsistenteIA.js';
import LandingPage from './components/LandingPage.js';
import SidebarNav from './components/layout/SidebarNav.js';
import TopBar from './components/layout/TopBar.js';
import SettingsView from './components/SettingsView.js';
import AdminDashboard from './components/admin/AdminDashboard.js';
import {
  applyEvaluationConfigToMarkdown,
  DEFAULT_EVALUATION_METHODOLOGY,
  extractEvaluationConfigFromMarkdown,
} from './utils/rubricaParser.js';
import { useTeacherContextPack } from './hooks/useTeacherContextPack.js';
import {
  buildTeacherContextSummary,
  teacherContextPackToWire,
} from './utils/teacherContextPack.js';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

/** Tras checkout Wompi: retorno a /payment-success?reference=… sin tocar el motor de evaluación. */
const WOMPI_REF_STORAGE_KEY = 'evaluai_wompi_pending_reference';

/** @param {object|undefined|null} u - usuario desde /login o /me */
const isUserRoleAdmin = (u) => String(u?.role || '').toLowerCase() === 'admin';

const createDefaultMethodologyConfig = () => ({
  metodologiaEvaluacion: DEFAULT_EVALUATION_METHODOLOGY,
  instruccionIA: '',
});

function App() {
  // Estados de navegación
  const [currentView, setCurrentView] = useState('landing');
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Landing + billing (Fase E)
  const [landingNotice, setLandingNotice] = useState(null);
  const [subscribeState, setSubscribeState] = useState({ status: 'idle', error: null });
  /** Aviso tras retorno Wompi (solo shell; no afecta evaluador ni rutas /api/evaluate). */
  const [billingReturnNotice, setBillingReturnNotice] = useState(null);
  
  // Estados para auth
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nombre, setNombre] = useState('');
  const MAX_PASSWORD_BYTES = 72;
  
  // Estados para evaluación
  const [asignaturas, setAsignaturas] = useState([]);
  
  // Estados para rúbricas - INICIAN VACÍOS
  const [rubricas, setRubricas] = useState([]);
  const [rubricaActiva, setRubricaActiva] = useState(null);
  const [configuracionMetodologia, setConfiguracionMetodologia] = useState(createDefaultMethodologyConfig);
  const [mostrarEditorRubrica, setMostrarEditorRubrica] = useState(false);
  
  // Estados para CentralEvaluator
  const [mostrarCentralEvaluator, setMostrarCentralEvaluator] = useState(false);
  const [currentDocument, setCurrentDocument] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [evaluacionResultado, setEvaluacionResultado] = useState(null);
  const [currentFootnotes, setCurrentFootnotes] = useState([]);
  const [isEvaluando, setIsEvaluando] = useState(false);
  
  // Panel lateral
  const [vistaPanel, setVistaPanel] = useState('chat');
  const [mostrarBatch, setMostrarBatch] = useState(false);
  // Sección principal del workspace:
  //  'espacio'         → Mi Espacio IB
  //  'trabajo'         → Evaluar / Flujo
  //  'asistente'     → Asistente IA (Fase E)
  //  'configuracion' → Ajustes de cuenta (solo UI)
  //  'admin'         → Panel admin (solo user.role === 'admin')
  const [seccionActiva, setSeccionActiva] = useState('espacio');
  const [windowWidth, setWindowWidth] = useState(() => (typeof window === 'undefined' ? 1440 : window.innerWidth));
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(() => (typeof window === 'undefined' ? true : window.innerWidth > 900));
  const [isMainNavCollapsed, setIsMainNavCollapsed] = useState(false);
  const [isMobileShellNavOpen, setIsMobileShellNavOpen] = useState(false);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(() => (typeof window === 'undefined' ? true : window.innerWidth > 1024));
  /** Barra superior de Evaluar + toolbar de CentralEvaluator: más espacio para el visor cuando está contraída. */
  const [isEvaluarTopChromeExpanded, setIsEvaluarTopChromeExpanded] = useState(true);

  // ChatBubble global state
  const [selectedText, setSelectedText] = useState(null);
  const externalFootnoteRef = useRef(null); // ref to addExternalFootnote in CentralEvaluator

  // Session ID — auto-generated per document to detect student switches
  const [evaluacionSessionId, setEvaluacionSessionId] = useState(() => `init_${Date.now()}`);

  // Misma fuente de verdad que ChatBubble / Asistente IA (Mi Espacio IB + localStorage)
  const teacherContextPack = useTeacherContextPack();

  // Ref para el input de archivo en el sidebar
  const sidebarFileInputRef = useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (windowWidth <= 900) {
      setIsLeftPanelOpen(false);
      setIsMobileShellNavOpen(false);
    }
    if (windowWidth <= 1024) {
      setIsRightPanelOpen(false);
    }
  }, [windowWidth]);

  useEffect(() => {
    if (!mostrarCentralEvaluator) {
      setIsEvaluarTopChromeExpanded(true);
    }
  }, [mostrarCentralEvaluator]);

  useEffect(() => {
    if (seccionActiva === 'admin' && !isUserRoleAdmin(user)) {
      setSeccionActiva('espacio');
    }
  }, [seccionActiva, user]);

  // ── Session helpers ──────────────────────────────────────────────────────────
  const generarSessionId = (filename) => {
    const base = filename.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9]/g, '_').toUpperCase().slice(0, 16);
    return `${base}_${Date.now()}`;
  };

  const hydrateRubric = useCallback((rubric) => {
    if (!rubric) return null;

    const markdown = rubric.markdown || rubric.markdownOriginal || rubric.contenido || '';
    const config = extractEvaluationConfigFromMarkdown(markdown);

    return {
      ...rubric,
      metodologiaEvaluacion: rubric.metodologiaEvaluacion || config.metodologiaEvaluacion,
      instruccionIA: rubric.instruccionIA ?? config.instruccionIA,
    };
  }, []);

  const syncRubricConfig = useCallback((rubric) => {
    const hydrated = hydrateRubric(rubric);
    setRubricaActiva(hydrated);
    setConfiguracionMetodologia(
      hydrated
        ? {
            metodologiaEvaluacion: hydrated.metodologiaEvaluacion || DEFAULT_EVALUATION_METHODOLOGY,
            instruccionIA: hydrated.instruccionIA || '',
          }
        : createDefaultMethodologyConfig()
    );
  }, [hydrateRubric]);

  const openNewRubricEditor = useCallback(() => {
    setRubricaActiva(null);
    setConfiguracionMetodologia(createDefaultMethodologyConfig());
    setMostrarEditorRubrica(true);
  }, []);

  const openDraftRubricEditor = useCallback((markdownDraft) => {
    const draftRubric = hydrateRubric({
      nombre: 'Rúbrica en borrador',
      asignatura: '',
      markdown: markdownDraft,
    });

    setRubricaActiva(draftRubric);
    setConfiguracionMetodologia({
      metodologiaEvaluacion: draftRubric?.metodologiaEvaluacion || DEFAULT_EVALUATION_METHODOLOGY,
      instruccionIA: draftRubric?.instruccionIA || '',
    });
    setMostrarEditorRubrica(true);
  }, [hydrateRubric]);

  const releaseDocumentPreview = useCallback((doc) => {
    if (doc?.previewUrl && typeof doc.previewUrl === 'string' && doc.previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(doc.previewUrl);
    }
  }, []);

  // Resetea sólo la evaluación activa — la rúbrica NUNCA se toca
  const resetEvaluacion = useCallback(() => {
    setCurrentDocument((prev) => {
      releaseDocumentPreview(prev);
      return null;
    });
    setEvaluacionResultado(null);
    setCurrentFootnotes([]);
    setSelectedText(null);
    // Nuevo session ID → ChatBubble se remonta con historial limpio
    setEvaluacionSessionId(`reset_${Date.now()}`);
  }, [releaseDocumentPreview]);

  // Botón "Limpiar Todo / Nuevo Trabajo"
  const resetSystem = useCallback(() => {
    resetEvaluacion();
    setMostrarCentralEvaluator(false);
  }, [resetEvaluacion]);

  const handleTextSelected = useCallback((selection) => {
    setSelectedText(selection);
  }, []);

  const handleClearSelectedText = useCallback(() => {
    setSelectedText(null);
  }, []);

  useEffect(() => {
    return () => {
      releaseDocumentPreview(currentDocument);
    };
  }, [currentDocument, releaseDocumentPreview]);

  const handleAddFootnoteFromChat = useCallback((text, context) => {
    if (externalFootnoteRef.current) {
      externalFootnoteRef.current(text, context);
    }
  }, []);

  const cargarAsignaturas = async () => {
    try {
      const data = await evaluacionesAPI.listarAsignaturas();
      if (data.asignaturas) {
        setAsignaturas(data.asignaturas);
      }
    } catch (err) {
      setAsignaturas([
        { id: 'matematicas', nombre: 'Matemáticas', icono: '📐' },
        { id: 'lenguaje', nombre: 'Lengua Castellana', icono: '📚' },
        { id: 'ingles', nombre: 'Inglés', icono: '🗣️' },
      ]);
    }
  };

  // Cargar rúbricas del backend
  const cargarRubricas = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/rubrics/`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
      });
      if (response.ok) {
        const data = await response.json();
        setRubricas((data.rubrics || []).map(hydrateRubric));
      }
    } catch (err) {
      console.error('Error cargando rúbricas:', err);
    }
  }, [hydrateRubric]);

  const applyWompiPollResult = useCallback((result) => {
    if (result?.ok) {
      setBillingReturnNotice({
        variant: 'success',
        title: 'Pago confirmado',
        body: 'Tu plan y créditos se sincronizaron. Ya puedes seguir evaluando.',
      });
      return;
    }
    if (result?.reason === 'timeout') {
      setBillingReturnNotice({
        variant: 'info',
        title: 'Pago en proceso',
        body:
          'Aún no vemos la confirmación en el sistema. Espera un momento y recarga la página, o revisa tu correo.',
      });
      return;
    }
    if (result?.reason === 'terminal') {
      setBillingReturnNotice({
        variant: 'error',
        title: 'Pago no aprobado',
        body: 'La transacción no se completó. Puedes intentar de nuevo desde Precios.',
      });
      return;
    }
    if (result?.reason === 'http' && result.message) {
      setBillingReturnNotice({
        variant: 'error',
        title: 'No se pudo consultar el pago',
        body: result.message,
      });
    }
  }, []);

  const pollWompiReferenceUntilTerminal = useCallback(
    async (reference, shouldCancel) => {
      const ref = (reference || '').trim();
      if (!ref) return { ok: false, reason: 'empty' };
      const token = localStorage.getItem('token') || '';
      if (!token) return { ok: false, reason: 'no_token' };

      const terminalFail = new Set(['declined', 'expired', 'failed', 'rejected']);
      const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };

      for (let attempt = 0; attempt < 30; attempt += 1) {
        if (shouldCancel()) return { ok: false, reason: 'cancelled' };
        try {
          const res = await fetch(
            `${API_URL}/api/billing/wompi/payments/${encodeURIComponent(ref)}`,
            { method: 'GET', headers }
          );
          if (!res.ok) {
            const errBody = await res.json().catch(() => ({}));
            const detail = errBody?.detail;
            return {
              ok: false,
              reason: 'http',
              message: typeof detail === 'string' ? detail : `Error ${res.status}`,
            };
          }
          const data = await res.json();
          const st = String(data?.status || '').toLowerCase();
          if (st === 'approved') {
            const me = await authAPI.getMe();
            if (me.success && me.user) setUser(me.user);
            try {
              await cargarRubricas();
            } catch (_) {
              /* no bloquear facturación */
            }
            return { ok: true, status: st };
          }
          if (terminalFail.has(st)) {
            return { ok: false, reason: 'terminal', status: st };
          }
        } catch (_) {
          /* red transitoria */
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
      return { ok: false, reason: 'timeout' };
    },
    [cargarRubricas]
  );

  const flushPendingWompiReferenceAfterAuth = useCallback(async () => {
    const pending = (sessionStorage.getItem(WOMPI_REF_STORAGE_KEY) || '').trim();
    if (!pending) return;
    sessionStorage.removeItem(WOMPI_REF_STORAGE_KEY);
    const result = await pollWompiReferenceUntilTerminal(pending, () => false);
    if (result.reason !== 'cancelled') applyWompiPollResult(result);
  }, [applyWompiPollResult, pollWompiReferenceUntilTerminal]);

  // Verificar sesión al iniciar
  useEffect(() => {
    const checkAuth = async () => {
      if (authAPI.isAuthenticated()) {
        const currentUser = authAPI.getCurrentUser();
        if (currentUser) {
          setUser(currentUser);
          try {
            const me = await authAPI.getMe();
            if (me.success) {
              setUser(me.user);
              setCurrentView('dashboard');
              cargarRubricas();
            } else {
              authAPI.logout();
            }
          } catch (err) {
            console.error('Error verificando sesion:', err);
          }
        }
      }
    };
    checkAuth();
    cargarAsignaturas();
  }, [cargarRubricas]);

  // Retorno desde Wompi: SPA + polling de estado (no interfiere con /api/evaluate).
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    let cancelled = false;
    const shouldCancel = () => cancelled;

    const normalizePath = (pathname) => {
      const p = pathname || '/';
      if (p.length > 1 && p.endsWith('/')) return p.slice(0, -1);
      return p;
    };

    const path = normalizePath(window.location.pathname);
    const successPath =
      path === '/payment-success' || path.endsWith('/payment-success');
    const cancelPath =
      path === '/payment-cancelled' || path.endsWith('/payment-cancelled');
    const params = new URLSearchParams(window.location.search || '');
    const reference = (params.get('reference') || '').trim();

    const cleanToRoot = () => {
      window.history.replaceState({}, '', '/');
    };

    const run = async () => {
      if (cancelPath) {
        cleanToRoot();
        if (authAPI.isAuthenticated()) {
          setCurrentView('dashboard');
          setBillingReturnNotice({
            variant: 'info',
            title: 'Pago no completado',
            body: 'Saliste del checkout sin pagar. Puedes suscribirte de nuevo cuando quieras.',
          });
        } else {
          setCurrentView('landing');
          setLandingNotice({
            title: 'Pago no completado',
            body: 'Si quieres activar EvaluAI, vuelve a Precios e inicia el pago otra vez.',
          });
        }
        return;
      }

      if (successPath && reference) {
        const token = localStorage.getItem('token') || '';
        if (!token) {
          sessionStorage.setItem(WOMPI_REF_STORAGE_KEY, reference);
          cleanToRoot();
          setCurrentView('login');
          setError(
            'Inicia sesión con la misma cuenta para confirmar tu pago y actualizar tus créditos.'
          );
          return;
        }
        cleanToRoot();
        const result = await pollWompiReferenceUntilTerminal(reference, shouldCancel);
        if (!cancelled && result.reason !== 'cancelled') applyWompiPollResult(result);
        return;
      }

      if (authAPI.isAuthenticated()) {
        const pending = (sessionStorage.getItem(WOMPI_REF_STORAGE_KEY) || '').trim();
        if (pending) {
          sessionStorage.removeItem(WOMPI_REF_STORAGE_KEY);
          const result = await pollWompiReferenceUntilTerminal(pending, shouldCancel);
          if (!cancelled && result.reason !== 'cancelled') applyWompiPollResult(result);
        }
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [applyWompiPollResult, pollWompiReferenceUntilTerminal]);

  // Guardar rúbrica desde chat
  const guardarRubricaDesdeChat = useCallback(async (
    markdownText,
    nombre = '',
    asignatura = '',
    metodologiaConfig = createDefaultMethodologyConfig()
  ) => {
    try {
      const markdownConConfiguracion = applyEvaluationConfigToMarkdown(markdownText, metodologiaConfig);
      const response = await fetch(`${API_URL}/api/rubrics/`, { 
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
        },
        body: JSON.stringify({ 
          markdown: markdownConConfiguracion,
          nombre: nombre,
          asignatura: asignatura
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        const hydratedRubric = hydrateRubric(data.rubric);
        await cargarRubricas();
        syncRubricConfig(hydratedRubric);
        return { success: true, rubric: hydratedRubric };
      } else {
        const error = await response.json();
        return { success: false, error: error.detail };
      }
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, [cargarRubricas, hydrateRubric, syncRubricConfig]);

  const eliminarRubrica = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm('¿Eliminar esta rúbrica?')) return;
    try {
      await fetch(`${API_URL}/api/rubrics/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
      });
      setRubricas(prev => prev.filter(r => r.id !== id));
      if (rubricaActiva?.id === id) {
        syncRubricConfig(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Handlers de autenticación
  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      const data = await authAPI.login(email, password);
      if (data.success) {
        let u = data.user;
        const me = await authAPI.getMe();
        if (me.success && me.user) u = me.user;
        setUser(u);
        setCurrentView('dashboard');
        cargarRubricas();
        await flushPendingWompiReferenceAfterAuth();
      } else {
        setError(data.message || 'Error al iniciar sesión');
      }
    } catch (err) {
      setError('Error de conexión');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      const data = await authAPI.register(email, password, nombre);
      if (data.success) {
        let u = data.user;
        const me = await authAPI.getMe();
        if (me.success && me.user) u = me.user;
        setUser(u);
        setCurrentView('dashboard');
        cargarRubricas();
        await flushPendingWompiReferenceAfterAuth();
      } else {
        setError(data.message || 'Error al registrar');
      }
    } catch (err) {
      setError('Error de conexión');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    authAPI.logout();
    setUser(null);
    setCurrentView('landing');
    syncRubricConfig(null);
    setRubricas([]);
    resetEvaluacion();
  };

  // ── Sesión viva (fuente de verdad: /api/auth/me) ───────────────────────────
  const refreshingMeRef = useRef(false);

  const refreshSessionUser = useCallback(
    async ({ reason = 'poll' } = {}) => {
      if (!authAPI.isAuthenticated()) return;
      if (refreshingMeRef.current) return;
      refreshingMeRef.current = true;
      try {
        const me = await authAPI.getMe();
        if (me?.success && me.user) {
          setUser(me.user);
          return;
        }
        if (me?.expired) {
          // authAPI.getMe ya limpió token/user; redirigir a login sin bloquear
          setUser(null);
          setCurrentView('login');
          setError(me?.message || 'Sesión expirada. Por favor inicia sesión de nuevo.');
          return;
        }
        if (me?.success === false) {
          // No bloquear UX: mantener último user en memoria
          console.warn(`[refreshSessionUser:${reason}]`, me?.message || 'No se pudo revalidar sesión.');
        }
      } catch (err) {
        console.warn(`[refreshSessionUser:${reason}]`, err);
      } finally {
        refreshingMeRef.current = false;
      }
    },
    []
  );

  useEffect(() => {
    if (!authAPI.isAuthenticated()) return undefined;
    // polling suave: 90s (entre 60 y 120s)
    const id = window.setInterval(() => {
      refreshSessionUser({ reason: 'interval' });
    }, 90 * 1000);
    return () => window.clearInterval(id);
  }, [refreshSessionUser]);

  // Subir documento
  const handleUploadDocument = useCallback(async (file) => {
    console.log('[📤 UPLOAD] Iniciando subida de documento:', file.name);

    // Auto-reset si el nombre del documento cambia (detección de cambio de alumno)
    const nuevoSessionId = generarSessionId(file.name);
    const sessionBase = evaluacionSessionId.replace(/_\d+$/, '');
    const nuevoBase = nuevoSessionId.replace(/_\d+$/, '');
    if (currentDocument && sessionBase !== nuevoBase) {
      console.log('[🔄 SESSION] Cambio de documento detectado → reseteando evaluación anterior');
      setCurrentDocument((prev) => {
        releaseDocumentPreview(prev);
        return null;
      });
      setEvaluacionResultado(null);
      setSelectedText(null);
    }
    setEvaluacionSessionId(nuevoSessionId);

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      console.log('[📤 UPLOAD] Enviando POST a /api/documents/upload...');
      const response = await fetch(`${API_URL}/api/documents/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
        },
        body: formData
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('[📤 UPLOAD] Error en respuesta:', error);
        throw new Error(error.detail || 'Error al subir documento');
      }

      const data = await response.json();
      console.log('[📤 UPLOAD] Documento subido exitosamente:', data);
      const previewUrl = URL.createObjectURL(file);
      const fileType = file.name.split('.').pop()?.toLowerCase() || '';
      
      console.log('[📤 UPLOAD] Actualizando estado currentDocument...');
      setCurrentDocument((prev) => {
        releaseDocumentPreview(prev);
        return {
          id: data.document_id,
          filename: data.filename,
          paragraphs: data.paragraphs,
          status: data.status,
          multimodal: data.multimodal || null,
          documentRouter: data.document_router || data.multimodal?.document_router || null,
          sourceFile: file,
          previewUrl,
          fileType,
          mimeType: file.type,
        };
      });
      setEvaluacionResultado(null);
      setCurrentFootnotes([]);
      setSelectedText(null);
      
      console.log('[📤 UPLOAD] Cambiando vista a evaluator (mostrando CentralEvaluator)...');
      setMostrarCentralEvaluator(true);
      setSeccionActiva('trabajo');
      
      console.log('[📤 UPLOAD] Proceso completado exitosamente ✅');
    } catch (error) {
      console.error('[📤 UPLOAD] Error en el proceso:', error);
      alert('Error: ' + error.message);
    } finally {
      setIsUploading(false);
    }
  }, [currentDocument, evaluacionSessionId, releaseDocumentPreview]);

  // Subir documento a Mi Espacio IB (persistencia real, SIN tocar Evaluar)
  //  - Reutiliza el endpoint real /api/documents/upload (guarda el binario en backend).
  //  - NO setea currentDocument.
  //  - NO abre CentralEvaluator.
  //  - NO cambia seccionActiva.
  //  - NO toca evaluacionResultado / footnotes / selección.
  //  - Devuelve el metadata persistido para que Mi Espacio IB lo registre en su índice.
  const handleUploadDocumentoEspacio = useCallback(async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(`${API_URL}/api/documents/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
      },
      body: formData,
    });
    if (!response.ok) {
      let detail = 'Error al subir documento';
      try {
        const err = await response.json();
        detail = err.detail || detail;
      } catch { /* respuesta no JSON */ }
      throw new Error(detail);
    }
    const data = await response.json();
    return {
      document_id: data.document_id,
      filename: data.filename,
      status: data.status || 'ok',
      paragraphs_count: Array.isArray(data.paragraphs) ? data.paragraphs.length : null,
      markdown_status: data.markdown_status,
      markdown_path: data.markdown_path,
      markdown_relpath: data.markdown_relpath,
      teacher_context_manifest_url: data.teacher_context_manifest_url,
    };
  }, []);

  // Eliminar documento desde Mi Espacio IB (libera cupo real en backend)
  const handleDeleteDocumentoEspacio = useCallback(async (documentId) => {
    const token = localStorage.getItem('token') || '';
    if (!token) throw new Error('Sesión inválida. Inicia sesión de nuevo.');
    const response = await fetch(`${API_URL}/api/documents/${documentId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const msg = data?.detail?.message || data?.detail || data?.message || `Error ${response.status}`;
      throw new Error(typeof msg === 'string' ? msg : 'Error eliminando documento');
    }
    // Notifica al medidor de Configuración que el cupo cambió
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('evaluai:storage-quota-changed'));
    }
    return data;
  }, []);

  // Evaluar documento con rúbrica
  const handleEvaluarDocumento = async () => {
    if (!currentDocument || !rubricaActiva) return;
    
    setIsEvaluando(true);
    try {
      const multimodal = currentDocument.multimodal;
      const base =
        multimodal && typeof multimodal === 'object' ? { ...multimodal } : {};
      const document_context = {
        ...base,
        espacio_ib_asignatura_activa: teacherContextPack?.asignatura_activa || null,
        teacher_context_pack: teacherContextPackToWire(teacherContextPack),
        teacher_context_summary: buildTeacherContextSummary(teacherContextPack),
      };

      const response = await fetch(`${API_URL}/api/evaluate/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
        },
        body: JSON.stringify({
          document_id: currentDocument.id,
          paragraphs: currentDocument.paragraphs,
          rubric_markdown: rubricaActiva.markdown || rubricaActiva.contenido,
          evaluation_methodology: configuracionMetodologia.metodologiaEvaluacion,
          custom_instruction: configuracionMetodologia.instruccionIA,
          document_context,
        })
      });

      if (!response.ok) {
        throw new Error('Error en evaluación');
      }

      const data = await response.json();
      setEvaluacionResultado(data);
      
      // Actualizar documento con correcciones
      setCurrentDocument(prev => ({
        ...prev,
        corrections: data.corrections
      }));
    } catch (error) {
      console.error('Error evaluando:', error);
      alert('Error en evaluación: ' + error.message);
    } finally {
      setIsEvaluando(false);
    }
  };

  // ── Billing (Wompi) ─────────────────────────────────────────────────────────
  // Decisión de demo:
  // - Si NO hay sesión: redirigimos a login con mensaje.
  // - Si hay sesión: pedimos al backend un payment link y redirigimos a checkout_url.
  const handleSubscribePro = useCallback(async () => {
    setLandingNotice(null);
    setSubscribeState({ status: 'loading', error: null });

    const token = localStorage.getItem('token') || '';
    if (!token) {
      setSubscribeState({ status: 'idle', error: null });
      setError('Inicia sesión para suscribirte.');
      setCurrentView('login');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/billing/wompi/payment-links`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ plan_code: 'pro' }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const detail = data?.detail || data?.message || `Error ${response.status}`;
        throw new Error(detail);
      }

      const checkoutUrl = data?.checkout_url || data?.checkoutUrl || null;
      if (!checkoutUrl || typeof checkoutUrl !== 'string') {
        throw new Error('No se recibió checkout_url desde billing.');
      }

      setSubscribeState({ status: 'idle', error: null });
      window.location.assign(checkoutUrl);
    } catch (err) {
      setSubscribeState({ status: 'error', error: err?.message || 'Error generando enlace de pago.' });
      setLandingNotice({
        title: 'No se pudo abrir el checkout de pago.',
        body: 'Escríbenos por WhatsApp y te activamos el acceso o revisamos el enlace de pago.',
      });
    }
  }, []);

  // ==================== VISTAS ====================
  
  const renderLanding = () => (
    <LandingPage
      onGoLogin={() => {
        setLandingNotice(null);
        setError('');
        setCurrentView('login');
      }}
      onGoRegister={() => {
        setLandingNotice(null);
        setError('');
        setCurrentView('register');
      }}
      onSubscribe={handleSubscribePro}
      subscribeState={subscribeState}
      isAuthenticated={authAPI.isAuthenticated()}
      notice={landingNotice}
    />
  );

  const renderLogin = () => (
    <div style={styles.auth.container}>
      <div style={styles.auth.card}>
        <button onClick={() => setCurrentView('landing')} style={styles.auth.backButton}>← Volver</button>
        <div style={styles.auth.logo}>🎓 EvaluAI</div>
        <h1 style={styles.auth.title}>Iniciar sesión</h1>
        {error && <p style={styles.auth.error}>{error}</p>}
        <form style={styles.auth.form} onSubmit={handleLogin}>
          <input type="email" placeholder="Email" style={styles.auth.input}
            value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input type="password" placeholder="Contraseña" style={styles.auth.input}
            value={password} onChange={(e) => setPassword(e.target.value)} required maxLength={MAX_PASSWORD_BYTES} />
          <button type="submit" style={styles.auth.submitButton} disabled={isLoading}>
            {isLoading ? '⏳ Entrando...' : '🚀 Entrar'}
          </button>
        </form>
        <p style={styles.auth.switchText}>¿No tienes cuenta? <button onClick={() => setCurrentView('register')} style={styles.auth.switchLink}>Crear cuenta</button></p>
      </div>
    </div>
  );

  const renderRegister = () => (
    <div style={styles.auth.container}>
      <div style={styles.auth.card}>
        <button onClick={() => setCurrentView('landing')} style={styles.auth.backButton}>← Volver</button>
        <div style={styles.auth.logo}>🎓 EvaluAI</div>
        <h1 style={styles.auth.title}>Crear cuenta</h1>
        {error && <p style={styles.auth.error}>{error}</p>}
        <form style={styles.auth.form} onSubmit={handleRegister}>
          <input type="text" placeholder="Nombre completo" style={styles.auth.input}
            value={nombre} onChange={(e) => setNombre(e.target.value)} required />
          <input type="email" placeholder="Email" style={styles.auth.input}
            value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input type="password" placeholder="Contraseña" style={styles.auth.input}
            value={password} onChange={(e) => setPassword(e.target.value)} required maxLength={MAX_PASSWORD_BYTES} />
          <button type="submit" style={styles.auth.submitButton} disabled={isLoading}>
            {isLoading ? '⏳ Creando cuenta...' : '🚀 Crear cuenta gratis'}
          </button>
        </form>
        <p style={styles.auth.switchText}>¿Ya tienes cuenta? <button onClick={() => setCurrentView('login')} style={styles.auth.switchLink}>Iniciar sesión</button></p>
      </div>
    </div>
  );

  // DASHBOARD PRINCIPAL
  const renderDashboard = () => {
    const isTabletLayout = windowWidth <= 1024;
    const isMobileShellLayout = windowWidth <= 900;
    const operationalSidebarWidth =
      seccionActiva === 'trabajo'
        ? (isLeftPanelOpen ? (isTabletLayout ? 236 : 296) : 68)
        : 0;
    const rightSidebarWidth = isTabletLayout ? 258 : 276;

    const headerCopy = (() => {
      switch (seccionActiva) {
        case 'espacio':
          return {
            title: 'Mi Espacio IB',
            subtitle:
              'Tu workspace docente: organiza guías, exámenes, rúbricas, unidades y referencias por asignatura.',
            compact: false,
          };
        case 'asistente':
          return {
            title: 'Asistente IA',
            subtitle:
              'Espacio amplio para consultas, planeación, actividades y apoyo IB. Independiente del evaluador.',
            compact: true,
          };
        case 'configuracion':
          return {
            title: 'Configuración',
            subtitle: 'Cuenta, contexto local sincronizado en el navegador y atajos al evaluador.',
            compact: false,
          };
        case 'admin':
          return {
            title: 'Administración',
            subtitle: 'Usuarios, créditos y operaciones de cuenta.',
            compact: true,
          };
        case 'trabajo':
        default:
          if (mostrarCentralEvaluator) {
            return {
              title: 'Evaluar',
              subtitle:
                rubricaActiva && currentDocument
                  ? 'Revisa la evaluación, el resumen lateral y exporta cuando estés listo.'
                  : 'Selecciona rúbrica, sube documento y evalúa.',
              compact: false,
            };
          }
          return {
            title: 'Centro de trabajo',
            subtitle: currentDocument
              ? `Documento activo: ${currentDocument.filename}`
              : 'Selecciona una rúbrica, sube un documento y usa el chat para preparar el flujo.',
            compact: false,
          };
      }
    })();

    return (
      <div style={styles.dashboard.container}>
        {billingReturnNotice ? (
          <div
            role="status"
            style={{
              margin: '0 16px 12px',
              padding: '12px 14px',
              borderRadius: 10,
              border: '1px solid rgba(148,163,184,0.35)',
              background:
                billingReturnNotice.variant === 'success'
                  ? 'rgba(16,185,129,0.12)'
                  : billingReturnNotice.variant === 'error'
                    ? 'rgba(248,113,113,0.12)'
                    : 'rgba(59,130,246,0.12)',
              color: '#e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              gap: 12,
              alignItems: 'flex-start',
            }}
          >
            <div>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>{billingReturnNotice.title}</div>
              <div style={{ fontSize: 14, opacity: 0.95 }}>{billingReturnNotice.body}</div>
            </div>
            <button
              type="button"
              onClick={() => setBillingReturnNotice(null)}
              style={{
                flexShrink: 0,
                border: 'none',
                background: 'rgba(15,23,42,0.45)',
                color: '#e2e8f0',
                borderRadius: 8,
                padding: '6px 10px',
                cursor: 'pointer',
              }}
            >
              Cerrar
            </button>
          </div>
        ) : null}
        {isMobileShellLayout && isMobileShellNavOpen ? (
          <div
            className="evaluai-shell-nav-backdrop"
            onClick={() => setIsMobileShellNavOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(2,6,23,0.62)',
              zIndex: 1200,
            }}
            aria-hidden="true"
          />
        ) : null}

        <SidebarNav
          layout={isMobileShellLayout ? 'drawer' : 'desktop'}
          drawerOpen={isMobileShellNavOpen}
          onCloseDrawer={() => setIsMobileShellNavOpen(false)}
          collapsed={isMobileShellLayout ? false : isMainNavCollapsed}
          onToggleCollapsed={
            isMobileShellLayout ? undefined : () => setIsMainNavCollapsed((v) => !v)
          }
          activeSection={seccionActiva}
          showAdmin={isUserRoleAdmin(user)}
          onSelectSection={(id) => {
            setSeccionActiva(id);
            if (isMobileShellLayout) setIsMobileShellNavOpen(false);
          }}
        />

        {seccionActiva === 'trabajo' ? (
      <div style={{ ...styles.dashboard.sidebar, width: `${operationalSidebarWidth}px`, minWidth: `${operationalSidebarWidth}px`, flex: '0 0 auto' }}>
        <input
          type="file"
          className="hidden"
          accept=".docx,.pdf,.txt"
          ref={sidebarFileInputRef}
          onChange={(e) => {
            console.log('[🖱️ SIDEBAR CLICK] Input file detectó cambio');
            const file = e.target.files?.[0];
            if (file) {
              console.log('[🖱️ SIDEBAR CLICK] Archivo seleccionado:', file.name);
              handleUploadDocument(file);
            }
          }}
          style={{display: 'none'}}
        />

        {isLeftPanelOpen ? (
          <>
            <div style={styles.dashboard.sidebarHeader}>
              <div style={styles.dashboard.sidebarBrandRow}>
                <div style={{ ...styles.dashboard.sidebarBrand, fontSize: 15 }}>⚡ Acciones</div>
                <button
                  onClick={() => setIsLeftPanelOpen(false)}
                  style={styles.dashboard.sidebarCollapseButton}
                  title="Contraer panel de acciones"
                >
                  ◀
                </button>
              </div>
              <div style={styles.dashboard.navTabs} role="tablist" aria-label="Panel operativo de Evaluar">
                <button 
                  type="button"
                  role="tab"
                  aria-selected={vistaPanel === 'chat'}
                  style={{...styles.dashboard.navTab, ...(vistaPanel === 'chat' ? styles.dashboard.navTabActive : {})}}
                  onClick={() => setVistaPanel('chat')}
                >💬 Flujo</button>
                <button 
                  type="button"
                  role="tab"
                  aria-selected={vistaPanel === 'rubricas'}
                  style={{...styles.dashboard.navTab, ...(vistaPanel === 'rubricas' ? styles.dashboard.navTabActive : {})}}
                  onClick={() => setVistaPanel('rubricas')}
                >📋 Rúbricas</button>
              </div>
            </div>

            <div style={styles.dashboard.sidebarContent}>
              {vistaPanel === 'rubricas' ? (
                <div>
                  {rubricas?.length === 0 ? (
                    <div style={{padding: '20px', color: 'rgba(255,255,255,0.78)', textAlign: 'center'}}>
                      <p style={{marginBottom: '12px', fontSize: '14px'}}>📋 No hay rúbricas guardadas</p>
                      <p style={{fontSize: '13px', opacity: 0.85, lineHeight: 1.5}}>
                        Puedes usar el chat o crearla manualmente
                      </p>
                      <button onClick={openNewRubricEditor} style={{marginTop: '16px', background: '#3b82f6', color: 'white', border: 'none', padding: '10px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '13.5px', width: '100%', fontWeight: '600'}}>
                        ✏️ Crear en Editor
                      </button>
                    </div>
                  ) : (
                    <div>
                      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px'}}>
                        <h4 style={{...styles.dashboard.sidebarTitle, color: '#e2e8f0', margin: 0}}>Mis Rúbricas ({rubricas?.length || 0})</h4>
                        <button onClick={openNewRubricEditor} style={{background: 'rgba(59,130,246,0.18)', color: '#bfdbfe', border: '1px solid rgba(59,130,246,0.4)', padding: '6px 10px', borderRadius: '7px', cursor: 'pointer', fontSize: '12.5px', fontWeight: 600}} title="Nueva rúbrica">➕ Agregar</button>
                      </div>
                      {rubricas.map((r, idx) => (
                        <div 
                          key={idx}
                          onClick={() => syncRubricConfig(r)}
                          style={{
                            padding: '13px 14px',
                            marginBottom: '8px',
                            background: rubricaActiva?.id === r.id ? 'rgba(59,130,246,0.2)' : 'rgba(15,23,42,0.45)',
                            borderRadius: '10px',
                            cursor: 'pointer',
                            border: rubricaActiva?.id === r.id ? '1px solid rgba(96,165,250,0.7)' : '1px solid rgba(148,163,184,0.18)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                        >
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{color: '#f8fafc', fontWeight: 600, fontSize: '14.5px', lineHeight: 1.45, overflowWrap: 'anywhere', wordBreak: 'break-word'}}>{r.nombre || r.title || 'Rúbrica sin nombre'}</div>
                            <div style={{color: 'rgba(226,232,240,0.75)', fontSize: '12.5px', marginTop: '2px'}}>{r.asignatura || 'Sin asignatura'}</div>
                          </div>
                          <button 
                            onClick={(e) => eliminarRubrica(e, r.id)}
                            style={{background: 'transparent', border: 'none', color: 'rgba(252,165,165,0.95)', cursor: 'pointer', padding: '4px'}}
                            title="Eliminar rúbrica"
                          >
                            🗑️
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  {/* Paso 1 · Rúbrica Activa */}
                  <div style={styles.dashboard.sidebarSection}>
                    <div style={styles.dashboard.sidebarStepHeader}>
                      <span style={styles.dashboard.sidebarStepBadge}>1</span>
                      <h4 style={{...styles.dashboard.sidebarTitle, margin: 0}}>Rúbrica activa</h4>
                    </div>
                    {rubricaActiva ? (
                      <div style={{padding: '14px 16px', background: 'rgba(30,41,59,0.78)', borderRadius: '12px', border: '1px solid rgba(99,102,241,0.45)', boxShadow: '0 1px 0 rgba(148,163,184,0.05) inset'}}>
                        <div style={{display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px'}}>
                          <span style={{fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#a5b4fc', fontWeight: 700}}>● En uso</span>
                        </div>
                        <div style={{color: '#f8fafc', fontWeight: 600, fontSize: '14.5px', lineHeight: 1.4, overflowWrap: 'anywhere', wordBreak: 'break-word'}}>{rubricaActiva.nombre || rubricaActiva.title}</div>
                        <div style={{color: 'rgba(203,213,225,0.82)', fontSize: '12.5px', marginTop: '3px'}}>
                          {rubricaActiva.asignatura || 'Sin asignatura'}
                        </div>
                        <div style={{display: 'flex', gap: '6px', marginTop: '12px'}}>
                          <button onClick={() => setMostrarEditorRubrica(true)} style={{flex: 1, background: 'rgba(99,102,241,0.18)', color: '#c7d2fe', border: '1px solid rgba(129,140,248,0.5)', padding: '8px 10px', borderRadius: '8px', cursor: 'pointer', fontSize: '12.5px', fontWeight: 600}}>
                            ✏️ Editar
                          </button>
                          <button onClick={() => setVistaPanel('rubricas')} style={{flex: 1, background: 'rgba(15,23,42,0.7)', color: '#cbd5e1', border: '1px solid rgba(148,163,184,0.28)', padding: '8px 10px', borderRadius: '8px', cursor: 'pointer', fontSize: '12.5px', fontWeight: 500}}>
                            Cambiar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{padding: '16px', background: 'rgba(15,23,42,0.58)', borderRadius: '12px', border: '1px dashed rgba(148,163,184,0.35)'}}>
                        <p style={{color: 'rgba(226,232,240,0.88)', fontSize: '13.5px', margin: 0, lineHeight: 1.5}}>
                          Elige una rúbrica de la lista o crea una nueva para empezar.
                        </p>
                        <div style={{display: 'flex', gap: '6px', marginTop: '12px'}}>
                          <button onClick={openNewRubricEditor} style={{flex: 1, background: '#3b82f6', color: 'white', border: 'none', padding: '9px 10px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600}}>
                            ➕ Crear rúbrica
                          </button>
                          <button onClick={() => setVistaPanel('rubricas')} style={{flex: 1, background: 'rgba(30,41,59,0.7)', color: '#e2e8f0', border: '1px solid rgba(148,163,184,0.3)', padding: '9px 10px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px'}}>
                            Ver lista
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Paso 2 · Subir documento */}
                  <div style={styles.dashboard.sidebarSection}>
                    <div style={styles.dashboard.sidebarStepHeader}>
                      <span style={styles.dashboard.sidebarStepBadge}>2</span>
                      <h4 style={{...styles.dashboard.sidebarTitle, margin: 0}}>Subir documento</h4>
                    </div>
                    <button
                      style={{...styles.dashboard.sidebarButton, background: '#3b82f6', borderColor: 'rgba(59,130,246,0.75)', fontWeight: 600, textAlign: 'center', opacity: isUploading ? 0.7 : 1}}
                      onClick={() => {
                        console.log('[🖱️ SIDEBAR CLICK] Botón "Subir documento" clickeado');
                        sidebarFileInputRef.current?.click();
                      }}
                      disabled={isUploading}
                    >
                      {isUploading ? '⏳ Subiendo...' : '📄 Subir .docx / .pdf / .txt'}
                    </button>
                    <p style={{fontSize: '12.5px', color: 'rgba(148,163,184,0.92)', margin: '10px 2px 0 2px', lineHeight: 1.5}}>
                      Extracción automática de contenido
                    </p>
                  </div>

                  {/* Paso 3 · Documento actual (sólo cuando existe) */}
                  {currentDocument && (
                    <div style={styles.dashboard.sidebarSection}>
                      <div style={styles.dashboard.sidebarStepHeader}>
                        <span style={{...styles.dashboard.sidebarStepBadge, background: 'rgba(34,197,94,0.18)', borderColor: 'rgba(74,222,128,0.5)', color: '#bbf7d0'}}>3</span>
                        <h4 style={{...styles.dashboard.sidebarTitle, margin: 0}}>Documento actual</h4>
                      </div>
                      <div style={{padding: '14px 16px', background: 'rgba(22,163,74,0.16)', borderRadius: '12px', border: '1px solid rgba(74,222,128,0.32)'}}>
                        <div style={{color: '#f8fafc', fontWeight: 600, fontSize: '14px', lineHeight: 1.45, overflowWrap: 'anywhere', wordBreak: 'break-word'}}>{currentDocument.filename}</div>
                        <div style={{color: 'rgba(220,252,231,0.88)', fontSize: '12.5px', marginTop: '3px'}}>
                          {currentDocument.paragraphs?.length || 0} párrafos
                        </div>
                        <button
                          onClick={() => {
                            setMostrarCentralEvaluator(true);
                            setSeccionActiva('trabajo');
                          }}
                          style={{
                            marginTop: '12px',
                            width: '100%',
                            padding: '10px',
                            background: '#22c55e',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontWeight: 600
                          }}
                        >
                          📝 Abrir en Evaluar
                        </button>
                        <button
                          onClick={resetSystem}
                          style={{
                            marginTop: '6px',
                            width: '100%',
                            padding: '8px',
                            background: 'transparent',
                            color: 'rgba(252,165,165,0.95)',
                            border: '1px solid rgba(252,165,165,0.35)',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '12.5px',
                            fontWeight: 500
                          }}
                          title="Limpiar evaluación actual. La rúbrica se conserva."
                        >
                          Limpiar / Nuevo trabajo
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

          </>
        ) : (
          <div style={styles.dashboard.sidebarRail}>
            <button
              onClick={() => setIsLeftPanelOpen(true)}
              style={styles.dashboard.sidebarRailButton}
              title="Expandir panel"
            >
              ▶
            </button>
            <button
              onClick={() => setVistaPanel('chat')}
              style={styles.dashboard.sidebarRailButton}
              title="Flujo"
            >
              💬
            </button>
            <button
              onClick={() => setVistaPanel('rubricas')}
              style={styles.dashboard.sidebarRailButton}
              title="Rúbricas"
            >
              📋
            </button>
            <button
              onClick={() => sidebarFileInputRef.current?.click()}
              style={styles.dashboard.sidebarRailButton}
              title="Subir documento"
              disabled={isUploading}
            >
              📄
            </button>
          </div>
        )}
      </div>
        ) : null}

      {/* Main Content */}
      <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <TopBar
          title={headerCopy.title}
          subtitle={headerCopy.subtitle}
          compact={headerCopy.compact}
          creditsBalance={user?.credits_balance ?? 0}
          showMobileNavButton={isMobileShellLayout}
          onOpenMobileNav={() => setIsMobileShellNavOpen(true)}
          showOperationalToggle={seccionActiva === 'trabajo'}
          operationalPanelOpen={isLeftPanelOpen}
          onToggleOperationalPanel={() => setIsLeftPanelOpen((prev) => !prev)}
        />
        {seccionActiva === 'espacio' ? (
          <MiEspacioIB
            asignaturasSugeridas={asignaturas}
            rubricas={rubricas}
            onAbrirPanelRubricas={() => {
              setSeccionActiva('trabajo');
              setVistaPanel('rubricas');
              setIsLeftPanelOpen(true);
            }}
            onCrearRubrica={openNewRubricEditor}
            onUploadDocument={handleUploadDocumentoEspacio}
            onDeleteDocument={handleDeleteDocumentoEspacio}
          />
        ) : seccionActiva === 'asistente' ? (
          <AsistenteIA rubricaActiva={rubricaActiva} />
        ) : seccionActiva === 'configuracion' ? (
          <SettingsView
            user={user}
            teacherContextPack={teacherContextPack}
            onLogout={handleLogout}
            onOpenEvaluarFlujo={() => {
              setSeccionActiva('trabajo');
              setVistaPanel('chat');
              setIsLeftPanelOpen(true);
            }}
            onOpenEvaluarRubricas={() => {
              setSeccionActiva('trabajo');
              setVistaPanel('rubricas');
              setIsLeftPanelOpen(true);
            }}
            onOpenNewRubricEditor={openNewRubricEditor}
          />
        ) : seccionActiva === 'admin' && isUserRoleAdmin(user) ? (
          <AdminDashboard />
        ) : mostrarCentralEvaluator ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'row',
              height: '100%',
              minHeight: 0,
              position: 'relative',
              overflow: 'hidden',
              background: '#0b1220',
            }}
          >
            <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
              {isEvaluarTopChromeExpanded ? (
                <div style={styles.dashboard.evaluatorToolbar}>
                  <div style={styles.dashboard.evaluatorContextGroup}>
                    <div style={{
                      ...styles.dashboard.evaluatorChip,
                      ...(rubricaActiva ? styles.dashboard.evaluatorChipRubric : styles.dashboard.evaluatorChipMuted)
                    }}>
                      <span style={styles.dashboard.evaluatorChipLabel}>Rúbrica</span>
                      <span style={styles.dashboard.evaluatorChipValue}>
                        {rubricaActiva ? (rubricaActiva.nombre || rubricaActiva.title) : 'Sin seleccionar'}
                      </span>
                    </div>
                    <div style={{
                      ...styles.dashboard.evaluatorChip,
                      ...(currentDocument ? styles.dashboard.evaluatorChipDoc : styles.dashboard.evaluatorChipMuted)
                    }}>
                      <span style={styles.dashboard.evaluatorChipLabel}>Documento</span>
                      <span style={styles.dashboard.evaluatorChipValue}>
                        {currentDocument ? currentDocument.filename : 'Ninguno cargado'}
                      </span>
                    </div>
                  </div>
                  <div style={styles.dashboard.evaluatorActionsGroup}>
                    <button
                      type="button"
                      onClick={() => setIsEvaluarTopChromeExpanded(false)}
                      style={styles.dashboard.evaluatorActionGhost}
                      title="Ocultar barras superiores y ampliar el área del documento"
                    >
                      ▲ Ocultar barra
                    </button>
                    <button
                      onClick={() => setMostrarBatch(true)}
                      style={styles.dashboard.evaluatorActionPrimary}
                      title="Evaluar hasta 10 documentos a la vez"
                    >
                      ⚡ Evaluación por lotes
                    </button>
                    <div style={styles.dashboard.evaluatorActionsDivider} aria-hidden="true" />
                    <button
                      onClick={() => setIsRightPanelOpen((open) => !open)}
                      style={{
                        ...styles.dashboard.evaluatorActionGhost,
                        ...(isRightPanelOpen ? {} : styles.dashboard.evaluatorActionGhostActive)
                      }}
                      title={isRightPanelOpen ? 'Ocultar resumen de evaluación' : 'Mostrar resumen de evaluación'}
                    >
                      📋 {isRightPanelOpen ? 'Ocultar resumen' : 'Mostrar resumen'}
                    </button>
                    <button
                      onClick={resetSystem}
                      title="Limpiar evaluación actual y comenzar con un nuevo trabajo. La rúbrica activa se mantiene."
                      style={styles.dashboard.evaluatorActionDanger}
                    >
                      🗑️ Nuevo trabajo
                    </button>
                    <button
                      onClick={() => setMostrarCentralEvaluator(false)}
                      style={styles.dashboard.evaluatorActionGhost}
                      title="Volver al chat principal"
                    >
                      ← Chat
                    </button>
                  </div>
                </div>
              ) : (
                <div style={styles.dashboard.evaluatorChromeCollapsedBar}>
                  <button
                    type="button"
                    onClick={() => setIsEvaluarTopChromeExpanded(true)}
                    style={styles.dashboard.evaluatorChromeCollapsedButton}
                    title="Mostrar de nuevo rúbrica, documento y acciones rápidas"
                  >
                    ▼ Mostrar barra de acciones
                  </button>
                  <span style={styles.dashboard.evaluatorChromeCollapsedHint} aria-hidden="true">
                    {currentDocument?.filename
                      ? String(currentDocument.filename).slice(0, 42) + (String(currentDocument.filename).length > 42 ? '…' : '')
                      : 'Sin documento'}
                  </span>
                </div>
              )}
              <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                <CentralEvaluator 
                  document={currentDocument}
                  rubric={rubricaActiva}
                  methodologyConfig={configuracionMetodologia}
                  evaluationHtml={evaluacionResultado?.evaluation}
                  onUploadDocument={handleUploadDocument}
                  onEvaluateDocument={currentDocument && rubricaActiva ? handleEvaluarDocumento : null}
                  onDownloadEvaluation={() => window.print()}
                  onDeleteDocument={resetSystem}
                  isLoading={isUploading || isEvaluando}
                  canEvaluate={!!(currentDocument && rubricaActiva)}
                  onTextSelected={handleTextSelected}
                  onAddExternalFootnote={externalFootnoteRef}
                  onFootnotesChange={setCurrentFootnotes}
                  suppressPrimaryToolbar={!isEvaluarTopChromeExpanded}
                />
              </div>
            </div>

            {/* Panel derecho: resumen de esta evaluación (sin analítica histórica) */}
            <div
              style={{
                width: isRightPanelOpen ? `${rightSidebarWidth}px` : '0px',
                minWidth: isRightPanelOpen ? `${rightSidebarWidth}px` : '0px',
                flex: '0 0 auto',
                minHeight: 0,
                borderLeft: isRightPanelOpen ? '1px solid rgba(148,163,184,0.09)' : 'none',
                background: 'rgba(15,23,42,0.72)',
                color: 'white',
                overflow: 'hidden',
                opacity: isRightPanelOpen ? 1 : 0,
                transition: 'width 0.22s ease, min-width 0.22s ease, opacity 0.18s ease',
                pointerEvents: isRightPanelOpen ? 'auto' : 'none',
              }}
            >
              <div style={{ width: `${rightSidebarWidth}px`, height: '100%', display: 'flex', flexDirection: 'column' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderBottom: '1px solid rgba(148,163,184,0.07)',
                  background: 'transparent'
                }}>
                  <div style={{
                    fontSize: '11px',
                    letterSpacing: '0.07em',
                    textTransform: 'uppercase',
                    color: 'rgba(203,213,225,0.72)',
                    fontWeight: 700
                  }}>
                    Resumen
                  </div>
                  <button
                    onClick={() => setIsRightPanelOpen(false)}
                    title="Ocultar panel"
                    style={{
                      background: 'transparent',
                      border: '1px solid rgba(148,163,184,0.2)',
                      color: 'rgba(203,213,225,0.9)',
                      width: '26px',
                      height: '26px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      lineHeight: 1
                    }}
                  >
                    ✕
                  </button>
                </div>
                <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
                  <EvaluationSummaryPanel
                    evaluacionResultado={evaluacionResultado}
                    currentFootnotes={currentFootnotes}
                    currentDocument={currentDocument}
                    isEvaluando={isEvaluando}
                  />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div style={styles.dashboard.chatContainer}>
            <ChatPrincipal 
              asignaturas={asignaturas}
              onGuardarRubrica={guardarRubricaDesdeChat}
              rubricaActiva={rubricaActiva}
              onRubricaActualizada={cargarRubricas}
              setRubricaActiva={setRubricaActiva}
              setRubricas={setRubricas}
              onAbrirEditor={(markdownDraft) => {
                openDraftRubricEditor(markdownDraft);
              }}
            />
          </div>
        )}
      </div>
      </div>
    );
  };

  return (
    <div style={{ minHeight: '100vh', height: currentView === 'dashboard' ? '100%' : 'auto', overflow: currentView === 'dashboard' ? 'hidden' : 'visible', background: '#0f172a' }}>
      {currentView === 'landing' && renderLanding()}
      {currentView === 'login' && renderLogin()}
      {currentView === 'register' && renderRegister()}
      {currentView === 'dashboard' && renderDashboard()}

      {/* GLOBAL CHAT BUBBLE — visible en dashboard excepto Asistente IA (dos chats)
          y Configuración (menos ruido). Contexto docente via `useTeacherContextPack` en ChatBubble. */}
      {currentView === 'dashboard' && seccionActiva !== 'asistente' && seccionActiva !== 'configuracion' && (
        <ChatBubble
          key={evaluacionSessionId}
          rubricaActiva={rubricaActiva}
          currentDocument={currentDocument}
          selectedText={selectedText}
          onLoadDocument={handleUploadDocument}
          onAddFootnote={handleAddFootnoteFromChat}
          onClearSelectedText={handleClearSelectedText}
          onOpenRubricEditor={openDraftRubricEditor}
        />
      )}

      {/* MODAL BATCH PROCESSOR */}
      {mostrarBatch && (
        <BatchProcessor
          rubricaActiva={rubricaActiva}
          methodologyConfig={configuracionMetodologia}
          onClose={() => setMostrarBatch(false)}
        />
      )}

      {/* MODAL EDITOR DE RÚBRICA */}
      {mostrarEditorRubrica && (
        <div style={{position: 'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(2,6,23,0.78)', zIndex:1400, display:'flex', alignItems:'center', justifyContent:'center', padding: '20px'}}>
          <div style={{background: '#111827', width: '100%', height: '100%', borderRadius: '12px', overflow: 'hidden'}}>
            <EditorMarkdown 
              rubrica={rubricaActiva} 
              onGuardar={async (rubricaData) => {
                const markdownExtraido = rubricaData.markdownOriginal || rubricaData.markdown;
                const req = await guardarRubricaDesdeChat(
                  markdownExtraido, 
                  rubricaData.nombre, 
                  rubricaData.asignatura,
                  {
                    metodologiaEvaluacion: rubricaData.metodologiaEvaluacion || configuracionMetodologia.metodologiaEvaluacion,
                    instruccionIA: rubricaData.instruccionIA || '',
                  }
                );
                if (req.success) {
                  alert('✅ ¡Rúbrica guardada exitosamente!');
                  setMostrarEditorRubrica(false);
                } else {
                  alert('❌ Falló al guardar: ' + req.error);
                }
              }}
              onCancelar={() => setMostrarEditorRubrica(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== ESTILOS ====================
const styles = {
  landing: {
    container: { 
      fontFamily: "'Inter', system-ui, sans-serif", 
      background: '#0f0f23', 
      minHeight: '100vh', 
      color: '#fff' 
    },
    navbar: { 
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'center', 
      padding: '20px 48px', 
      background: 'rgba(15, 15, 35, 0.95)', 
      backdropFilter: 'blur(20px)', 
      borderBottom: '1px solid rgba(255,255,255,0.1)', 
      position: 'sticky', 
      top: 0, 
      zIndex: 100 
    },
    navLogo: { 
      fontSize: '28px', 
      fontWeight: '800', 
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
      WebkitBackgroundClip: 'text', 
      WebkitTextFillColor: 'transparent' 
    },
    navLinks: { 
      display: 'flex', 
      alignItems: 'center', 
      gap: '16px' 
    },
    navButtonSecondary: { 
      background: 'transparent', 
      color: '#fff', 
      border: '1.5px solid rgba(255,255,255,0.2)', 
      padding: '10px 20px', 
      borderRadius: '8px', 
      cursor: 'pointer', 
      fontSize: '14px', 
      fontWeight: '600' 
    },
    navButtonPrimary: { 
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
      color: '#fff', 
      border: 'none', 
      padding: '10px 24px', 
      borderRadius: '8px', 
      cursor: 'pointer', 
      fontSize: '14px', 
      fontWeight: '600' 
    },
    hero: { 
      padding: '100px 48px 80px',
      background: 'radial-gradient(ellipse at center, #1a1a3e 0%, #0f0f23 70%)'
    },
    heroContent: {
      maxWidth: '800px',
      margin: '0 auto',
      textAlign: 'center'
    },
    heroTitle: { 
      fontSize: '64px', 
      fontWeight: '800', 
      marginBottom: '24px',
      lineHeight: 1.1
    },
    heroSubtitle: { 
      fontSize: '20px', 
      marginBottom: '40px', 
      color: '#a0a0b0',
      lineHeight: 1.6
    },
    heroButtons: {
      display: 'flex',
      gap: '16px',
      justifyContent: 'center'
    },
    heroCTAPrimary: { 
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
      color: '#fff', 
      border: 'none', 
      padding: '18px 40px', 
      borderRadius: '12px', 
      fontSize: '18px', 
      fontWeight: '700', 
      cursor: 'pointer'
    },
  },
  auth: {
    container: { 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      background: '#0f0f23', 
      padding: '20px' 
    },
    card: { 
      background: 'rgba(255,255,255,0.03)', 
      border: '1px solid rgba(255,255,255,0.08)', 
      borderRadius: '20px', 
      padding: '48px', 
      width: '100%', 
      maxWidth: '420px',
      position: 'relative'
    },
    backButton: { 
      position: 'absolute', 
      top: '24px', 
      left: '24px', 
      background: 'none', 
      border: 'none', 
      color: '#808090', 
      cursor: 'pointer',
      fontSize: '14px'
    },
    logo: { 
      textAlign: 'center', 
      fontSize: '48px', 
      marginBottom: '16px' 
    },
    title: { 
      fontSize: '28px', 
      fontWeight: '700', 
      color: '#fff', 
      textAlign: 'center', 
      marginBottom: '24px' 
    },
    error: { 
      color: '#ef4444', 
      textAlign: 'center', 
      marginBottom: '16px', 
      fontSize: '14px' 
    },
    form: { 
      display: 'flex', 
      flexDirection: 'column', 
      gap: '16px' 
    },
    input: { 
      padding: '16px', 
      background: 'rgba(255,255,255,0.05)', 
      border: '1px solid rgba(255,255,255,0.1)', 
      borderRadius: '10px', 
      fontSize: '16px', 
      color: '#fff', 
      outline: 'none' 
    },
    submitButton: { 
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
      color: '#fff', 
      border: 'none', 
      padding: '16px', 
      borderRadius: '10px', 
      fontSize: '16px', 
      fontWeight: '700', 
      cursor: 'pointer'
    },
    switchText: { 
      textAlign: 'center', 
      fontSize: '14px', 
      color: '#808090', 
      marginTop: '24px' 
    },
    switchLink: { 
      color: '#a5b4fc', 
      fontWeight: '600', 
      background: 'none', 
      border: 'none', 
      cursor: 'pointer' 
    },
  },
  dashboard: {
    container: {
      display: 'flex',
      minHeight: '100vh',
      height: '100vh',
      overflow: 'hidden',
      background: 'linear-gradient(180deg, #0f172a 0%, #020617 100%)',
      fontFamily: "'Inter', system-ui, sans-serif"
    },
    sidebar: {
      width: '320px',
      background: 'rgba(2,6,23,0.82)',
      borderRight: '1px solid rgba(148,163,184,0.2)',
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0,
      transition: 'width 0.2s ease, min-width 0.2s ease'
    },
    sidebarHeader: {
      padding: '14px 16px 16px',
      borderBottom: '1px solid rgba(148,163,184,0.2)'
    },
    sidebarBrandRow: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: '12px'
    },
    sidebarBrand: {
      fontSize: '17px',
      fontWeight: '800',
      color: '#f8fafc',
      letterSpacing: '0.2px'
    },
    sidebarCollapseButton: {
      background: 'rgba(148,163,184,0.16)',
      border: '1px solid rgba(148,163,184,0.35)',
      color: '#e2e8f0',
      borderRadius: '8px',
      width: '32px',
      height: '30px',
      cursor: 'pointer',
      fontSize: '13px'
    },
    navTabs: {
      display: 'flex',
      gap: '8px',
      background: 'rgba(15,23,42,0.7)',
      padding: '4px',
      borderRadius: '10px'
    },
    navTab: {
      flex: 1,
      padding: '10px 8px',
      background: 'transparent',
      border: 'none',
      borderRadius: '8px',
      color: 'rgba(203,213,225,0.78)',
      cursor: 'pointer',
      fontSize: '14.5px',
      fontWeight: '500'
    },
    navTabActive: {
      background: 'rgba(59,130,246,0.18)',
      color: '#dbeafe'
    },
    sidebarContent: {
      flex: 1,
      minHeight: 0,
      overflowY: 'auto',
      padding: '18px 17px'
    },
    sidebarSection: {
      marginBottom: '26px'
    },
    sidebarTitle: {
      fontSize: '12.5px',
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
      color: 'rgba(203,213,225,0.92)',
      marginBottom: '12px',
      fontWeight: '700'
    },
    sidebarStepHeader: {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      marginBottom: '12px'
    },
    sidebarStepBadge: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '22px',
      height: '22px',
      borderRadius: '999px',
      background: 'rgba(99,102,241,0.22)',
      border: '1px solid rgba(129,140,248,0.5)',
      color: '#c7d2fe',
      fontSize: '12px',
      fontWeight: 700,
      lineHeight: 1
    },
    sidebarButton: {
      width: '100%',
      padding: '13px 16px',
      background: 'rgba(15,23,42,0.7)',
      border: '1px solid rgba(148,163,184,0.25)',
      borderRadius: '10px',
      color: '#fff',
      cursor: 'pointer',
      fontSize: '14.5px',
      textAlign: 'left',
      transition: 'all 0.2s'
    },
    sidebarFooter: {
      padding: '16px 17px 18px',
      borderTop: '1px solid rgba(148,163,184,0.2)'
    },
    sidebarRail: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '10px',
      padding: '12px 10px',
      height: '100%'
    },
    sidebarRailButton: {
      width: '42px',
      height: '40px',
      borderRadius: '10px',
      border: '1px solid rgba(148,163,184,0.28)',
      background: 'rgba(15,23,42,0.75)',
      color: '#e2e8f0',
      cursor: 'pointer',
      fontSize: '17px'
    },
    logoutBtn: {
      marginTop: '12px',
      width: '100%',
      padding: '10px 12px',
      background: 'rgba(127, 29, 29, 0.35)',
      border: '1px solid rgba(248, 113, 113, 0.6)',
      borderRadius: '8px',
      color: '#fecaca',
      cursor: 'pointer',
      fontSize: '13.5px',
      fontWeight: 500
    },
    topHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: '16px',
      padding: '13px 22px 14px',
      borderBottom: '1px solid rgba(148,163,184,0.14)',
      background: 'rgba(2,6,23,0.72)',
      backdropFilter: 'blur(6px)'
    },
    topHeaderCompact: {
      padding: '9px 20px 10px',
      alignItems: 'center',
    },
    topHeaderTitle: {
      margin: 0,
      color: '#f8fafc',
      fontSize: '18.5px',
      fontWeight: '700',
      letterSpacing: '-0.01em'
    },
    topHeaderTitleCompact: {
      fontSize: '17px',
      fontWeight: 700,
    },
    topHeaderSubtitle: {
      margin: '6px 0 0 0',
      color: 'rgba(203,213,225,0.8)',
      fontSize: '13.5px',
      lineHeight: 1.5,
      maxWidth: 'min(720px, 100%)',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    },
    topHeaderSubtitleCompact: {
      margin: '3px 0 0 0',
      fontSize: '12.5px',
      lineHeight: 1.4,
      maxWidth: 'min(640px, 100%)',
    },
    topHeaderActions: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      flexWrap: 'wrap',
      justifyContent: 'flex-end',
    },
    topHeaderButton: {
      border: '1px solid rgba(148,163,184,0.35)',
      background: 'rgba(15,23,42,0.76)',
      color: '#e2e8f0',
      borderRadius: '8px',
      padding: '8px 12px',
      fontSize: '13px',
      fontWeight: '500',
      cursor: 'pointer'
    },
    sectionSwitch: {
      display: 'inline-flex',
      padding: '3px',
      borderRadius: '11px',
      border: '1px solid rgba(148,163,184,0.18)',
      background: 'rgba(2,6,23,0.55)',
      gap: '3px'
    },
    sectionSwitchButton: {
      padding: '8px 14px',
      border: 'none',
      background: 'transparent',
      color: 'rgba(203,213,225,0.78)',
      borderRadius: '8px',
      fontSize: '13px',
      fontWeight: 600,
      cursor: 'pointer',
      letterSpacing: '0.01em',
      transition: 'background 160ms ease, color 160ms ease'
    },
    sectionSwitchButtonActive: {
      background: 'linear-gradient(135deg, rgba(99,102,241,0.28) 0%, rgba(139,92,246,0.28) 100%)',
      color: '#e0e7ff',
      boxShadow: 'inset 0 0 0 1px rgba(129,140,248,0.45)'
    },
    topHeaderButtonAccent: {
      borderColor: 'rgba(56,189,248,0.45)',
      color: '#bae6fd',
      background: 'rgba(14,116,144,0.2)'
    },
    chatContainer: {
      flex: 1,
      minHeight: 0,
      overflow: 'hidden',
      background: '#0b1220',
      borderTop: '1px solid rgba(148,163,184,0.12)'
    },
    evaluatorToolbar: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '10px 16px',
      borderBottom: '1px solid rgba(148,163,184,0.12)',
      flexWrap: 'wrap',
      gap: '10px 14px',
      background: 'rgba(15,23,42,0.78)',
      backdropFilter: 'blur(4px)'
    },
    evaluatorContextGroup: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      flexWrap: 'wrap',
      minWidth: 0
    },
    evaluatorChip: {
      display: 'inline-flex',
      flexDirection: 'column',
      gap: '2px',
      padding: '6px 12px',
      borderRadius: '10px',
      border: '1px solid rgba(148,163,184,0.2)',
      background: 'rgba(15,23,42,0.65)',
      maxWidth: '260px',
      lineHeight: 1.3
    },
    evaluatorChipLabel: {
      fontSize: '11px',
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      color: 'rgba(203,213,225,0.9)',
      fontWeight: 700
    },
    evaluatorChipValue: {
      fontSize: '13px',
      color: '#f1f5f9',
      fontWeight: 600,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      maxWidth: '240px'
    },
    evaluatorChipRubric: {
      borderColor: 'rgba(129,140,248,0.5)',
      background: 'rgba(67,56,202,0.22)'
    },
    evaluatorChipDoc: {
      borderColor: 'rgba(74,222,128,0.4)',
      background: 'rgba(22,163,74,0.18)'
    },
    evaluatorChipMuted: {
      opacity: 0.7,
      borderStyle: 'dashed'
    },
    evaluatorActionsGroup: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      flexWrap: 'wrap',
      justifyContent: 'flex-end'
    },
    evaluatorActionPrimary: {
      padding: '8px 14px',
      background: 'linear-gradient(135deg, rgba(99,102,241,0.35) 0%, rgba(139,92,246,0.35) 100%)',
      color: '#e0e7ff',
      border: '1px solid rgba(129,140,248,0.55)',
      borderRadius: '9px',
      cursor: 'pointer',
      fontSize: '13.5px',
      fontWeight: 700,
      letterSpacing: '0.01em'
    },
    evaluatorActionsDivider: {
      width: '1px',
      height: '24px',
      background: 'rgba(148,163,184,0.25)',
      margin: '0 2px'
    },
    evaluatorActionGhost: {
      padding: '7px 12px',
      background: 'transparent',
      color: 'rgba(226,232,240,0.88)',
      border: '1px solid rgba(148,163,184,0.22)',
      borderRadius: '8px',
      cursor: 'pointer',
      fontSize: '12.5px',
      fontWeight: 500
    },
    evaluatorActionGhostActive: {
      color: '#bae6fd',
      borderColor: 'rgba(56,189,248,0.45)',
      background: 'rgba(14,116,144,0.18)'
    },
    evaluatorActionDanger: {
      padding: '7px 12px',
      background: 'transparent',
      color: 'rgba(252,165,165,0.92)',
      border: '1px solid rgba(239,68,68,0.32)',
      borderRadius: '8px',
      cursor: 'pointer',
      fontSize: '12.5px',
      fontWeight: 500
    },
    evaluatorChromeCollapsedBar: {
      flexShrink: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '14px',
      flexWrap: 'wrap',
      padding: '6px 12px',
      borderBottom: '1px solid rgba(148,163,184,0.12)',
      background: 'rgba(15,23,42,0.92)',
      minHeight: '36px'
    },
    evaluatorChromeCollapsedButton: {
      padding: '5px 12px',
      background: 'rgba(56,189,248,0.12)',
      color: '#bae6fd',
      border: '1px solid rgba(56,189,248,0.4)',
      borderRadius: '8px',
      cursor: 'pointer',
      fontSize: '12.5px',
      fontWeight: 600
    },
    evaluatorChromeCollapsedHint: {
      fontSize: '12px',
      color: 'rgba(148,163,184,0.85)',
      maxWidth: 'min(420px, 55vw)',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    },
    main: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    },
  },
  modal: {
    overlay: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.8)',
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    },
    container: {
      width: '100%',
      maxWidth: '1400px',
      height: '90vh',
      background: '#f3f4f6',
      borderRadius: '12px',
      overflow: 'hidden',
      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
    }
  }
};

export default App;
