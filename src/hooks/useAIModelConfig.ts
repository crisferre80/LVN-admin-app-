import { useState, useEffect } from 'react';
import { enforceGoogleAIRateLimit } from '../lib/googleAI';

export interface AIModelConfig {
  selectedModel: string;
  fallbackOrder: string[];
}

export interface APIStatus {
  provider: string;
  status: 'ok' | 'error' | 'quota_exceeded' | 'disabled';
  message: string;
  lastChecked: Date;
}

const DEFAULT_CONFIG: AIModelConfig = {
  selectedModel: 'gemini-1.5-flash-latest',
  fallbackOrder: ['openai', 'google', 'openrouter', 'puter']
};

export const useAIModelConfig = () => {
  const [config, setConfig] = useState<AIModelConfig>(DEFAULT_CONFIG);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load saved configuration
    const savedModel = localStorage.getItem('selectedAIModel');
    const savedFallback = localStorage.getItem('aiFallbackOrder');

    const loadedConfig: AIModelConfig = {
      selectedModel: savedModel || DEFAULT_CONFIG.selectedModel,
      fallbackOrder: savedFallback ? JSON.parse(savedFallback) : DEFAULT_CONFIG.fallbackOrder
    };

    setConfig(loadedConfig);
    setIsLoading(false);
  }, []);

  const updateConfig = (newConfig: Partial<AIModelConfig>) => {
    const updatedConfig = { ...config, ...newConfig };
    setConfig(updatedConfig);

    // Save to localStorage
    if (newConfig.selectedModel !== undefined) {
      localStorage.setItem('selectedAIModel', newConfig.selectedModel);
    }
    if (newConfig.fallbackOrder !== undefined) {
      localStorage.setItem('aiFallbackOrder', JSON.stringify(newConfig.fallbackOrder));
    }
  };

  const getModelInfo = (modelId: string) => {
    const models = {
      'gemini-1.5-pro': {
        name: 'Gemini 1.5 Pro',
        provider: 'google',
        description: 'Modelo avanzado con mejor rendimiento'
      },
      'gemini-1.5-flash-latest': {
        name: 'Gemini 1.5 Flash Latest',
        provider: 'google',
        description: 'Última versión del modelo rápido y eficiente de Google AI'
      },
      'gemini-1.5-pro-latest': {
        name: 'Gemini 1.5 Pro Latest',
        provider: 'google',
        description: 'Última versión del modelo avanzado de Google AI'
      },
      'gemini-2.5-flash': {
        name: 'Gemini 2.5 Flash',
        provider: 'google',
        description: 'Modelo avanzado con mejor razonamiento'
      },
      'gpt-4o': {
        name: 'GPT-4o (OpenAI)',
        provider: 'openai',
        description: 'GPT-4o directamente desde OpenAI'
      },
      'openai/gpt-4o': {
        name: 'GPT-4o (OpenRouter)',
        provider: 'openrouter',
        description: 'GPT-4o a través de OpenRouter'
      },
      'anthropic/claude-3-haiku': {
        name: 'Claude 3 Haiku (OpenRouter)',
        provider: 'openrouter',
        description: 'Claude 3 Haiku a través de OpenRouter'
      }
    };

    return models[modelId as keyof typeof models] || null;
  };

  const getProviderFromModel = (modelId: string): string => {
    const modelInfo = getModelInfo(modelId);
    return modelInfo?.provider || 'unknown';
  };

  return {
    config,
    isLoading,
    updateConfig,
    getModelInfo,
    getProviderFromModel
  };
};

export const testAPIConnection = async (provider: string): Promise<APIStatus> => {
  console.log(`🔍 [API TEST] Probando conexión con ${provider}...`);
  const now = new Date();

  try {
    switch (provider) {
      case 'google': {
        // Usar Netlify function para test de conexión
        try {
          const response = await fetch('/.netlify/functions/google-ai', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              action: 'testConnection',
              data: { modelName: 'gemini-1.5-flash-latest' },
              identifier: 'test-connection-' + Date.now()
            }),
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          const result = await response.json();

          if (result.success) {
            console.log(`✅ [API TEST] Google AI - Conexión exitosa`);
            return {
              provider: 'Google AI',
              status: 'ok',
              message: `Conexión exitosa`,
              lastChecked: now
            };
          } else if (result.isQuotaError) {
            console.log(`⚠️ [API TEST] Google AI - Cuota excedida`);
            return {
              provider: 'Google AI',
              status: 'quota_exceeded',
              message: 'Cuota excedida',
              lastChecked: now
            };
          } else {
            console.error(`❌ [API TEST] Google AI - Error:`, result.error);
            return {
              provider: 'Google AI',
              status: 'error',
              message: result.error || 'Error de conexión',
              lastChecked: now
            };
          }
        } catch (error: any) {
          console.error('❌ [API TEST] Google AI - Error de red:', error.message);
          return {
            provider: 'Google AI',
            status: 'error',
            message: 'Error de conexión',
            lastChecked: now
          };
        }
      }

      case 'openai': {
        const openaiKey = import.meta.env.VITE_OPENAI_API_KEY;
        if (!openaiKey) {
          return {
            provider: 'OpenAI',
            status: 'disabled',
            message: 'API key no configurada',
            lastChecked: now
          };
        }

        try {
          // Siempre usar ruta relativa para evitar problemas de CORS
          const netlifyFunctionUrl = '/.netlify/functions/generate-openai';

          const response = await fetch(netlifyFunctionUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              prompt: 'Test',
              model: 'gpt-4o-mini',
              maxTokens: 5
            })
          });

          if (!response.ok) {
            return {
              provider: 'OpenAI',
              status: 'error',
              message: `Error ${response.status}`,
              lastChecked: now
            };
          }

          return {
            provider: 'OpenAI',
            status: 'ok',
            message: 'Conexión exitosa',
            lastChecked: now
          };
        } catch (error) {
          return {
            provider: 'OpenAI',
            status: 'error',
            message: 'Error de conexión',
            lastChecked: now
          };
        }
      }      case 'deepseek': {
        const deepseekKey = import.meta.env.VITE_DEEPSEEK_API_KEY;
        if (!deepseekKey) {
          return {
            provider: 'DeepSeek',
            status: 'disabled',
            message: 'Proveedor deshabilitado',
            lastChecked: now
          };
        }

        return {
          provider: 'DeepSeek',
          status: 'disabled',
          message: 'Proveedor deshabilitado',
          lastChecked: now
        };
      }

      case 'openrouter': {
        const openrouterKey = import.meta.env.VITE_OPENROUTER_API_KEY;
        if (!openrouterKey) {
          return {
            provider: 'OpenRouter',
            status: 'disabled',
            message: 'API key no configurada',
            lastChecked: now
          };
        }

        const response = await fetch('https://openrouter.ai/api/v1/models', {
          headers: {
            'Authorization': `Bearer ${openrouterKey}`
          }
        });

        if (response.ok) {
          return {
            provider: 'OpenRouter',
            status: 'ok',
            message: 'Conexión exitosa',
            lastChecked: now
          };
        } else if (response.status === 429) {
          return {
            provider: 'OpenRouter',
            status: 'quota_exceeded',
            message: 'Cuota excedida',
            lastChecked: now
          };
        } else {
          return {
            provider: 'OpenRouter',
            status: 'error',
            message: `Error ${response.status}`,
            lastChecked: now
          };
        }
      }

      default:
        return {
          provider,
          status: 'disabled',
          message: 'Proveedor no soportado',
          lastChecked: now
        };
    }
  } catch (error: any) {
    let status: 'error' | 'quota_exceeded' = 'error';
    let message = 'Error de conexión';

    if (error?.message?.includes('quota') || error?.message?.includes('429')) {
      status = 'quota_exceeded';
      message = 'Cuota excedida';
    }

    return {
      provider,
      status,
      message,
      lastChecked: now
    };
  }
};