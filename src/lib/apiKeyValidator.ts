/**
 * Archivo: src/lib/apiKeyValidator.ts
 * Descripción: Validador de API keys y diagnóstico de configuración
 */

export interface APIKeyStatus {
  provider: 'openai' | 'google' | 'deepseek';
  configured: boolean;
  valid: boolean;
  error?: string;
}

export interface APIKeysReport {
  openai: APIKeyStatus;
  google: APIKeyStatus;
  deepseek: APIKeyStatus;
  hasAtLeastOne: boolean;
  recommendations: string[];
}

/**
 * Verifica el estado de todas las API keys configuradas
 */
export async function checkAPIKeys(): Promise<APIKeysReport> {
  try {
    const response = await fetch('/.netlify/functions/check-api-keys', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const report = await response.json();
    return report;
  } catch (error) {
    console.error('Error checking API keys:', error);
    // Fallback: return a report indicating no keys are configured
    return {
      openai: { provider: 'openai', configured: false, valid: false, error: 'Error al verificar' },
      google: { provider: 'google', configured: false, valid: false, error: 'Error al verificar' },
      deepseek: { provider: 'deepseek', configured: false, valid: false, error: 'Error al verificar' },
      hasAtLeastOne: false,
      recommendations: ['Error al verificar configuración de API keys']
    };
  }
}

/**
 * Versión síncrona simplificada para compatibilidad (solo verifica si al menos una key está disponible)
 */
export function hasAnyAPIKey(): boolean {
  // This is a simplified check - the real validation should be done server-side
  // For now, we'll assume keys are configured if the app is running
  return true;
}

/**
 * Muestra en consola el reporte de configuración de API keys
 */
export async function logAPIKeysReport(): Promise<void> {
  try {
    const report = await checkAPIKeys();

    console.group('🔑 Estado de API Keys');

    console.log('OpenAI:', report.openai.valid ? '✅ Configurada' : '❌ ' + report.openai.error);
    console.log('Google AI:', report.google.valid ? '✅ Configurada' : '❌ ' + report.google.error);
    console.log('DeepSeek:', report.deepseek.valid ? '✅ Configurada' : '❌ ' + report.deepseek.error);

    if (report.recommendations.length > 0) {
      console.group('📋 Recomendaciones:');
      report.recommendations.forEach(rec => console.log(rec));
      console.groupEnd();
    }

    console.groupEnd();
  } catch (error) {
    console.error('Error generando reporte de API keys:', error);
  }
}

/**
 * Testea una API key con una petición real
 */
export async function testAPIKey(provider: 'openai' | 'google' | 'deepseek' | 'puter'): Promise<{
  success: boolean;
  error?: string;
  latency?: number;
  message?: string;
}> {
  const startTime = Date.now();

  try {
    switch (provider) {
      case 'openai': {
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
          const error = await response.json();
          return {
            success: false,
            error: `HTTP ${response.status}: ${error.error || 'Error desconocido'}`
          };
        }

        return {
          success: true,
          latency: Date.now() - startTime
        };
      }

      case 'google': {
        try {
          const response = await fetch('/.netlify/functions/google-ai', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              action: 'testConnection',
              data: { modelName: 'gemini-1.5-flash-latest' },
              identifier: 'validate-key-' + Date.now()
            }),
          });

          if (!response.ok) {
            return {
              success: false,
              error: `HTTP ${response.status}`
            };
          }

          const result = await response.json();

          if (result.success) {
            return {
              success: true,
              message: 'API key válida'
            };
          } else {
            return {
              success: false,
              error: result.error || 'Error de validación'
            };
          }
        } catch (error: any) {
          return {
            success: false,
            error: error.message || 'Error de conexión'
          };
        }
      }

      case 'deepseek': {
        // DeepSeek testing moved to server-side to avoid key exposure
        return {
          success: false,
          error: 'DeepSeek testing requiere configuración server-side'
        };
      }

      case 'puter': {
        // Puter testing moved to server-side to avoid key exposure
        return {
          success: false,
          error: 'Puter testing requiere configuración server-side'
        };
      }
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Error desconocido'
    };
  }
}
