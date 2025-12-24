import { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle2, XCircle, Loader, Play } from 'lucide-react';
import { checkAPIKeys, testAPIKey, type APIKeyStatus, type APIKeysReport } from '../lib/apiKeyValidator';

interface TestResult {
  provider: 'openai' | 'google' | 'deepseek';
  testing: boolean;
  success?: boolean;
  error?: string;
  latency?: number;
}

export function APIKeyDiagnostic() {
  const [results, setResults] = useState<TestResult[]>([]);
  const [report, setReport] = useState<APIKeysReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadReport = async () => {
      try {
        const apiReport = await checkAPIKeys();
        setReport(apiReport);
      } catch (error) {
        console.error('Error loading API keys report:', error);
      } finally {
        setLoading(false);
      }
    };

    loadReport();
  }, []);

  const handleTest = async (provider: 'openai' | 'google' | 'deepseek') => {
    setResults(prev => [...prev.filter(r => r.provider !== provider), {
      provider,
      testing: true
    }]);

    const result = await testAPIKey(provider);

    setResults(prev => prev.map(r => 
      r.provider === provider 
        ? { ...r, testing: false, ...result } 
        : r
    ));
  };

  const handleTestAll = async () => {
    if (!report) return;

    const providers: Array<'openai' | 'google' | 'deepseek'> = ['openai', 'google', 'deepseek'];
    
    for (const provider of providers) {
      const status = report[provider];
      if (status.valid) {
        await handleTest(provider);
      }
    }
  };

  const getTestResult = (provider: string) => {
    return results.find(r => r.provider === provider);
  };

  if (loading || !report) {
    return (
      <div className="p-6 flex items-center justify-center">
        <Loader className="w-6 h-6 animate-spin" />
        <span className="ml-2">Cargando configuración de API keys...</span>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Diagnóstico de API Keys</h2>
          <p className="text-sm text-slate-500 mt-1">Verifica el estado de las claves API configuradas</p>
        </div>
        <button
          onClick={handleTestAll}
          disabled={!report.hasAtLeastOne}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
        >
          <Play className="w-4 h-4" />
          Probar Todas
        </button>
      </div>

      {!report.hasAtLeastOne && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-900">No hay API keys configuradas</h3>
              <p className="text-sm text-red-700 mt-1">
                Debes configurar al menos una API key en tu archivo .env para usar la generación de contenido con IA.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {/* OpenAI */}
        <APIKeyRow
          name="OpenAI GPT-4"
          status={report.openai}
          testResult={getTestResult('openai')}
          onTest={() => handleTest('openai')}
          description="Recomendado para artículos de alta calidad"
        />

        {/* Google AI */}
        <APIKeyRow
          name="Google Gemini"
          status={report.google}
          testResult={getTestResult('google')}
          onTest={() => handleTest('google')}
          description="Rápido y económico, buen balance"
        />

        {/* DeepSeek */}
        <APIKeyRow
          name="DeepSeek Chat"
          status={report.deepseek}
          testResult={getTestResult('deepseek')}
          onTest={() => handleTest('deepseek')}
          description="Alternativa económica"
        />
      </div>

      {report.recommendations.length > 0 && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <h3 className="font-semibold text-blue-900 mb-2">📋 Recomendaciones</h3>
          <ul className="space-y-1 text-sm text-blue-800">
            {report.recommendations.map((rec, idx) => (
              <li key={idx}>{rec}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="p-4 bg-slate-50 rounded-xl">
        <h3 className="font-semibold text-slate-900 mb-2 text-sm">ℹ️ Cómo configurar las API Keys</h3>
        <ol className="list-decimal list-inside space-y-2 text-sm text-slate-700">
          <li>Crea un archivo <code className="px-1 py-0.5 bg-white border rounded text-xs">.env</code> en la raíz del proyecto</li>
          <li>Copia el contenido de <code className="px-1 py-0.5 bg-white border rounded text-xs">.env.example</code></li>
          <li>Reemplaza los valores con tus API keys reales</li>
          <li>Reinicia el servidor de desarrollo (<code className="px-1 py-0.5 bg-white border rounded text-xs">npm run dev</code>)</li>
        </ol>
        <div className="mt-3 text-sm text-slate-600">
          <p className="font-semibold">Dónde obtener las API keys:</p>
          <ul className="mt-1 space-y-1">
            <li>• OpenAI: <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">platform.openai.com/api-keys</a></li>
            <li>• Google AI: <a href="https://makersuite.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">makersuite.google.com/app/apikey</a></li>
            <li>• DeepSeek: <a href="https://platform.deepseek.com/api_keys" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">platform.deepseek.com/api_keys</a></li>
          </ul>
        </div>
      </div>
    </div>
  );
}

interface APIKeyRowProps {
  name: string;
  status: APIKeyStatus;
  testResult?: TestResult;
  onTest: () => void;
  description: string;
}

function APIKeyRow({ name, status, testResult, onTest, description }: APIKeyRowProps) {
  const getStatusIcon = () => {
    if (status.valid) {
      return <CheckCircle2 className="w-5 h-5 text-green-600" />;
    }
    if (status.configured) {
      return <AlertCircle className="w-5 h-5 text-yellow-600" />;
    }
    return <XCircle className="w-5 h-5 text-red-600" />;
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3 flex-1">
          {getStatusIcon()}
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-900">{name}</h3>
              {status.valid && (
                <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 rounded">
                  Configurada
                </span>
              )}
            </div>
            <p className="text-sm text-gray-600 mt-0.5">{description}</p>
            {status.error && (
              <p className="text-sm text-red-600 mt-1">❌ {status.error}</p>
            )}

            {testResult && !testResult.testing && (
              <div className="mt-2">
                {testResult.success ? (
                  <div className="flex items-center gap-2 text-sm text-green-700">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>✅ Funcionando correctamente ({testResult.latency}ms)</span>
                  </div>
                ) : (
                  <div className="text-sm text-red-700">
                    <div className="flex items-center gap-2">
                      <XCircle className="w-4 h-4" />
                      <span>❌ Error en la prueba</span>
                    </div>
                    <p className="mt-1 text-xs">{testResult.error}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <button
          onClick={onTest}
          disabled={!status.valid || testResult?.testing}
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {testResult?.testing ? (
            <>
              <Loader className="w-4 h-4 animate-spin" />
              Probando...
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Probar
            </>
          )}
        </button>
      </div>
    </div>
  );
}
