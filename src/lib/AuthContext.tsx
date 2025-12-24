import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { clearAuthState, checkAuthHealth } from '../lib/authUtils';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    let refreshInterval: NodeJS.Timeout | null = null;
    let visibilityCheckTimeout: NodeJS.Timeout | null = null;
    let isRefreshing = false;

    // PASO 1: Inicializar el listener de onAuthStateChange
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session: Session | null) => {
        console.log('[onAuthStateChange] Evento:', _event, 'Usuario:', session?.user?.email || 'no user');
        
        if (!mounted) return;

        // Solo actualizar estado si la sesión cambió
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        // PASO 2: Manejar evento de SIGNED_IN
        if (_event === 'SIGNED_IN' && session?.user) {
          console.log('[onAuthStateChange] ✅ Usuario iniciado sesión:', session.user.email);
          
          try {
            await supabase
              .from('user_profiles')
              .upsert({
                id: session.user.id,
                email: session.user.email,
                last_sign_in: new Date().toISOString(),
                updated_at: new Date().toISOString()
              }, {
                onConflict: 'id'
              });
            console.log('[onAuthStateChange] ✅ Perfil actualizado');
          } catch (error) {
            console.error('[onAuthStateChange] ❌ Error actualizando perfil:', error);
          }
        }

        // PASO 3: Manejar evento de SIGNED_OUT
        if (_event === 'SIGNED_OUT') {
          console.log('[onAuthStateChange] ✅ Usuario cerró sesión');
          
          if (mounted) {
            setUser(null);
            setSession(null);
            
            try {
              await clearAuthState();
            } catch (error) {
              console.warn('[onAuthStateChange] Advertencia limpiando estado:', error);
            }
          }
        }

        // PASO 4: Manejar TOKEN_REFRESHED
        if (_event === 'TOKEN_REFRESHED' && session) {
          console.log('[onAuthStateChange] 🔄 Token refrescado automáticamente');
        }

        // PASO 5: Manejar USER_UPDATED
        if (_event === 'USER_UPDATED' && session?.user) {
          console.log('[onAuthStateChange] 📝 Perfil del usuario actualizado');
        }

        // PASO 6: INITIAL_SESSION
        if (_event === 'INITIAL_SESSION' && session) {
          console.log('[onAuthStateChange] 🔧 Sesión inicial recuperada desde storage');
        }
      }
    );

    // PASO 7: Función para refrescar la sesión cuando está próxima a expirar
    const refreshSessionIfNeeded = async () => {
      if (isRefreshing) {
        console.log('[refreshSessionIfNeeded] Ya está refrescando, saltando...');
        return;
      }

      try {
        isRefreshing = true;
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        
        if (!currentSession) {
          console.log('[refreshSessionIfNeeded] No hay sesión activa');
          return;
        }

        const now = Math.floor(Date.now() / 1000);
        const expiresAt = currentSession.expires_at || 0;
        const timeUntilExpiry = expiresAt - now;

        // Refrescar si la sesión expira en menos de 5 minutos
        if (timeUntilExpiry < 300) {
          console.log('[refreshSessionIfNeeded] Sesión expira en', timeUntilExpiry, 'segundos, refrescando...');
          
          const { data, error: refreshError } = await supabase.auth.refreshSession();
          
          if (refreshError) {
            console.error('[refreshSessionIfNeeded] ❌ Error refrescando:', refreshError);
          } else if (data.session && mounted) {
            console.log('[refreshSessionIfNeeded] ✅ Sesión refrescada exitosamente');
            setSession(data.session);
            setUser(data.session.user);
          }
        }
      } catch (error) {
        console.error('[refreshSessionIfNeeded] Error inesperado:', error);
      } finally {
        isRefreshing = false;
      }
    };

    // PASO 8: Manejar cambios de visibilidad de pestaña (SOLO visibilitychange, no focus)
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        console.log('[handleVisibilityChange] 👁️ Pestaña visible, sincronizando sesión...');
        
        // Cancelar timeout anterior si existe
        if (visibilityCheckTimeout) {
          clearTimeout(visibilityCheckTimeout);
        }

        // Pequeño delay para evitar race conditions
        visibilityCheckTimeout = setTimeout(async () => {
          try {
            const { data: { session: currentSession }, error } = await supabase.auth.getSession();
            
            if (error) {
              console.warn('[handleVisibilityChange] Error obteniendo sesión:', error);
              return;
            }

            if (currentSession && mounted) {
              console.log('[handleVisibilityChange] ✅ Sesión recuperada:', currentSession.user.email);
              setSession(currentSession);
              setUser(currentSession.user);
              
              // Refrescar si es necesario
              await refreshSessionIfNeeded();
            } else if (!currentSession) {
              console.log('[handleVisibilityChange] ℹ️ No hay sesión activa');
            }
          } catch (error) {
            console.error('[handleVisibilityChange] Error sincronizando:', error);
          }
        }, 200);
      }
    };

    // PASO 9: Función para obtener sesión inicial
    const initializeAuth = async () => {
      try {
        console.log('[initializeAuth] Inicializando autenticación...');
        
        // Verificar salud de autenticación
        const isHealthy = await checkAuthHealth();
        if (!isHealthy) {
          console.warn('[initializeAuth] ⚠️ Problemas detectados en autenticación');
        }

        // Obtener sesión desde storage
        const { data: { session: initialSession }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('[initializeAuth] Error obteniendo sesión inicial:', error);
          return;
        }

        if (initialSession && mounted) {
          console.log('[initializeAuth] ✅ Sesión inicial encontrada:', initialSession.user.email);
          setSession(initialSession);
          setUser(initialSession.user);
        } else {
          console.log('[initializeAuth] ℹ️ Sin sesión inicial (usuario no autenticado)');
        }
      } catch (error) {
        console.error('[initializeAuth] Error inesperado:', error);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    // Inicializar autenticación
    initializeAuth();

    // IMPORTANTE: Solo agregar visibilitychange, NO focus
    // El event focus se dispara muchas veces y causa bucles infinitos
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // PASO 10: Refrescar sesión periódicamente (cada 4 minutos) cuando pestaña está activa
    refreshInterval = setInterval(() => {
      if (document.visibilityState === 'visible' && session && !isRefreshing) {
        refreshSessionIfNeeded();
      }
    }, 4 * 60 * 1000); // 4 minutos

    // PASO 11: Limpiar al desmontar
    return () => {
      console.log('[cleanup] Limpiando listeners de autenticación');
      mounted = false;
      subscription.unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
      if (visibilityCheckTimeout) {
        clearTimeout(visibilityCheckTimeout);
      }
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    // Si el login fue exitoso, actualizar last_sign_in en user_profiles
    if (!error && data.user) {
      try {
        await supabase
          .from('user_profiles')
          .upsert({
            id: data.user.id,
            email: data.user.email,
            last_sign_in: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'id'
          });
      } catch (profileError) {
        console.error('Error updating user profile:', profileError);
        // No fallar el login si falla la actualización del perfil
      }
    }
    
    return { error: error?.message };
  };

  const signUp = async (email: string, password: string, fullName?: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName || email.split('@')[0]
        }
      }
    });

    // El trigger handle_new_user() creará automáticamente el perfil en user_profiles
    // Pero por si acaso, lo hacemos también aquí
    if (!error && data.user) {
      try {
        await supabase
          .from('user_profiles')
          .insert({
            id: data.user.id,
            email: data.user.email,
            full_name: fullName || email.split('@')[0],
            role: 'user',
            last_sign_in: new Date().toISOString()
          });
      } catch (profileError) {
        console.error('Error creating user profile (might be created by trigger):', profileError);
        // No fallar el signup si el trigger ya creó el perfil
      }
    }

    return { error: error?.message };
  };

  const signOut = async () => {
    try {
      console.log('Iniciando proceso de logout...');

      // Limpiar estado local inmediatamente
      setUser(null);
      setSession(null);

      // Intentar signOut de Supabase con timeout
      const signOutPromise = supabase.auth.signOut();
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('SignOut timeout')), 10000);
      });

      try {
        const result = await Promise.race([signOutPromise, timeoutPromise]) as any;
        const { error } = result;

        if (error) {
          console.error('Error signing out:', error);
          // No tirar error, continuar con limpieza
        }
      } catch (timeoutError) {
        console.warn('SignOut timed out, continuing with cleanup:', timeoutError);
        // Timeout alcanzado, pero continuamos con la limpieza
      }

      // Limpiar completamente el estado de autenticación
      await clearAuthState();

      console.log('Logout completado exitosamente');

      // Redirigir a la URL limpia de la página principal
      window.location.href = 'https://www.lavozdelnortediario.com';
    } catch (error) {
      console.error('Error en signOut:', error);
      // Asegurar limpieza incluso si hay error
      setUser(null);
      setSession(null);
      await clearAuthState();

      // Forzar redirección a página principal limpia
      window.location.href = 'https://www.lavozdelnortediario.com';
    }
  };

  const value = {
    user,
    session,
    loading,
    signIn,
    signUp,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() { // eslint-disable-line react-refresh/only-export-components
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}