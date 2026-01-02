import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { ArticlesManager } from './ArticlesManager';
import { AdsManager } from './AdsManager';
import { SettingsCenter } from './SettingsCenter';
import { MediaManager } from './MediaManager';
import { VideoManager } from './VideoManager';
import { AutomationManager } from './AutomationManager';
import EmailManager from './EmailManager';
import { RSSManager } from './RSSManager';
import { ArticleEditor } from './ArticleEditor';

export function Dashboard() {
  const { user, signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('articles');
  const [editorParams, setEditorParams] = useState<{
    editId?: string;
    isNew?: boolean;
    isRewrite?: boolean;
  }>({});

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error } = await signIn(email, password);

    if (error) {
      setError(error);
    }

    setLoading(false);
  };

  const handleSectionChange = (section: string, params?: { editId?: string; isNew?: boolean; isRewrite?: boolean }) => {
    setActiveTab(section);
    if (section === 'editor' && params) {
      setEditorParams(params);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <img
              src="/assets/logo.png"
              alt="La Voz del Norte"
              className="h-16 w-auto mx-auto mb-4"
            />
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Panel de Administración</h2>
            <p className="text-gray-600">La Voz del Norte - Diario Digital</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Correo electrónico
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            {error && (
              <div className="text-red-600 text-sm text-center">{error}</div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? 'Iniciando sesión...' : 'Iniciar sesión'}
            </button>
          </form>
          <div className="mt-4 text-center">
            <button
              onClick={() => navigate('/register')}
              className="text-sm text-blue-600 hover:underline"
            >
              ¿No tienes cuenta? Regístrate
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <img
                src="/assets/logo.png"
                alt="La Voz del Norte"
                className="h-10 w-auto mr-3"
              />
              <h1 className="text-xl font-semibold text-gray-900">Panel de Administración</h1>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/login')}
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8 overflow-x-auto">
            {[
              { id: 'articles', label: 'Artículos' },
              { id: 'ads', label: 'Anuncios' },
              { id: 'settings', label: 'Configuraciones' },
              { id: 'media', label: 'Medios' },
              { id: 'videos', label: 'Videos' },
              { id: 'automation', label: 'Automatización' },
              { id: 'emails', label: 'Correos' },
              { id: 'rss', label: 'RSS' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-lg shadow p-6">
          {activeTab === 'articles' && (
            <ArticlesManager onSectionChange={handleSectionChange} />
          )}
          {activeTab === 'ads' && (
            <AdsManager />
          )}
          {activeTab === 'settings' && (
            <SettingsCenter />
          )}
          {activeTab === 'media' && (
            <MediaManager />
          )}
          {activeTab === 'videos' && (
            <VideoManager />
          )}
          {activeTab === 'automation' && (
            <AutomationManager />
          )}
          {activeTab === 'emails' && (
            <EmailManager />
          )}
          {activeTab === 'rss' && (
            <RSSManager />
          )}
          {activeTab === 'editor' && (
            <ArticleEditor
              onExit={() => setActiveTab('articles')}
              initialEditId={editorParams.editId}
              initialNew={editorParams.isNew}
              initialRewrite={editorParams.isRewrite}
            />
          )}
        </div>
      </main>
    </div>
  );
}