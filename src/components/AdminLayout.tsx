import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Image,
  BarChart3,
  Home,
  Play,
  LogOut,
  Trash2,
  Settings,
  Clock,
  Edit,
  // Zap, ShieldCheck, Star removed (merged into 'settings')
  Mail,
  Menu,
  X,
  Rss,
  Loader,
  RefreshCw,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import type { AdminSection } from '../types/admin';

interface AdminLayoutProps {
  currentSection: AdminSection;
  onSectionChange: (section: AdminSection) => void;
  children: React.ReactNode;
}

function classNames(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export function AdminLayout({ currentSection, onSectionChange, children }: AdminLayoutProps) {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Monitorear cambios en currentSection desde props
  useEffect(() => {
    console.log('[AdminLayout] 📍 Prop currentSection recibida:', {
      seccion: currentSection,
      timestamp: new Date().toISOString()
    });
  }, [currentSection]);

  const handleRefreshLocalNews = async () => {
    const loadingToast = toast.loading('Iniciando renovación de noticias locales...');

    try {
      setIsRefreshing(true);
      let totalInserted = 0;
      let hasMore = true;
      let currentSource = 0;
      const totalSources = 2; // Diario Panorama + Info del Estero

      // Procesar fuente por fuente para evitar timeout
      while (hasMore && currentSource < totalSources) {
        toast.loading(`Procesando fuente ${currentSource + 1}/${totalSources}...`, { id: loadingToast });
        
        const { data, error } = await supabase.functions.invoke('process_local_rss', {
          body: { 
            batch: true,
            source: currentSource,
            max: 10
          }
        });

        if (error) {
          console.error(`Error procesando fuente ${currentSource}:`, error);
          toast.error(`Error en fuente ${currentSource + 1}: ${error.message}`, { id: loadingToast });
          break;
        }

        console.log(`Fuente ${currentSource} procesada:`, data);
        totalInserted += data.total_news_inserted || 0;
        hasMore = data.has_more || false;
        currentSource++;

        // Delay de 2 segundos entre fuentes para evitar sobrecarga
        if (hasMore) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      if (totalInserted > 0) {
        toast.success(`✅ ${totalInserted} noticias locales renovadas de ${currentSource} fuentes`, { id: loadingToast });
      } else {
        toast.success('Renovación completada, no hay noticias nuevas', { id: loadingToast });
      }
    } catch (error) {
      console.error('Error inesperado:', error);
      toast.error('Error inesperado al renovar noticias locales', { id: loadingToast });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleLogout = async () => {
    if (isLoggingOut) return; // Prevenir múltiples clicks

    try {
      setIsLoggingOut(true);
      console.log('Cerrando sesión...');
      
      // signOut ya manejará la redirección a la URL limpia
      await signOut();
      
      // Esta línea no se ejecutará porque signOut hace window.location.href
      // pero la dejamos como fallback
      window.location.href = 'https://www.lavozdelnortediario.com';
    } catch (error) {
      console.error('Error during logout:', error);
      // En caso de error, forzar redirección a URL limpia
      window.location.href = 'https://www.lavozdelnortediario.com';
    }
  };

  const handleSectionChange = (section: AdminSection) => {
    console.log('[AdminLayout] 🔄 Cambio de sección solicitado:', {
      seccionAnterior: currentSection,
      seccionNueva: section,
      timestamp: new Date().toISOString(),
      sidebarAbierto: isSidebarOpen
    });
    onSectionChange(section);
    setIsSidebarOpen(false);
    console.log('[AdminLayout] ✅ Sección cambiada a:', section);
  };

  const menuItems = [
    {
      id: 'articles' as AdminSection,
      label: 'Artículos',
      helper: 'Redacción, galerías y publicaciones',
      icon: FileText,
    },
    {
      id: 'editor' as AdminSection,
      label: 'Editor',
      helper: 'Crear y editar artículos',
      icon: Edit,
    },
    {
      id: 'settings' as AdminSection,
      label: 'Configuración',
      helper: 'Ajustes: Ads, destacados, APIs y diagnósticos',
      icon: Settings,
    },
    {
      id: 'ads' as AdminSection,
      label: 'Publicidades',
      helper: 'Formatos, ubicaciones y estado',
      icon: BarChart3,
    },
    /* Removed 'ad-settings' and 'ai' entries — merged into 'settings' */
    {
      id: 'automation' as AdminSection,
      label: 'Automatización',
      helper: 'Programar generación de artículos',
      icon: Clock,
    },
    {
      id: 'media' as AdminSection,
      label: 'Multimedia',
      helper: 'Biblioteca y Drive',
      icon: Image,
    },
    {
      id: 'videos' as AdminSection,
      label: 'Videos',
      helper: 'Gestión de clips y transmisiones',
      icon: Play,
    },
    {
      id: 'cleanup' as AdminSection,
      label: 'Limpieza',
      helper: 'Eliminar artículos rotos',
      icon: Trash2,
    },
    /* 'diagnostic' merged into 'settings' */
    {
      id: 'models' as AdminSection,
      label: 'Modelos IA',
      helper: 'Configurar proveedores y modelos',
      icon: Settings,
    },
    {
      id: 'rss' as AdminSection,
      label: 'Fuentes RSS',
      helper: 'Gestionar feeds de noticias',
      icon: Rss,
    },
    {
      id: 'emails' as AdminSection,
      label: 'Emails',
      helper: 'Campañas y contactos',
      icon: Mail,
    },
  ];

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-blue-600/90 backdrop-blur text-white">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            {/* Botón menú móvil */}
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white p-2 text-slate-600 shadow-sm transition hover:text-slate-900 lg:hidden"
            >
              {isSidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>

            <div className="flex items-center gap-2">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/20 text-white">
                <img src="/assets/logo.png" alt="Logo" className="h-9 w-9" />
              </span>
              <div className="flex flex-col">
                <span className="text-sm font-medium text-blue-100">La Voz del Norte Diario</span>
                <h1 className="text-lg font-semibold leading-tight sm:text-xl">Panel de Administración</h1>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefreshLocalNews}
              disabled={isRefreshing}
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Renovar noticias locales"
            >
              {isRefreshing ? (
                <Loader className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">
                {isRefreshing ? 'Renovando...' : 'Renovar Locales'}
              </span>
            </button>
            <button
              onClick={() => navigate('/')}
              className="inline-flex items-center justify-center rounded-xl border border-white/20 bg-white/10 p-2 text-white shadow-sm transition hover:bg-white/20"
              title="Ir al inicio"
            >
              <Home className="h-5 w-5" />
            </button>
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-red-500 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoggingOut ? (
                <Loader className="h-4 w-4 animate-spin" />
              ) : (
                <LogOut className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">
                {isLoggingOut ? 'Cerrando...' : 'Salir'}
              </span>
            </button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar móvil */}
        <aside
          className={classNames(
            'fixed inset-y-0 left-0 z-30 w-64 transform border-r border-slate-200 bg-blue-50 transition-transform duration-300 ease-in-out lg:hidden',
            isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
          )}
          style={{ top: '73px' }}
        >
          <nav className="h-full overflow-y-auto p-4">
            <div className="space-y-1">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentSection === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSectionChange(item.id)}
                    className={classNames(
                      'flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium transition',
                      isActive
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-slate-600 hover:bg-slate-100'
                    )}
                  >
                    <Icon className="h-5 w-5 flex-shrink-0" />
                    <div className="flex flex-col">
                      <span>{item.label}</span>
                      <span className="text-xs font-normal text-slate-500">{item.helper}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </nav>
        </aside>

        {/* Overlay móvil */}
        {isSidebarOpen && (
          <div
            className="fixed inset-0 z-20 bg-black/20 backdrop-blur-sm lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
            style={{ top: '73px' }}
          />
        )}

        {/* Tabs desktop */}
        <div className="hidden w-full border-b border-slate-200 bg-blue-50 lg:block">
          <div className="mx-auto flex w-full max-w-7xl gap-2 overflow-x-auto px-4 py-3">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleSectionChange(item.id)}
                  className={classNames(
                    'flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition whitespace-nowrap',
                    isActive
                      ? 'border-blue-200 bg-blue-50 text-blue-700 shadow-sm'
                      : 'border-transparent bg-slate-100 text-slate-600 hover:bg-slate-200'
                  )}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Contenido principal */}
      <div className="mx-auto w-full max-w-7xl px-4 py-6">
        <main className="w-full">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}