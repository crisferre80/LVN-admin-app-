import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Settings, RefreshCw } from 'lucide-react';
import { useAIModelConfig, testAPIConnection, type APIStatus } from '../hooks/useAIModelConfig';

interface AIModel {
  id: string;
  name: string;
  provider: 'google' | 'openrouter' | 'openai' | 'puter';
  description: string;
  status: 'available' | 'quota_exceeded' | 'error' | 'disabled';
  maxTokens?: number;
  contextWindow?: number;
}

const AVAILABLE_MODELS: AIModel[] = [
  {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    provider: 'google',
    description: 'Modelo avanzado con mejor rendimiento',
    status: 'available',
    maxTokens: 8192,
    contextWindow: 1048576
  },
  {
    id: 'gemini-1.5-flash-latest',
    name: 'Gemini 1.5 Flash',
    provider: 'google',
    description: 'Modelo experimental rápido y eficiente de Google AI',
    status: 'available',
    maxTokens: 8192,
    contextWindow: 1048576
  },
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    provider: 'google',
    description: 'Modelo rápido y eficiente de Google AI',
    status: 'available',
    maxTokens: 8192,
    contextWindow: 1048576
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'google',
    description: 'Modelo avanzado con mejor razonamiento',
    status: 'available',
    maxTokens: 8192,
    contextWindow: 1048576
  },
  {
    id: 'openai/gpt-4o-mini',
    name: 'GPT-4o Mini (OpenRouter)',
    provider: 'openrouter',
    description: 'GPT-4o Mini a través de OpenRouter',
    status: 'available',
    maxTokens: 128000,
    contextWindow: 128000
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o (OpenAI)',
    provider: 'openai',
    description: 'GPT-4o directamente desde OpenAI',
    status: 'available',
    maxTokens: 128000,
    contextWindow: 128000
  },
  {
    id: 'anthropic/claude-3-haiku',
    name: 'Claude 3 Haiku (OpenRouter)',
    provider: 'openrouter',
    description: 'Claude 3 Haiku a través de OpenRouter',
    status: 'available',
    maxTokens: 200000,
    contextWindow: 200000
  },
  {
    id: 'puter/gpt-4o-mini',
    name: 'GPT-4o Mini (Puter)',
    provider: 'puter',
    description: 'GPT-4o Mini a través de Puter AI - opción de respaldo',
    status: 'available',
    maxTokens: 128000,
    contextWindow: 128000
  }
];

export const AIModelSelector: React.FC = () => {
  const { config, updateConfig } = useAIModelConfig();
  const [apiStatuses, setApiStatuses] = useState<APIStatus[]>([]);
  const [testingConnection, setTestingConnection] = useState(false);

  // NO ejecutar testAPIConnections automáticamente al montar el componente
  // El usuario debe hacer clic manualmente en "Probar Conexiones"
  // useEffect(() => {
  //   testAPIConnections();
  // }, []);

  const testAPIConnections = async () => {
    console.log('🔧 [MANUAL] Usuario solicitó probar conexiones de API desde panel de configuración');
    setTestingConnection(true);
    const providers = ['google', 'openrouter', 'openai', 'puter'];
    const statuses: APIStatus[] = [];

    for (const provider of providers) {
      const status = await testAPIConnection(provider);
      statuses.push(status);
    }

    setApiStatuses(statuses);
    setTestingConnection(false);
    console.log('✅ [MANUAL] Pruebas de conexión completadas', statuses);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ok':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'quota_exceeded':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'disabled':
        return <XCircle className="h-5 w-5 text-gray-400" />;
      default:
        return <XCircle className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ok':
        return 'text-green-700 bg-green-50 border-green-200';
      case 'quota_exceeded':
        return 'text-yellow-700 bg-yellow-50 border-yellow-200';
      case 'error':
        return 'text-red-700 bg-red-50 border-red-200';
      case 'disabled':
        return 'text-gray-500 bg-gray-50 border-gray-200';
      default:
        return 'text-gray-500 bg-gray-50 border-gray-200';
    }
  };

  const moveFallbackUp = (index: number) => {
    if (index > 0) {
      const newOrder = [...config.fallbackOrder];
      [newOrder[index], newOrder[index - 1]] = [newOrder[index - 1], newOrder[index]];
      updateConfig({ fallbackOrder: newOrder });
    }
  };

  const moveFallbackDown = (index: number) => {
    if (index < config.fallbackOrder.length - 1) {
      const newOrder = [...config.fallbackOrder];
      [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
      updateConfig({ fallbackOrder: newOrder });
    }
  };

  const handleSave = () => {
    // La configuración ya se guarda automáticamente en el hook
    alert('Configuración guardada exitosamente');
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Configuración de Modelos IA</h2>
        <button
          onClick={testAPIConnections}
          disabled={testingConnection}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${testingConnection ? 'animate-spin' : ''}`} />
          Probar Conexiones
        </button>
      </div>

      {/* Estado de APIs */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Estado de APIs</h3>
        <p className="text-sm text-gray-600 mb-4">
          ⚠️ <strong>Importante:</strong> Al hacer clic en "Probar Conexiones", se realizarán llamadas reales a las APIs 
          que consumen cuota. Solo prueba cuando sea necesario.
        </p>
        <div className="grid gap-4 md:grid-cols-3">
          {apiStatuses.length === 0 ? (
            <div className="col-span-3 text-center py-8 text-gray-500">
              <p>Haz clic en "Probar Conexiones" para verificar el estado de las APIs</p>
            </div>
          ) : (
            apiStatuses.map((api) => (
              <div key={api.provider} className={`p-4 rounded-lg border ${getStatusColor(api.status)}`}>
                <div className="flex items-center gap-3">
                  {getStatusIcon(api.status)}
                  <div>
                    <h4 className="font-medium">{api.provider === 'puter' ? 'Puter AI' : api.provider.charAt(0).toUpperCase() + api.provider.slice(1)}</h4>
                    <p className="text-sm">{api.message}</p>
                    <p className="text-xs mt-1">
                      Última verificación: {api.lastChecked.toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Selección de Modelo Principal */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Modelo Principal</h3>
        <div className="grid gap-4 md:grid-cols-2">
          {AVAILABLE_MODELS.map((model) => (
            <div
              key={model.id}
              onClick={() => model.status === 'available' && updateConfig({ selectedModel: model.id })}
              className={`p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                config.selectedModel === model.id
                  ? 'border-blue-500 bg-blue-50'
                  : model.status === 'available'
                  ? 'border-gray-200 hover:border-gray-300'
                  : 'border-gray-100 bg-gray-50 cursor-not-allowed'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-medium text-gray-900">{model.name}</h4>
                  <p className="text-sm text-gray-600 mt-1">{model.description}</p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                    <span>Proveedor: {model.provider}</span>
                    {model.maxTokens && <span>Max tokens: {model.maxTokens.toLocaleString()}</span>}
                  </div>
                </div>
                {config.selectedModel === model.id && (
                  <CheckCircle className="h-5 w-5 text-blue-500" />
                )}
              </div>
              {model.status !== 'available' && (
                <p className="text-xs text-red-500 mt-2">
                  {model.status === 'disabled' ? 'Deshabilitado' :
                   model.status === 'quota_exceeded' ? 'Cuota excedida' : 'No disponible'}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Orden de Fallback */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Orden de Fallback</h3>
        <p className="text-sm text-gray-600 mb-4">
          Si el modelo principal falla, el sistema intentará usar los proveedores en este orden.
        </p>
        <div className="space-y-3">
          {config.fallbackOrder.map((provider: string, index: number) => {
            const apiStatus = apiStatuses.find(api =>
              api.provider.toLowerCase().includes(provider.toLowerCase())
            );
            const isAvailable = apiStatus?.status === 'ok';

            return (
              <div key={provider} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <span className="text-sm font-medium text-gray-700 w-8">{index + 1}.</span>
                <div className="flex-1">
                  <span className="font-medium capitalize">{provider}</span>
                  {apiStatus && (
                    <span className={`ml-2 text-xs ${isAvailable ? 'text-green-600' : 'text-red-600'}`}>
                      ({apiStatus.message})
                    </span>
                  )}
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => moveFallbackUp(index)}
                    disabled={index === 0}
                    className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => moveFallbackDown(index)}
                    disabled={index === config.fallbackOrder.length - 1}
                    className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                  >
                    ↓
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Botón de Guardar */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
        >
          <Settings className="h-4 w-4" />
          Guardar Configuración
        </button>
      </div>
    </div>
  );
};

export default AIModelSelector;