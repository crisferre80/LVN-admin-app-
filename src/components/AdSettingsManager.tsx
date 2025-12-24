import React, { useState, useEffect } from 'react';
import { Settings, Save, RefreshCw, Play, Clock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAdSettings } from '../hooks/useAdSettings';

export const AdSettingsManager: React.FC = () => {
  const { settings, loading: settingsLoading } = useAdSettings();
  const [localSettings, setLocalSettings] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!settingsLoading) {
      setLocalSettings(settings);
      setLoading(false);
    }
  }, [settings, settingsLoading]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates = Object.entries(localSettings).map(([key, value]) => ({
        key,
        value,
        description: getSettingDescription(key)
      }));

      const { error } = await supabase
        .from('ad_settings')
        .upsert(updates, { onConflict: 'key' });

      if (error) throw error;

      alert('Configuración guardada exitosamente');
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Error al guardar la configuración');
    } finally {
      setSaving(false);
    }
  };

  const getSettingDescription = (key: string): string => {
    const descriptions: Record<string, string> = {
      articles_between_ads: 'Número de artículos entre publicidades en la lista principal',
      sidebar_ads_interval: 'Número de artículos entre publicidades en barra lateral (si se implementa)',
      featured_autoplay_seconds: 'Tiempo en segundos entre cambios automáticos del carrusel de noticias destacadas',
      featured_autoplay_loop: 'Si está activo (1) el carrusel de destacados hará loop continuo, si no (0) no hará loop',
      featured_show_ad: 'Si está activo (1) se mostrará una publicidad integrada en el carrusel de destacados como si fuera una noticia, si no (0) no se mostrará',
      latest_news_autoplay_seconds: 'Tiempo en segundos entre cambios automáticos del carrusel de últimas noticias',
      latest_news_autoplay_loop: 'Si está activo (1) el carrusel de últimas noticias hará loop continuo, si no (0) no hará loop'
    };
    return descriptions[key] || '';
  };

  const handleInputChange = (key: string, value: string) => {
    setLocalSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  if (loading) {
    return (
      <div className="space-y-4 p-6">
        <div className="h-8 w-48 rounded-2xl bg-slate-200 animate-pulse" />
        <div className="space-y-3">
          {[...Array(2)].map((_, index) => (
            <div key={index} className="h-20 rounded-2xl bg-slate-200 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold text-slate-900">Configuración de Publicidades</h2>
          <p className="text-sm text-slate-500">
            Configura el comportamiento de las publicidades en el sitio.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50 sm:w-auto"
        >
          {saving ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Configuración General</h3>
            <p className="text-sm text-slate-500">Ajusta los intervalos de publicidades.</p>
          </div>
          <Settings className="h-6 w-6 text-slate-400" />
        </div>

        <div className="space-y-6 px-5 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-600" htmlFor="articles-between-ads">
              Artículos entre publicidades
            </label>
            <input
              id="articles-between-ads"
              type="number"
              min="1"
              max="20"
              value={localSettings.articles_between_ads || '3'}
              onChange={(e) => handleInputChange('articles_between_ads', e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
            <p className="text-xs text-slate-500">
              {getSettingDescription('articles_between_ads')}
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-600" htmlFor="sidebar-ads-interval">
              Intervalo sidebar
            </label>
            <input
              id="sidebar-ads-interval"
              type="number"
              min="1"
              value={localSettings.sidebar_ads_interval || '5'}
              onChange={(e) => handleInputChange('sidebar_ads_interval', e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
            <p className="text-xs text-slate-500">
              {getSettingDescription('sidebar_ads_interval')}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Carrusel de Destacados</h3>
            <p className="text-sm text-slate-500">Configura el autoplay del carrusel principal.</p>
          </div>
          <Play className="h-6 w-6 text-slate-400" />
        </div>

        <div className="space-y-6 px-5 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-600" htmlFor="autoplay-seconds">
              Segundos de autoplay
            </label>
            <input
              id="autoplay-seconds"
              type="number"
              min="1"
              max="30"
              value={localSettings.featured_autoplay_seconds || '5'}
              onChange={(e) => handleInputChange('featured_autoplay_seconds', e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
            <p className="text-xs text-slate-500">
              {getSettingDescription('featured_autoplay_seconds')}
            </p>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={localSettings.featured_autoplay_loop === '1' || localSettings.featured_autoplay_loop === 'true'}
                onChange={(e) => handleInputChange('featured_autoplay_loop', e.target.checked ? '1' : '0')}
                className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
              />
              <div>
                <span className="text-sm font-medium text-slate-700">Loop infinito</span>
                <p className="text-xs text-slate-500">
                  {getSettingDescription('featured_autoplay_loop')}
                </p>
              </div>
            </label>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={localSettings.featured_show_ad === '1' || localSettings.featured_show_ad === 'true'}
                onChange={(e) => handleInputChange('featured_show_ad', e.target.checked ? '1' : '0')}
                className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
              />
              <div>
                <span className="text-sm font-medium text-slate-700">Mostrar publicidad integrada</span>
                <p className="text-xs text-slate-500">
                  {getSettingDescription('featured_show_ad')}
                </p>
              </div>
            </label>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Carrusel de Últimas Noticias</h3>
            <p className="text-sm text-slate-500">Configura el autoplay del carrusel de últimas noticias.</p>
          </div>
          <Clock className="h-6 w-6 text-slate-400" />
        </div>

        <div className="space-y-6 px-5 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-600" htmlFor="latest-autoplay-seconds">
              Segundos de autoplay
            </label>
            <input
              id="latest-autoplay-seconds"
              type="number"
              min="1"
              max="30"
              value={localSettings.latest_news_autoplay_seconds || '5'}
              onChange={(e) => handleInputChange('latest_news_autoplay_seconds', e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
            <p className="text-xs text-slate-500">
              {getSettingDescription('latest_news_autoplay_seconds')}
            </p>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={localSettings.latest_news_autoplay_loop === '1' || localSettings.latest_news_autoplay_loop === 'true'}
                onChange={(e) => handleInputChange('latest_news_autoplay_loop', e.target.checked ? '1' : '0')}
                className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
              />
              <div>
                <span className="text-sm font-medium text-slate-700">Loop infinito</span>
                <p className="text-xs text-slate-500">
                  {getSettingDescription('latest_news_autoplay_loop')}
                </p>
              </div>
            </label>
          </div>
        </div>
      </section>

      {settings && (
        <section className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
          <h3 className="text-sm font-semibold text-blue-900 mb-3">Vista previa de configuración actual</h3>
          <div className="grid gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-blue-700">Artículos entre anuncios:</span>
              <span className="font-semibold text-blue-900">{settings.articles_between_ads || '3'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-blue-700">Intervalo sidebar:</span>
              <span className="font-semibold text-blue-900">{settings.sidebar_ads_interval || '5'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-blue-700">Autoplay destacados:</span>
              <span className="font-semibold text-blue-900">{settings.featured_autoplay_seconds || '5'} segundos</span>
            </div>
            <div className="flex justify-between">
              <span className="text-blue-700">Loop infinito destacados:</span>
              <span className="font-semibold text-blue-900">
                {settings.featured_autoplay_loop === '1' || settings.featured_autoplay_loop === 'true' ? 'Activado' : 'Desactivado'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-blue-700">Publicidad en destacados:</span>
              <span className="font-semibold text-blue-900">
                {settings.featured_show_ad === '1' || settings.featured_show_ad === 'true' ? 'Activado' : 'Desactivado'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-blue-700">Autoplay últimas noticias:</span>
              <span className="font-semibold text-blue-900">{settings.latest_news_autoplay_seconds || '5'} segundos</span>
            </div>
            <div className="flex justify-between">
              <span className="text-blue-700">Loop infinito últimas noticias:</span>
              <span className="font-semibold text-blue-900">
                {settings.latest_news_autoplay_loop === '1' || settings.latest_news_autoplay_loop === 'true' ? 'Activado' : 'Desactivado'}
              </span>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};
