import React, { useState, useEffect } from 'react';
import { Settings, Calendar, Key, MessageSquare, Save, Activity } from 'lucide-react';
import { AdSettingsManager } from './AdSettingsManager';
import FeaturedScheduler from './FeaturedScheduler';
import { APIKeyDiagnostic } from './APIKeyDiagnostic';
import ModalToastsManager from './ModalToastsManager';
import { AutoSaveSettings } from './AutoSaveSettings';

type Tab = 'ads' | 'featured' | 'api' | 'modals' | 'autosave';

export const SettingsCenter: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('ads');

  // Monitorear cambios en activeTab
  useEffect(() => {
    console.log('[SettingsCenter] 📍 Estado activeTab cambió a:', {
      pestaña: activeTab,
      timestamp: new Date().toISOString()
    });
  }, [activeTab]);

  const handleTabChange = (tab: Tab) => {
    console.log('[SettingsCenter] 🔄 Cambio de pestaña:', {
      pestañaAnterior: activeTab,
      pestañaNueva: tab,
      timestamp: new Date().toISOString()
    });
    setActiveTab(tab);
    console.log('[SettingsCenter] ✅ Pestaña cambiada a:', tab);
  };

  const tabs = [
    { id: 'ads' as Tab, label: 'Publicidades', icon: Settings },
    { id: 'featured' as Tab, label: 'Destacados', icon: Calendar },
    { id: 'api' as Tab, label: 'API Keys', icon: Key },
    { id: 'modals' as Tab, label: 'Modal/Toasts', icon: MessageSquare },
    { id: 'autosave' as Tab, label: 'Auto-guardado', icon: Save },
  ];

  return (
    <div className="space-y-4 p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold mb-2">Centro de Configuración</h1>
        <p className="text-slate-600 text-sm">
          Gestiona todas las configuraciones del sitio desde un solo lugar.
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-slate-200">
        <nav className="-mb-px flex space-x-2 overflow-x-auto" aria-label="Tabs">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`
                  flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors
                  ${isActive
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900'
                  }
                `}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {activeTab === 'ads' && <AdSettingsManager />}
        {activeTab === 'featured' && <FeaturedScheduler />}
        {activeTab === 'api' && <APIKeyDiagnostic />}
        {activeTab === 'modals' && <ModalToastsManager />}
        {activeTab === 'autosave' && <AutoSaveSettings />}
      </div>
    </div>
  );
};

export default SettingsCenter;
