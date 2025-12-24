import React, { useState, useEffect } from 'react';
import { Save, Clock, Database, Wifi, WifiOff } from 'lucide-react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

interface AutoSaveSettingsData {
  enabled: boolean;
  interval: number; // en minutos
  maxDrafts: number;
  saveOnNavigation: boolean;
  saveOnTyping: boolean;
  typingDelay: number; // en segundos
}

export const AutoSaveSettings: React.FC = () => {
  const [settings, setSettings] = useState<AutoSaveSettingsData>({
    enabled: true,
    interval: 2, // 2 minutos por defecto
    maxDrafts: 10,
    saveOnNavigation: true,
    saveOnTyping: false,
    typingDelay: 30, // 30 segundos
  });

  const [loading, setLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [user, setUser] = useState<any>(null);

  // Verificar conexión con Supabase
  const checkConnection = async () => {
    try {
      setConnectionStatus('checking');
      const { error } = await supabase
        .from('ai_generated_articles')
        .select('id')
        .limit(1)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      setConnectionStatus('connected');
    } catch (error) {
      console.error('Error checking connection:', error);
      setConnectionStatus('disconnected');
    }
  };

  // Cargar configuraciones guardadas
  useEffect(() => {
    const initialize = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        setUser(user);

        if (user) {
          const { data, error } = await supabase
            .from('user_settings')
            .select('settings')
            .eq('setting_key', 'auto_save')
            .eq('user_id', user.id)
            .maybeSingle();

          if (error && error.code !== 'PGRST116') {
            console.error('Error loading auto-save settings:', error);
            return;
          }

          if (data?.settings) {
            setSettings(prev => ({ ...prev, ...data.settings }));
          }
        }
      } catch (error) {
        console.error('Error loading settings:', error);
      }
    };

    initialize();
    checkConnection();

    // Verificar conexión cada 30 segundos
    const connectionInterval = setInterval(checkConnection, 30000);

    return () => clearInterval(connectionInterval);
  }, []);

  // Guardar configuraciones
  const saveSettings = async () => {
    if (connectionStatus !== 'connected') {
      toast.error('No hay conexión con la base de datos');
      return;
    }

    if (!user) {
      toast.error('Usuario no autenticado');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: user.id,
          setting_key: 'auto_save',
          settings: settings,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;

      toast.success('Configuraciones de auto-guardado guardadas');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Error al guardar configuraciones');
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = <K extends keyof AutoSaveSettingsData>(
    key: K,
    value: AutoSaveSettingsData[K]
  ) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Configuración de Auto-guardado</h2>
          <p className="text-sm text-slate-600 mt-1">
            Configura cómo se guardan automáticamente los artículos en edición
          </p>
        </div>

        {/* Estado de conexión */}
        <div className="flex items-center gap-2">
          {connectionStatus === 'checking' && (
            <div className="flex items-center gap-2 text-amber-600">
              <Database className="h-4 w-4 animate-pulse" />
              <span className="text-sm">Verificando...</span>
            </div>
          )}
          {connectionStatus === 'connected' && (
            <div className="flex items-center gap-2 text-green-600">
              <Wifi className="h-4 w-4" />
              <span className="text-sm">Conectado</span>
            </div>
          )}
          {connectionStatus === 'disconnected' && (
            <div className="flex items-center gap-2 text-red-600">
              <WifiOff className="h-4 w-4" />
              <span className="text-sm">Desconectado</span>
            </div>
          )}
          <button
            onClick={checkConnection}
            className="text-xs text-slate-500 hover:text-slate-700 underline"
          >
            Verificar
          </button>
        </div>
      </div>

      {/* Configuraciones principales */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Configuración básica */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-slate-800">Configuración Básica</h3>

          <div className="space-y-4">
            {/* Habilitar auto-guardado */}
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-slate-700">
                  Habilitar auto-guardado
                </label>
                <p className="text-xs text-slate-500">
                  Guardar automáticamente artículos en edición
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.enabled}
                  onChange={(e) => updateSetting('enabled', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            {/* Intervalo de guardado */}
            <div>
              <label className="text-sm font-medium text-slate-700">
                Intervalo de auto-guardado
              </label>
              <p className="text-xs text-slate-500 mb-2">
                Cada cuánto tiempo guardar automáticamente
              </p>
              <select
                value={settings.interval}
                onChange={(e) => updateSetting('interval', parseInt(e.target.value))}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                disabled={!settings.enabled}
              >
                <option value={1}>Cada 1 minuto</option>
                <option value={2}>Cada 2 minutos</option>
                <option value={5}>Cada 5 minutos</option>
                <option value={10}>Cada 10 minutos</option>
                <option value={15}>Cada 15 minutos</option>
              </select>
            </div>

            {/* Máximo de borradores */}
            <div>
              <label className="text-sm font-medium text-slate-700">
                Máximo de borradores por artículo
              </label>
              <p className="text-xs text-slate-500 mb-2">
                Número máximo de versiones guardadas automáticamente
              </p>
              <select
                value={settings.maxDrafts}
                onChange={(e) => updateSetting('maxDrafts', parseInt(e.target.value))}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                disabled={!settings.enabled}
              >
                <option value={5}>5 borradores</option>
                <option value={10}>10 borradores</option>
                <option value={20}>20 borradores</option>
                <option value={50}>50 borradores</option>
              </select>
            </div>
          </div>
        </div>

        {/* Configuración avanzada */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-slate-800">Configuración Avanzada</h3>

          <div className="space-y-4">
            {/* Guardar al navegar */}
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-slate-700">
                  Guardar al navegar
                </label>
                <p className="text-xs text-slate-500">
                  Guardar automáticamente al cambiar de página
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.saveOnNavigation}
                  onChange={(e) => updateSetting('saveOnNavigation', e.target.checked)}
                  className="sr-only peer"
                  disabled={!settings.enabled}
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 peer-disabled:opacity-50"></div>
              </label>
            </div>

            {/* Guardar al escribir */}
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-slate-700">
                  Guardar al escribir
                </label>
                <p className="text-xs text-slate-500">
                  Guardar automáticamente después de escribir
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.saveOnTyping}
                  onChange={(e) => updateSetting('saveOnTyping', e.target.checked)}
                  className="sr-only peer"
                  disabled={!settings.enabled}
                />
                <input
                  type="range"
                  min="10"
                  max="120"
                  value={settings.typingDelay}
                  onChange={(e) => updateSetting('typingDelay', parseInt(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                  disabled={!settings.enabled || !settings.saveOnTyping}
                />
                <span className="text-xs text-slate-500 ml-2 min-w-[3rem]">
                  {settings.typingDelay}s
                </span>
              </label>
            </div>

            {/* Delay de escritura */}
            {settings.saveOnTyping && (
              <div>
                <label className="text-sm font-medium text-slate-700">
                  Retraso al escribir
                </label>
                <p className="text-xs text-slate-500 mb-2">
                  Esperar este tiempo después de la última escritura
                </p>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="10"
                    max="120"
                    value={settings.typingDelay}
                    onChange={(e) => updateSetting('typingDelay', parseInt(e.target.value))}
                    className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                    disabled={!settings.enabled}
                  />
                  <span className="text-sm text-slate-700 min-w-[4rem]">
                    {settings.typingDelay} segundos
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Información y estadísticas */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <h4 className="text-sm font-semibold text-slate-800 mb-2">Información</h4>
        <div className="grid gap-2 text-sm text-slate-600">
          <div className="flex items-center gap-2">
            <Save className="h-4 w-4" />
            <span>Los borradores se guardan en la tabla <code className="bg-slate-200 px-1 rounded">article_drafts</code></span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <span>Los borradores antiguos se eliminan automáticamente para ahorrar espacio</span>
          </div>
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            <span>El auto-guardado funciona incluso sin conexión a internet (se sincroniza al reconectar)</span>
          </div>
        </div>
      </div>

      {/* Botón guardar */}
      <div className="flex justify-end">
        <button
          onClick={saveSettings}
          disabled={loading || connectionStatus !== 'connected'}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Guardando...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Guardar configuraciones
            </>
          )}
        </button>
      </div>
    </div>
  );
};