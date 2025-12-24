import { useState, useEffect, useMemo, useCallback } from 'react';
import { AdminLayout } from './AdminLayout';
import { ArticlesManager } from './ArticlesManager';
import { AdsManager } from './AdsManager';
// AdSettingsManager and FeaturedScheduler are now part of SettingsCenter
import SettingsCenter from './SettingsCenter';
import { MediaManager } from './MediaManager';
import { VideoManager } from './VideoManager';
import { CleanupManager } from './CleanupManager';
// APIKeyDiagnostic moved into SettingsCenter
import { AIModelSelector } from './AIModelSelector';
import { AutomationManager } from './AutomationManager';
import EmailManager from './EmailManager';
import { RSSManager } from './RSSManager';
import type { AdminSection } from '../types/admin';

export function AdminPanel() {
  const [currentSection, setCurrentSection] = useState<AdminSection>('articles');
  const [isPageVisible, setIsPageVisible] = useState(true);

  // Detectar cuando la página pierde/gana visibilidad
  useEffect(() => {
    const handleVisibilityChange = () => {
      const visible = !document.hidden;
      setIsPageVisible(visible);
      console.log('[AdminPanel] 👁️ Visibilidad de página:', visible ? 'visible' : 'oculta');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Monitorear cambios en currentSection
  useEffect(() => {
    console.log('[AdminPanel] 🔄 Estado currentSection cambió a:', {
      nuevaSeccion: currentSection,
      timestamp: new Date().toISOString()
    });
  }, [currentSection]);

  const handleSectionChange = useCallback((section: string) => {
    console.log('[AdminPanel] 📋 handleSectionChange llamado:', {
      seccionSolicitada: section,
      seccionActual: currentSection,
      esValida: ['articles', 'ads', 'settings', 'media', 'videos', 'cleanup', 'models', 'automation', 'emails', 'rss'].includes(section),
      timestamp: new Date().toISOString()
    });
    if (['articles', 'ads', 'settings', 'media', 'videos', 'cleanup', 'models', 'automation', 'emails', 'rss'].includes(section)) {
      console.log('[AdminPanel] ✅ Sección válida, actualizando estado a:', section);
      setCurrentSection(section as AdminSection);
    } else {
      console.warn('[AdminPanel] ⚠️ Sección NO válida, ignorando:', section);
    }
  }, [currentSection]);

  const renderContent = useMemo(() => {
    console.log('[AdminPanel] 🎨 Renderizando contenido para sección:', currentSection);
    
    // Si la página no es visible, no renderizar componentes pesados
    if (!isPageVisible) {
      console.log('[AdminPanel] 💤 Página no visible, suspendiendo renderizado pesado');
      return null;
    }

    switch (currentSection) {
      case 'articles':
        console.log('[AdminPanel] 📝 Renderizando ArticlesManager');
        return <ArticlesManager onSectionChange={handleSectionChange} />;
      case 'ads':
        console.log('[AdminPanel] 📊 Renderizando AdsManager');
        return <AdsManager />;
      case 'settings':
        console.log('[AdminPanel] ⚙️ Renderizando SettingsCenter');
        return <SettingsCenter />;
      case 'media':
        console.log('[AdminPanel] 🖼️ Renderizando MediaManager');
        return <MediaManager />;
      case 'videos':
        console.log('[AdminPanel] 🎥 Renderizando VideoManager');
        return <VideoManager />;
      case 'cleanup':
        console.log('[AdminPanel] 🧹 Renderizando CleanupManager');
        return <CleanupManager />;
      case 'models':
        console.log('[AdminPanel] 🤖 Renderizando AIModelSelector');
        return <AIModelSelector />;
      case 'automation':
        console.log('[AdminPanel] ⏰ Renderizando AutomationManager');
        return <AutomationManager />;
      case 'emails':
        console.log('[AdminPanel] 📧 Renderizando EmailManager');
        return <EmailManager />;
      case 'rss':
        console.log('[AdminPanel] 📡 Renderizando RSSManager');
        return <RSSManager />;
      default:
        console.log('[AdminPanel] ⚠️ Sección desconocida, renderizando ArticlesManager por defecto');
        return <ArticlesManager onSectionChange={handleSectionChange} />;
    }
  }, [currentSection, isPageVisible, handleSectionChange]);

  return (
    <AdminLayout currentSection={currentSection} onSectionChange={setCurrentSection}>
      {renderContent}
    </AdminLayout>
  );
}