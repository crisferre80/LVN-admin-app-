import { useState } from 'react';
import { Zap, Loader, CheckCircle2, XCircle, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { JOURNALISTIC_PROMPTS, JournalisticStyle, formatPrompt } from '../types/articlePrompts';
import { useAIModelConfig } from '../hooks/useAIModelConfig';
import { markdownToHtml, cleanAIGeneratedContent } from '../lib/markdownUtils';
import { generateWithOpenRouter } from '../lib/openRouter';
import { generateWithOpenAI } from '../lib/openai';
import { enforceGoogleAIRateLimit } from '../lib/googleAI';
import { manageFeaturedStatus } from '../lib/articleUtils';
import toast from 'react-hot-toast';

interface BulkGenerationConfig {
  categories: string[];
  style: JournalisticStyle;
  count: number;
  topics: string[];
}

interface GenerationResult {
  category: string;
  topic: string;
  status: 'pending' | 'generating' | 'success' | 'error';
  articleId?: string;
  error?: string;
  title?: string;
}

const CATEGORIES = [
  'Nacionales',
  'Regionales',
  'Internacionales',
  'Economía',
  'Deportes',
  'Espectaculos',
  'Medio Ambiente',
  'Opinión'
];

export function BulkArticleGenerator({ onComplete }: { onComplete?: () => void }) {
  const { config: aiConfig } = useAIModelConfig();
  const [config, setConfig] = useState<BulkGenerationConfig>({
    categories: [],
    style: 'noticia-objetiva',
    count: 1,
    topics: ['']
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [results, setResults] = useState<GenerationResult[]>([]);
  const [showResults, setShowResults] = useState(false);

  const handleCategoryToggle = (category: string) => {
    setConfig(prev => ({
      ...prev,
      categories: prev.categories.includes(category)
        ? prev.categories.filter(c => c !== category)
        : [...prev.categories, category]
    }));
  };

  const handleTopicChange = (index: number, value: string) => {
    const newTopics = [...config.topics];
    newTopics[index] = value;
    setConfig(prev => ({ ...prev, topics: newTopics }));
  };

  const addTopic = () => {
    setConfig(prev => ({ ...prev, topics: [...prev.topics, ''] }));
  };

  const removeTopic = (index: number) => {
    setConfig(prev => ({
      ...prev,
      topics: prev.topics.filter((_, i) => i !== index)
    }));
  };

  const generateArticleContent = async (
    topic: string,
    category: string,
    style: JournalisticStyle
  ): Promise<{ title: string; content: string; description: string }> => {
    const { systemPrompt, userPrompt } = formatPrompt(
      style,
      topic,
      `Categoría del artículo: ${category}`
    );

    const openrouterApiKey = import.meta.env.VITE_OPENROUTER_API_KEY;
    const openaiApiKey = import.meta.env.VITE_OPENAI_API_KEY;

    let generatedContent = '';
    let provider = '';

    // Estado de proveedores fallidos
    let googleFailed = false;
    let openrouterFailed = false;
    let openaiFailed = false;

    // Usar el orden de fallback configurado
    for (const providerName of aiConfig.fallbackOrder) {
      if (generatedContent) break; // Si ya tenemos contenido, salir

      switch (providerName) {
        case 'google':
          if (!googleFailed) {
            try {
              console.log('Intentando con Google AI...');

              const response = await fetch('/.netlify/functions/google-ai', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  action: 'generateContent',
                  data: { prompt: `${systemPrompt}\n\n${userPrompt}`, modelName: 'gemini-2.0-flash-exp' },
                  identifier: 'bulk-gen-' + Date.now()
                }),
              });

              if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
              }

              const result = await response.json();

              if (result.content) {
                generatedContent = result.content;
                provider = 'Google AI';
              } else {
                throw new Error(result.error || 'Error generating content');
              }
              console.log('✅ Artículo generado con Google AI');
            } catch (error: any) {
              console.warn('Google AI falló:', error?.message);
              // Si es error de cuota, marcar como fallido
              if (error?.message?.includes('quota') || error?.message?.includes('429') || error?.message?.includes('exceeded')) {
                console.warn('Cuota de Google AI excedida, marcando como fallido');
                googleFailed = true;
              }
            }
          }
          break;

        case 'openrouter':
          if (openrouterApiKey && !openrouterFailed) {
            try {
              console.log('Intentando con OpenRouter...');
              const result = await generateWithOpenRouter(
                `${systemPrompt}\n\n${userPrompt}`,
                {
                  systemPrompt,
                  maxTokens: 2000
                }
              );
              if (result) {
                generatedContent = result;
                provider = 'OpenRouter';
                console.log('✅ Artículo generado con OpenRouter');
              }
            } catch (error) {
              console.warn('OpenRouter falló:', error);
              openrouterFailed = true;
            }
          }
          break;

        case 'openai':
          if (openaiApiKey && !openaiFailed) {
            try {
              console.log('Intentando con OpenAI...');
              const result = await generateWithOpenAI(
                `${systemPrompt}\n\n${userPrompt}`,
                {
                  systemPrompt,
                  maxTokens: 2000
                }
              );
              if (result) {
                generatedContent = result;
                provider = 'OpenAI';
                console.log('✅ Artículo generado con OpenAI');
              }
            } catch (error) {
              console.warn('OpenAI falló:', error);
              openaiFailed = true;
            }
          }
          break;
      }
    }

    if (!generatedContent) {
      const failedProviders = [];
      if (googleFailed) failedProviders.push('Google AI (cuota excedida)');
      if (openrouterFailed) failedProviders.push('OpenRouter (error)');
      if (openaiFailed) failedProviders.push('OpenAI (error)');

      throw new Error(`No se pudo generar contenido. Proveedores fallidos: ${failedProviders.join(', ')}`);
    }

    console.log(`Artículo generado con ${provider}`);

    // Extract title and description from generated content
    let extractedTitle = topic; // fallback
    let extractedDescription = '';
    let cleanedContent = cleanAIGeneratedContent(generatedContent);

    // Extract title (línea que comienza con **)
    const titleMatch = cleanedContent.match(/^\*\*(.+?)\*\*/m);
    if (titleMatch && titleMatch[1].trim().length > 5) {
      extractedTitle = titleMatch[1].trim();
    }

    // Extract description (línea que comienza con *)
    const descriptionMatch = cleanedContent.match(/^\*(.+?)\*/m);
    if (descriptionMatch && descriptionMatch[1].trim().length > 10) {
      extractedDescription = descriptionMatch[1].trim();
      // Limitar a 200 caracteres
      if (extractedDescription.length > 200) {
        extractedDescription = extractedDescription.substring(0, 197) + '...';
      }
    }

    // Remove title and description lines from content
    if (titleMatch) {
      cleanedContent = cleanedContent.replace(/^\*\*(.+?)\*\*\s*/, '');
    }
    if (descriptionMatch) {
      cleanedContent = cleanedContent.replace(/^\*(.+?)\*\s*/, '');
    }
    
    // Convert Markdown to HTML
    const contentHtml = markdownToHtml(cleanedContent);

    return { title: extractedTitle, content: contentHtml, description: extractedDescription };
  };

  const startGeneration = async () => {
    const validTopics = config.topics.filter(t => t.trim());
    
    if (config.categories.length === 0) {
      toast.error('Selecciona al menos una categoría');
      return;
    }

    if (validTopics.length === 0) {
      toast.error('Ingresa al menos un tema');
      return;
    }

    setIsGenerating(true);
    setShowResults(true);

    // Create combinations
    const combinations: Array<{ category: string; topic: string }> = [];
    for (const category of config.categories) {
      for (const topic of validTopics) {
        combinations.push({ category, topic });
      }
    }

    // Initialize results
    const initialResults: GenerationResult[] = combinations.map(({ category, topic }) => ({
      category,
      topic,
      status: 'pending'
    }));
    setResults(initialResults);

    // Generate articles one by one
    for (let i = 0; i < combinations.length; i++) {
      const { category, topic } = combinations[i];

      // Update status to generating
      setResults(prev => prev.map((r, idx) => 
        idx === i ? { ...r, status: 'generating' } : r
      ));

      try {
        const { title, content, description } = await generateArticleContent(
          topic,
          category,
          config.style
        );

        // Save to database
        const { data, error } = await supabase
          .from('ai_generated_articles')
          .insert([{
            title,
            content,
            summary: description,
            category,
            status: 'draft',
            is_featured: true, // Marcar como destacado automáticamente
            created_at: new Date().toISOString()
          }])
          .select('id')
          .single();

        if (error) throw error;

        // Update result as success
        setResults(prev => prev.map((r, idx) =>
          idx === i ? { ...r, status: 'success', articleId: data?.id, title } : r
        ));

        // Small delay to avoid rate limits (aumentado a 5 segundos)
        if (i < combinations.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      } catch (error) {
        console.error(`Error generando artículo ${i + 1}:`, error);
        
        let errorMessage = 'Error desconocido';
        if (error instanceof Error) {
          if (error.message.includes('quota') || error.message.includes('429') || error.message.includes('exceeded')) {
            errorMessage = 'Cuota de API excedida. Espera unos minutos antes de intentar nuevamente.';
          } else if (error.message.includes('rate limit') || error.message.includes('too many requests')) {
            errorMessage = 'Límite de velocidad excedido. Espera antes de continuar.';
          } else {
            errorMessage = error.message;
          }
        }
        
        setResults(prev => prev.map((r, idx) =>
          idx === i ? { 
            ...r, 
            status: 'error', 
            error: errorMessage
          } : r
        ));

        // Si es error de cuota, agregar delay extra antes del siguiente
        if (errorMessage.includes('cuota') || errorMessage.includes('límite de velocidad')) {
          await new Promise(resolve => setTimeout(resolve, 10000)); // 10 segundos extra
        }
      }
    }

    // Gestionar estado destacado después de generar todos los artículos
    if (successCount > 0) {
      await manageFeaturedStatus();
    }

    setIsGenerating(false);
    if (onComplete) onComplete();
  };

  const successCount = results.filter(r => r.status === 'success').length;
  const errorCount = results.filter(r => r.status === 'error').length;
  const totalCount = results.length;

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <div className="rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 p-3">
          <Zap className="h-6 w-6 text-white" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Generación Múltiple</h2>
          <p className="text-sm text-slate-500">
            Crea varios artículos simultáneamente para diferentes categorías
          </p>
        </div>
      </header>

      {!showResults ? (
        <div className="space-y-6">
          {/* Style selection */}
          <section className="rounded-3xl border border-slate-200 bg-white p-6">
            <h3 className="mb-4 text-lg font-semibold text-slate-800">
              1. Estilo periodístico
            </h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Object.values(JOURNALISTIC_PROMPTS).map(prompt => (
                <button
                  key={prompt.id}
                  type="button"
                  onClick={() => setConfig(prev => ({ ...prev, style: prompt.id }))}
                  className={`rounded-2xl border-2 p-4 text-left transition ${
                    config.style === prompt.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="mb-2 text-2xl">{prompt.icon}</div>
                  <h4 className="font-semibold text-slate-800">{prompt.name}</h4>
                  <p className="mt-1 text-xs text-slate-500">{prompt.description}</p>
                  <p className="mt-2 text-xs text-slate-400">
                    {prompt.minWords}-{prompt.maxWords} palabras
                  </p>
                </button>
              ))}
            </div>
          </section>

          {/* Category selection */}
          <section className="rounded-3xl border border-slate-200 bg-white p-6">
            <h3 className="mb-4 text-lg font-semibold text-slate-800">
              2. Categorías destino
            </h3>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map(category => (
                <button
                  key={category}
                  type="button"
                  onClick={() => handleCategoryToggle(category)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                    config.categories.includes(category)
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
            {config.categories.length > 0 && (
              <p className="mt-3 text-sm text-slate-500">
                {config.categories.length} categoría(s) seleccionada(s)
              </p>
            )}
          </section>

          {/* Topics input */}
          <section className="rounded-3xl border border-slate-200 bg-white p-6">
            <h3 className="mb-4 text-lg font-semibold text-slate-800">
              3. Temas a generar
            </h3>
            <div className="space-y-3">
              {config.topics.map((topic, idx) => (
                <div key={idx} className="flex gap-2">
                  <input
                    type="text"
                    value={topic}
                    onChange={(e) => handleTopicChange(idx, e.target.value)}
                    placeholder={`Tema ${idx + 1}: ej. "Nuevas medidas económicas del gobierno"`}
                    className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                  {config.topics.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeTopic(idx)}
                      className="rounded-xl bg-red-50 px-4 text-sm font-medium text-red-600 hover:bg-red-100"
                    >
                      Eliminar
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={addTopic}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
              >
                <Sparkles className="h-4 w-4" />
                Agregar tema
              </button>
            </div>
            <p className="mt-3 text-sm text-slate-500">
              Se generarán{' '}
              <span className="font-semibold text-blue-600">
                {config.categories.length * config.topics.filter(t => t.trim()).length}
              </span>{' '}
              artículos en total
            </p>
          </section>

          {/* Start button */}
          <button
            onClick={startGeneration}
            disabled={isGenerating || config.categories.length === 0 || config.topics.filter(t => t.trim()).length === 0}
            className="w-full rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-4 text-lg font-semibold text-white shadow-lg transition hover:from-purple-700 hover:to-pink-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isGenerating ? (
              <span className="flex items-center justify-center gap-2">
                <Loader className="h-5 w-5 animate-spin" />
                Generando artículos...
              </span>
            ) : (
              'Iniciar generación múltiple'
            )}
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Progress summary */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-sm text-slate-500">Total</p>
              <p className="text-3xl font-bold text-slate-900">{totalCount}</p>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-sm text-emerald-600">Exitosos</p>
              <p className="text-3xl font-bold text-emerald-700">{successCount}</p>
            </div>
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm text-red-600">Errores</p>
              <p className="text-3xl font-bold text-red-700">{errorCount}</p>
            </div>
          </div>

          {/* Results list */}
          <div className="space-y-3">
            {results.map((result, idx) => (
              <div
                key={idx}
                className={`rounded-2xl border p-4 ${
                  result.status === 'success'
                    ? 'border-emerald-200 bg-emerald-50/50'
                    : result.status === 'error'
                    ? 'border-red-200 bg-red-50/50'
                    : result.status === 'generating'
                    ? 'border-blue-200 bg-blue-50/50'
                    : 'border-slate-200 bg-white'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-1">
                    {result.status === 'success' && (
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    )}
                    {result.status === 'error' && (
                      <XCircle className="h-5 w-5 text-red-600" />
                    )}
                    {result.status === 'generating' && (
                      <Loader className="h-5 w-5 animate-spin text-blue-600" />
                    )}
                    {result.status === 'pending' && (
                      <div className="h-5 w-5 rounded-full border-2 border-slate-300" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-slate-800">
                      {result.title || result.topic}
                    </p>
                    <p className="text-sm text-slate-500">
                      {result.category} • {config.style}
                    </p>
                    {result.error && (
                      <p className="mt-2 text-xs text-red-600">{result.error}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Actions */}
          {!isGenerating && (
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowResults(false);
                  setResults([]);
                }}
                className="flex-1 rounded-2xl border border-slate-200 bg-white px-6 py-3 font-semibold text-slate-700 hover:bg-slate-50"
              >
                Nueva generación
              </button>
              {successCount > 0 && (
                <button
                  onClick={() => window.location.reload()}
                  className="flex-1 rounded-2xl bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700"
                >
                  Ver artículos generados
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
