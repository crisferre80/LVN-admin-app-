import { supabase } from './supabase';

/**
 * Función de utilidad para limpiar completamente el estado de autenticación
 * Útil cuando hay problemas con sesiones persistentes o estados corruptos
 * NOTA: Solo usar cuando es realmente necesario, no para cambios de pestaña
 */
export const clearAuthState = async () => {
  try {
    console.log('Limpiando estado de autenticación...');

    // Intentar signOut de Supabase (sin esperar)
    supabase.auth.signOut().catch(err => {
      console.warn('Error en signOut durante limpieza:', err);
    });

    console.log('Estado de autenticación limpiado');
  } catch (error) {
    console.error('Error limpiando estado de autenticación:', error);
  }
};

/**
 * Función para verificar si hay problemas con la sesión actual
 * Esta función es más permisiva y no limpia la sesión innecesariamente
 */
export const checkAuthHealth = async (): Promise<boolean> => {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();

    // Si hay un error temporal de red, no considerarlo como no saludable
    if (error) {
      // Errores de red temporales no deben limpiar la sesión
      if (error.message?.includes('network') || error.message?.includes('timeout')) {
        console.warn('Error temporal de red al verificar sesión:', error.message);
        return true; // Asumir que está bien, solo es un problema temporal
      }
      console.warn('Error obteniendo sesión:', error);
      return false;
    }

    if (session) {
      // Verificar si la sesión está realmente expirada
      const now = Math.floor(Date.now() / 1000);
      if (session.expires_at && session.expires_at < now) {
        console.warn('Sesión expirada');
        // Intentar refrescar antes de limpiar
        try {
          const { data, error: refreshError } = await supabase.auth.refreshSession();
          if (!refreshError && data.session) {
            console.log('Sesión refrescada exitosamente durante check de salud');
            return true;
          }
        } catch (refreshErr) {
          console.warn('No se pudo refrescar sesión expirada:', refreshErr);
        }
        // Solo limpiar si el refresh falló
        await clearAuthState();
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error('Error verificando salud de auth:', error);
    // No limpiar en caso de error inesperado
    return true;
  }
};

/**
 * Recuperar sesión desde el storage local
 * Útil cuando se cambia de pestaña o se recarga la página
 */
export const recoverSessionFromStorage = async () => {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('Error recuperando sesión desde storage:', error);
      return null;
    }
    
    if (session) {
      console.log('Sesión recuperada desde storage:', session.user.email);
      return session;
    }
    
    return null;
  } catch (error) {
    console.error('Error en recoverSessionFromStorage:', error);
    return null;
  }
};

/**
 * Forzar refresh de la sesión actual
 */
export const forceRefreshSession = async () => {
  try {
    console.log('Forzando refresh de sesión...');
    const { data, error } = await supabase.auth.refreshSession();
    
    if (error) {
      console.error('Error refrescando sesión:', error);
      return null;
    }
    
    if (data.session) {
      console.log('Sesión refrescada exitosamente');
      return data.session;
    }
    
    return null;
  } catch (error) {
    console.error('Error en forceRefreshSession:', error);
    return null;
  }
};