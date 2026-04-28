// Servicios API para conectar con el backend.
//
// En producción, preferimos **same-origin** (API servida detrás del mismo host vía reverse proxy)
// para evitar CORS y fallos por variables no seteadas. En desarrollo, default a localhost:8000.
const resolveApiBaseUrl = () => {
  const fromEnv = (process.env.REACT_APP_API_URL || '').trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, '');

  // CRA inyecta NODE_ENV en build. Si no hay env explícita:
  if (process.env.NODE_ENV === 'production') return '';
  return 'http://localhost:8000';
};

const API_URL = resolveApiBaseUrl();

const withApiBase = (path) => {
  const p = String(path || '').startsWith('/') ? String(path || '') : `/${path}`;
  return `${API_URL}${p}`;
};

// 🎮 MODO DEMO: Cambiar a true para probar sin backend
const MODO_DEMO = process.env.REACT_APP_DEMO_MODE === 'true' || false;

// DEBUG: Ver configuración en consola
console.log('%c[API Config]', 'color: #667eea; font-weight: bold;', {
  API_URL,
  MODO_DEMO,
  NODE_ENV: process.env.NODE_ENV
});

if (MODO_DEMO) {
  console.warn('%c⚠️ MODO DEMO ACTIVADO', 'color: orange; font-size: 14px;', 'Usando datos simulados');
}

// Helper para obtener headers con token
const getHeaders = (contentType = 'application/json') => {
  const token = localStorage.getItem('token');
  const headers = {
    'Accept': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (contentType) {
    headers['Content-Type'] = contentType;
  }
  return headers;
};

// Fetch con timeout para evitar UI “colgada” (login/subida) cuando el API no responde.
const fetchWithTimeout = async (url, options = {}, timeoutMs = 15000) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
};

// ==================== AUTENTICACION ====================
export const authAPI = {
  login: async (email, password) => {
    // MODO DEMO: Simular login exitoso
    if (MODO_DEMO) {
      console.log('🎮 MODO DEMO: Login simulado para', email);
      const mockUser = {
        id: 'demo-' + Date.now(),
        email: email,
        full_name: email.split('@')[0],
        words_available: 120000,
        words_used: 0,
        plan_type: 'profesor'
      };
      const mockToken = 'demo-token-' + Date.now();
      localStorage.setItem('token', mockToken);
      localStorage.setItem('user', JSON.stringify(mockUser));
      return {
        success: true,
        access_token: mockToken,
        user: mockUser
      };
    }

    // Modo real: conectar con backend FastAPI
    try {
      const loginUrl = withApiBase('/api/auth/login/json');
      console.log('🔌 [Login] POST', loginUrl);
      
      const response = await fetchWithTimeout(loginUrl, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      }, 20000);
      
      console.log('📡 [Login] Status:', response.status);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ [Login] Error:', response.status, errorData);
        return { 
          success: false, 
          message: errorData.detail || `Error ${response.status}: ${response.statusText}` 
        };
      }
      
      const data = await response.json();
      console.log('✅ [Login] Exitoso:', data);
      
      if (data.access_token) {
        localStorage.setItem('token', data.access_token);
        localStorage.setItem('user', JSON.stringify(data.user));
      }
      return { success: true, ...data };
    } catch (error) {
      console.error('❌ [Login] Error de conexión:', error);
      return { 
        success: false, 
        message: `Error de conexión: ${error.message}. Verifica que el backend esté corriendo en ${API_URL}` 
      };
    }
  },

  register: async (email, password, full_name, institution = '') => {
    // MODO DEMO: Simular registro exitoso
    if (MODO_DEMO) {
      console.log('🎮 MODO DEMO: Registro simulado para', email);
      const mockUser = {
        id: 'demo-' + Date.now(),
        email: email,
        full_name: full_name || email.split('@')[0],
        words_available: 120000,
        words_used: 0,
        plan_type: 'profesor'
      };
      const mockToken = 'demo-token-' + Date.now();
      localStorage.setItem('token', mockToken);
      localStorage.setItem('user', JSON.stringify(mockUser));
      return {
        success: true,
        access_token: mockToken,
        user: mockUser
      };
    }

    // Modo real: conectar con backend FastAPI
    try {
      const registerUrl = withApiBase('/api/auth/register');
      console.log('🔌 [Register] POST', registerUrl);
      
      const response = await fetchWithTimeout(registerUrl, {
        method: 'POST',
        mode: 'cors',
        credentials: 'omit',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, full_name }),
      }, 20000);
      
      console.log('📡 [Register] Status:', response.status);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ [Register] Error:', response.status, errorData);
        return { 
          success: false, 
          message: errorData.detail || `Error ${response.status}: ${response.statusText}` 
        };
      }
      
      const data = await response.json();
      console.log('✅ [Register] Exitoso:', data);
      
      // Registro exitoso, ahora hacer login automático
      console.log('[Register] Haciendo login automático...');
      const loginResult = await authAPI.login(email, password);
      return loginResult;
    } catch (error) {
      console.error('❌ [Register] Error:', error);
      return { 
        success: false, 
        message: `Error de conexión: ${error.message}. Verifica que el backend esté corriendo en ${API_URL}` 
      };
    }
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },

  getCurrentUser: () => {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  },

  isAuthenticated: () => {
    return !!localStorage.getItem('token');
  },

  getMe: async () => {
    try {
      const response = await fetchWithTimeout(withApiBase('/api/auth/me'), {
        method: 'GET',
        mode: 'cors',
        headers: getHeaders(),
      }, 15000);
      
      if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        return { success: false, message: 'Sesión expirada. Por favor inicia sesión de nuevo.', expired: true };
      }
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return { success: false, message: errorData.detail || `Error ${response.status}` };
      }
      
      const data = await response.json();
      // GET /api/auth/me devuelve el UserResponse plano, sin { success, user }
      const u = data.user != null ? data.user : data;
      if (u && (u.id != null || u.email)) {
        localStorage.setItem('user', JSON.stringify(u));
        return { success: true, user: u };
      }
      return { success: false, message: 'Respuesta de sesión inválida' };
    } catch (error) {
      console.error('❌ [getMe] Error:', error);
      return { success: false, message: error.message };
    }
  },
};

// ==================== CHAT CON AGENTE ====================
export const agenteAPI = {
  chat: async (mensaje, contexto = {}, historial = [], image = null) => {
    const response = await fetchWithTimeout(withApiBase('/api/evaluate/chat'), {
      method: 'POST',
      mode: 'cors',
      headers: getHeaders(),
      body: JSON.stringify({ mensaje, contexto, historial, image }),
    }, 60000);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        success: false,
        status: response.status,
        detail: data?.detail ?? data,
      };
    }
    return data;
  },

  sugerirRubrica: async (asignatura, tipo_trabajo = '', descripcion = '') => {
    if (MODO_DEMO) {
      return { success: true, asignatura, rubrica: { criterios: [] } };
    }

    const params = new URLSearchParams({ asignatura, tipo_trabajo, descripcion });
    const response = await fetch(`${API_URL}/agente/sugerir-rubrica?${params}`, {
      method: 'GET',
      mode: 'cors',
      headers: getHeaders(),
    });
    return response.json();
  },
};

// ==================== DOCUMENTOS ====================
export const documentosAPI = {
  subir: async (file, asignatura, rubrica = null) => {
    if (MODO_DEMO) {
      console.log('🎮 MODO DEMO: Subida simulada de', file.name);
      await new Promise(r => setTimeout(r, 1000));
      const wordCount = Math.floor(800 + Math.random() * 2000);
      return {
        success: true,
        estimacion: {
          temp_id: 'temp-' + Date.now(),
          filename: file.name,
          word_count: wordCount,
          num_segmentos: Math.floor(wordCount / 300),
          asignatura: asignatura,
          texto_preview: 'Texto extraído del documento...',
        }
      };
    }

    try {
      const formData = new FormData();
      formData.append('archivo', file);
      formData.append('asignatura', asignatura);
      if (rubrica) {
        formData.append('rubrica_json', JSON.stringify(rubrica));
      }

      const token = localStorage.getItem('token');
      const headers = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      console.log('📤 Subiendo archivo:', file.name);
      
      const response = await fetchWithTimeout(withApiBase('/documentos/subir'), {
        method: 'POST',
        mode: 'cors',
        headers: headers,
        body: formData,
      }, 60000);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return { success: false, message: errorData.detail || `Error ${response.status}` };
      }
      
      return await response.json();
    } catch (error) {
      console.error('❌ Error subiendo archivo:', error);
      return { success: false, message: `Error: ${error.message}` };
    }
  },

  listar: async (asignatura = '', limit = 50, offset = 0) => {
    if (MODO_DEMO) {
      return { success: true, documentos: [] };
    }

    const params = new URLSearchParams({ asignatura, limit, offset });
    const response = await fetchWithTimeout(withApiBase(`/documentos?${params}`), {
      method: 'GET',
      mode: 'cors',
      headers: getHeaders(),
    }, 20000);
    return response.json();
  },

  obtener: async (documento_id) => {
    const response = await fetchWithTimeout(withApiBase(`/documentos/${documento_id}`), {
      method: 'GET',
      mode: 'cors',
      headers: getHeaders(),
    }, 20000);
    return response.json();
  },

  eliminar: async (documento_id) => {
    const response = await fetchWithTimeout(withApiBase(`/documentos/${documento_id}`), {
      method: 'DELETE',
      mode: 'cors',
      headers: getHeaders(),
    }, 20000);
    return response.json();
  },
};

// ==================== EVALUACIONES ====================
export const evaluacionesAPI = {
  procesar: async (documento_id, asignatura, rubrica = null) => {
    if (MODO_DEMO) {
      console.log('🎮 MODO DEMO: Evaluación simulada');
      await new Promise(r => setTimeout(r, 3000));
      return {
        success: true,
        calificacion_global: (7 + Math.random() * 3).toFixed(1),
        semaforo_global: 'VERDE',
        segmentos: [
          { id: 1, tipo: 'Introducción', calificacion: 8.5, semaforo: 'VERDE' },
          { id: 2, tipo: 'Desarrollo', calificacion: 7.8, semaforo: 'VERDE' },
        ],
      };
    }

    try {
      const formData = new FormData();
      formData.append('documento_id', documento_id);
      formData.append('asignatura', asignatura);
      if (rubrica) {
        formData.append('rubrica', JSON.stringify(rubrica));
      }

      const token = localStorage.getItem('token');
      const headers = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetchWithTimeout(withApiBase('/evaluaciones/procesar'), {
        method: 'POST',
        mode: 'cors',
        headers: headers,
        body: formData,
      }, 90000);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return { success: false, message: errorData.detail || `Error ${response.status}` };
      }
      
      return await response.json();
    } catch (error) {
      console.error('❌ Error procesando:', error);
      return { success: false, message: `Error: ${error.message}` };
    }
  },

  listarAsignaturas: async () => {
    if (MODO_DEMO) {
      return {
        asignaturas: [
          { id: 'lenguaje', nombre: 'Lengua Castellana', icono: '📚' },
          { id: 'matematicas', nombre: 'Matemáticas', icono: '📐' },
          { id: 'ingles', nombre: 'Inglés', icono: '🗣️' },
        ]
      };
    }

    try {
      const response = await fetch(`${API_URL}/evaluaciones/asignaturas/lista`, {
        method: 'GET',
        mode: 'cors',
        headers: getHeaders(),
      });
      
      if (!response.ok) throw new Error(`Error ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('❌ Error cargando asignaturas:', error);
      return {
        asignaturas: [
          { id: 'lenguaje', nombre: 'Lengua Castellana', icono: '📚' },
          { id: 'matematicas', nombre: 'Matemáticas', icono: '📐' },
        ]
      };
    }
  },
};

const api = {
  auth: authAPI,
  agente: agenteAPI,
  documentos: documentosAPI,
  evaluaciones: evaluacionesAPI,
};

export default api;
