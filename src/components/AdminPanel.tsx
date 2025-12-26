import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
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
import { ArticleEditor } from './ArticleEditor';
import type { AdminSection } from '../types/admin';

export function AdminPanel() {
  const [currentSection, setCurrentSection] = useState<AdminSection>('articles');
  const [editorParams, setEditorParams] = useState<{
    editId?: string;
    isNew?: boolean;
    isRewrite?: boolean;
  }>({});
  const [searchParams, setSearchParams] = useSearchParams();

  // Detectar si debemos cambiar automáticamente a la sección editor
  useEffect(() => {
    const editId = searchParams.get('edit');
    const newArticle = searchParams.get('new');

    if (editId || newArticle) {
      console.log('[AdminPanel] 🎯 Detectada solicitud de edición, cambiando a sección editor');
      setCurrentSection('editor');
      // Limpiar los parámetros de la URL después de procesarlos
      setSearchParams(new URLSearchParams());
    }
  }, [searchParams, setSearchParams]);

  // Monitorear cambios en currentSection
  useEffect(() => {
    console.log('[AdminPanel] 🔄 Estado currentSection cambió a:', {
      nuevaSeccion: currentSection,
      timestamp: new Date().toISOString()
    });
  }, [currentSection]);

  const handleSectionChange = useCallback((section: string, params?: { editId?: string; isNew?: boolean; isRewrite?: boolean }) => {
    console.log('[AdminPanel] 📋 handleSectionChange llamado:', {
      seccionSolicitada: section,
      parametros: params,
      seccionActual: currentSection,
      esValida: ['articles', 'ads', 'settings', 'media', 'videos', 'cleanup', 'models', 'automation', 'emails', 'rss', 'editor'].includes(section),
      timestamp: new Date().toISOString()
    });
    if (['articles', 'ads', 'settings', 'media', 'videos', 'cleanup', 'models', 'automation', 'emails', 'rss', 'editor'].includes(section)) {
      console.log('[AdminPanel] ✅ Sección válida, actualizando estado a:', section);
      setCurrentSection(section as AdminSection);
      if (section === 'editor' && params) {
        setEditorParams(params);
      }
    } else {
      console.warn('[AdminPanel] ⚠️ Sección NO válida, ignorando:', section);
    }
  }, [currentSection]);

  const renderContent = useMemo(() => {
    console.log('[AdminPanel] 🎨 Renderizando contenido para sección:', currentSection);

    // Mantener todos los componentes montados para preservar estado
    return (
      <div className="relative">
        <div className={currentSection === 'articles' ? 'block' : 'hidden'}>
          <ArticlesManager onSectionChange={handleSectionChange} />
        </div>
        <div className={currentSection === 'ads' ? 'block' : 'hidden'}>
          <AdsManager />
        </div>
        <div className={currentSection === 'settings' ? 'block' : 'hidden'}>
          <SettingsCenter />
        </div>
        <div className={currentSection === 'media' ? 'block' : 'hidden'}>
          <MediaManager />
        </div>
        <div className={currentSection === 'videos' ? 'block' : 'hidden'}>
          <VideoManager />
        </div>
        <div className={currentSection === 'cleanup' ? 'block' : 'hidden'}>
          <CleanupManager />
        </div>
        <div className={currentSection === 'models' ? 'block' : 'hidden'}>
          <AIModelSelector />
        </div>
        <div className={currentSection === 'automation' ? 'block' : 'hidden'}>
          <AutomationManager />
        </div>
        <div className={currentSection === 'emails' ? 'block' : 'hidden'}>
          <EmailManager />
        </div>
        <div className={currentSection === 'rss' ? 'block' : 'hidden'}>
          <RSSManager />
        </div>
        <div className={currentSection === 'editor' ? 'block' : 'hidden'}>
          <ArticleEditor 
            onExit={() => setCurrentSection('articles')} 
            initialEditId={editorParams.editId}
            initialNew={editorParams.isNew}
            initialRewrite={editorParams.isRewrite}
          />
        </div>
      </div>
    );
  }, [currentSection, handleSectionChange, editorParams]);

  return (
    <AdminLayout currentSection={currentSection} onSectionChange={setCurrentSection}>
      {renderContent}
    </AdminLayout>
  );
}