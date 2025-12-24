import { useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';

/**
 * Hook personalizado para escuchar cambios de autenticación
 * Proporciona una forma fácil de reaccionar a cambios de sesión
 *
 * @example
 * const { session, user, isLoading } = useAuthListener();
 *
 * useEffect(() => {
 *   if (user) {
 *     console.log('Usuario autenticado:', user.email);
 *   } else {
 *     console.log('Usuario no autenticado');
 *   }
 * }, [user]);
 */
export function useAuthListener() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    // Obtener sesión inicial
    const getInitialSession = async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) throw error;

        if (isMounted) {
          setSession(session);
          setUser(session?.user ?? null);
        }
      } catch (error) {
        console.error('Error obteniendo sesión inicial:', error);
        if (isMounted) {
          setSession(null);
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    // Registrar listener de cambios
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[useAuthListener] Evento:', event, 'Usuario:', session?.user?.email);

      if (isMounted) {
        setSession(session);
        setUser(session?.user ?? null);
        setIsLoading(false);
      }
    });

    // Obtener sesión inicial
    getInitialSession();

    // Limpiar al desmontar
    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return {
    session,
    user,
    isLoading,
  };
}

/**
 * Hook para refrescar la sesión manualmente
 * Útil cuando necesitas asegurar que el token está actualizado
 *
 * @example
 * const { refreshSession, isRefreshing } = useSessionRefresh();
 *
 * const handleCriticalOperation = async () => {
 *   await refreshSession();
 *   // Continuar con operación crítica
 * };
 */
export function useSessionRefresh() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshSession = async () => {
    setIsRefreshing(true);
    setError(null);

    try {
      const { data, error: refreshError } = await supabase.auth.refreshSession();

      if (refreshError) {
        throw new Error(refreshError.message);
      }

      if (data.session) {
        console.log('[useSessionRefresh] ✅ Sesión refrescada');
        return data.session;
      } else {
        throw new Error('No se pudo refrescar la sesión');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      setError(errorMessage);
      console.error('[useSessionRefresh] ❌ Error:', errorMessage);
      return null;
    } finally {
      setIsRefreshing(false);
    }
  };

  return {
    refreshSession,
    isRefreshing,
    error,
  };
}

/**
 * Hook para monitorear la expiración del token
 * Emite alertas cuando el token está próximo a expirar
 *
 * @param warningMinutes - Minutos antes de la expiración para mostrar alerta (default: 5)
 *
 * @example
 * const { tokenExpiresIn, showWarning } = useTokenExpiration(5);
 *
 * if (showWarning) {
 *   return <div>Tu sesión expira en {tokenExpiresIn} minutos</div>;
 * }
 */
export function useTokenExpiration(warningMinutes: number = 5) {
  const [tokenExpiresIn, setTokenExpiresIn] = useState<number | null>(null);
  const [showWarning, setShowWarning] = useState(false);

  useEffect(() => {
    const checkTokenExpiration = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setShowWarning(false);
        setTokenExpiresIn(null);
        return;
      }

      const now = Math.floor(Date.now() / 1000);
      const expiresAt = session.expires_at || 0;
      const minutesLeft = Math.floor((expiresAt - now) / 60);

      setTokenExpiresIn(minutesLeft);
      setShowWarning(minutesLeft <= warningMinutes && minutesLeft > 0);
    };

    // Verificar inmediatamente
    checkTokenExpiration();

    // Verificar cada 30 segundos
    const interval = setInterval(checkTokenExpiration, 30 * 1000);

    return () => clearInterval(interval);
  }, [warningMinutes]);

  return {
    tokenExpiresIn,
    showWarning,
  };
}

/**
 * Hook para detectar cambios de visibilidad de pestaña
 * Útil para sincronizar estado cuando el usuario vuelve a la app
 *
 * @param callback - Función a ejecutar cuando pestaña se hace visible
 *
 * @example
 * useTabVisibility(() => {
 *   console.log('Usuario regresó a la pestaña');
 *   // Refrescar datos...
 * });
 */
export function useTabVisibility(callback: () => void | Promise<void>) {
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        console.log('[useTabVisibility] 👁️ Pestaña visible');
        await callback();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [callback]);
}

/**
 * Hook para ejecutar operaciones que requieren autenticación
 * Refresca token automáticamente si es necesario
 *
 * @example
 * const { executeSecure, isLoading, error } = useSecureOperation();
 *
 * const handleDelete = async () => {
 *   await executeSecure(async () => {
 *     await supabase.from('articles').delete().eq('id', articleId);
 *   });
 * };
 */
export function useSecureOperation() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { refreshSession } = useSessionRefresh();

  const executeSecure = async (operation: () => Promise<any>) => {
    setIsLoading(true);
    setError(null);

    try {
      // Verificar sesión antes de ejecutar
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('No estás autenticado');
      }

      // Refrescar token si está próximo a expirar
      const now = Math.floor(Date.now() / 1000);
      const expiresAt = session.expires_at || 0;

      if (expiresAt - now < 300) {
        // Token expira en menos de 5 minutos
        await refreshSession();
      }

      // Ejecutar operación
      const result = await operation();
      console.log('[useSecureOperation] ✅ Operación completada');
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      setError(errorMessage);
      console.error('[useSecureOperation] ❌ Error:', errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    executeSecure,
    isLoading,
    error,
  };
}
