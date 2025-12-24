import { useState } from 'react';
import { Trash2, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

export function CleanupManager() {
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<{
    total: number;
    deleted: number;
    remaining: number;
    details: string[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runCleanup = async () => {
    setIsLoading(true);
    setError(null);
    setResults(null);

    try {
      console.log('🧹 Iniciando limpieza de artículos sin foto o con foto rota...');

      // Obtener todos los artículos
      const { data: articles, error: fetchError } = await supabase
        .from('articles')
        .select('id, title, image_url, category')
        .order('created_at', { ascending: false });

      if (fetchError) {
        throw new Error(`Error obteniendo artículos: ${fetchError.message}`);
      }

      const totalArticles = articles?.length || 0;
      console.log(`📊 Total de artículos encontrados: ${totalArticles}`);

      let deletedCount = 0;
      const deletedDetails: string[] = [];

      // Procesar en lotes para evitar timeouts
      const batchSize = 10;
      for (let i = 0; i < totalArticles; i += batchSize) {
        const batch = articles!.slice(i, i + batchSize);

        for (const article of batch) {
          let shouldDelete = false;
          let reason = '';

          if (!article.image_url || article.image_url.trim() === '') {
            shouldDelete = true;
            reason = 'sin image_url';
          } else {
            // Verificar si la URL es accesible
            try {
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 segundos timeout

              const response = await fetch(article.image_url, {
                method: 'HEAD',
                headers: {
                  'User-Agent': 'Mozilla/5.0 (compatible; DiarioSantiago/1.0)',
                },
                signal: controller.signal
              });

              clearTimeout(timeoutId);

              if (!response.ok) {
                shouldDelete = true;
                reason = 'foto rota';
              }
            } catch {
              shouldDelete = true;
              reason = 'foto rota';
            }
          }

          if (shouldDelete) {
            const { error: deleteError } = await supabase
              .from('articles')
              .delete()
              .eq('id', article.id);

            if (deleteError) {
              console.error(`❌ Error eliminando artículo ${article.id}:`, deleteError);
            } else {
              deletedCount++;
              deletedDetails.push(`"${article.title}" (${reason})`);
              console.log(`🗑️ Eliminado: "${article.title}" (${reason})`);
            }
          }
        }

        // Actualizar progreso
        const progress = Math.min(i + batchSize, totalArticles);
        console.log(`🔍 Progreso: ${progress}/${totalArticles}, Eliminados: ${deletedCount}`);
      }

      const remaining = totalArticles - deletedCount;

      setResults({
        total: totalArticles,
        deleted: deletedCount,
        remaining,
        details: deletedDetails.slice(0, 10) // Mostrar solo los primeros 10
      });

      console.log(`✅ Limpieza completada: ${deletedCount} eliminados, ${remaining} restantes`);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">
          Limpieza de Artículos
        </h2>
        <p className="text-slate-600">
          Elimina automáticamente artículos que no tengan foto o tengan fotos rotas.
        </p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-medium text-amber-800 mb-1">Advertencia</h3>
            <p className="text-sm text-amber-700">
              Esta acción eliminará permanentemente artículos de la base de datos.
              Asegúrate de tener una copia de seguridad antes de proceder.
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={runCleanup}
          disabled={isLoading}
          className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
          {isLoading ? 'Ejecutando limpieza...' : 'Ejecutar Limpieza'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-red-800 mb-1">Error</h3>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {results && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div className="w-full">
              <h3 className="font-medium text-green-800 mb-2">Limpieza Completada</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="bg-white rounded-lg p-3 border border-green-200">
                  <div className="text-2xl font-bold text-green-600">{results.total}</div>
                  <div className="text-sm text-green-700">Total verificados</div>
                </div>
                <div className="bg-white rounded-lg p-3 border border-red-200">
                  <div className="text-2xl font-bold text-red-600">{results.deleted}</div>
                  <div className="text-sm text-red-700">Eliminados</div>
                </div>
                <div className="bg-white rounded-lg p-3 border border-blue-200">
                  <div className="text-2xl font-bold text-blue-600">{results.remaining}</div>
                  <div className="text-sm text-blue-700">Restantes</div>
                </div>
              </div>
              {results.details.length > 0 && (
                <div>
                  <h4 className="font-medium text-green-800 mb-2">Artículos eliminados:</h4>
                  <div className="bg-white rounded-lg border border-green-200 p-3 max-h-40 overflow-y-auto">
                    <ul className="text-sm text-green-700 space-y-1">
                      {results.details.map((detail, index) => (
                        <li key={index} className="truncate">• {detail}</li>
                      ))}
                      {results.deleted > results.details.length && (
                        <li className="text-green-600 italic">
                          ... y {results.deleted - results.details.length} más
                        </li>
                      )}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}