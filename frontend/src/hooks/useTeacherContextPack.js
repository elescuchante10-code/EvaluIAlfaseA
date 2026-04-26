import { useState, useEffect } from 'react';
import { buildTeacherContextPack } from '../utils/teacherContextPack.js';

/**
 * Re-lee el pack ante cambios en Mi Espacio IB (`evaluai:teacher-context-changed`)
 * o `storage` (otra pestaña).
 */
export function useTeacherContextPack() {
  const [pack, setPack] = useState(() => buildTeacherContextPack());

  useEffect(() => {
    const refresh = () => setPack(buildTeacherContextPack());
    if (typeof window === 'undefined') return undefined;
    window.addEventListener('evaluai:teacher-context-changed', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('evaluai:teacher-context-changed', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  return pack;
}
