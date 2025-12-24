import { useState, useEffect, useCallback } from 'react';
import { supabase, Article, AIGeneratedArticle } from '../lib/supabase';
import { articlesCache } from '../lib/articlesCache';

export type CombinedArticle = (Article | AIGeneratedArticle) & { isAI?: boolean };

export function useArticles(category?: string, page = 1, pageSize = 20) {
  const [articles, setArticles] = useState<CombinedArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);

  const fetchArticles = useCallback(async () => {
    try {
      setLoading(true);

      // Intentar obtener datos del caché primero
      const cached = articlesCache.get({ category, page, pageSize });
      if (cached) {
        console.log('[useArticles] 📦 Usando datos del caché');
        setArticles(cached.data);
        setTotalCount(cached.totalCount);
        setLoading(false);
        return;
      }

      console.log('[useArticles] 🔄 Obteniendo datos desde la base de datos');
      const startTime = Date.now();

      // Fetch regular RSS articles (get more than needed for pagination)
      let rssQuery = supabase
        .from('articles')
        .select(`*, is_featured`) // Added is_featured field
        .order('published_at', { ascending: false }) // Order by date (newest first)
        .limit(200); // Get more articles to ensure we have enough for pagination

      if (category) {
        rssQuery = rssQuery.ilike('category', category);
      }

        const { data: rssArticles, error: rssError } = await rssQuery;

        if (rssError) throw rssError;

        // Fetch published AI-generated articles (get more than needed for pagination)
        let aiQuery = supabase
          .from('ai_generated_articles')
          .select(`*, is_featured`) // Added is_featured field
          .eq('status', 'published')
          .order('published_at', { ascending: false }) // Order by date (newest first)
          .limit(200); // Get more articles to ensure we have enough for pagination

        if (category) {
          aiQuery = aiQuery.ilike('category', category);
        }

        const { data: aiArticles, error: aiError } = await aiQuery;

        if (aiError) throw aiError;

        // Fetch local news articles, try with `is_featured` and fallback if column missing
        let localNewsArticles: any[] | null = null;
        let localNewsError: any = null;

        const makeLocalQuery = (selectStr: string) => {
          let q: any = supabase
            .from('local_news')
            .select(selectStr)
            .eq('is_active', true)
            .order('published_at', { ascending: false })
            .limit(200);

          if (category) q = q.ilike('category', category);
          return q;
        };

        // Primero intentamos con is_featured (el campo puede no existir)
        try {
          const { data, error } = await makeLocalQuery(`*, is_featured`);
          localNewsArticles = data;
          localNewsError = error;

          // Si el error indica columna inexistente (42703), reintentar sin is_featured
          if (localNewsError && localNewsError.code === '42703') {
            console.warn('Campo is_featured no existe en local_news; reintentando sin is_featured');
            const { data: data2, error: error2 } = await makeLocalQuery(`*`);
            localNewsArticles = data2;
            localNewsError = error2;
          }

          if (localNewsError) console.warn('Error fetching local news:', localNewsError);
        } catch (err) {
          console.warn('Error fetching local news:', err);
        }

        // Filter and prepare articles
        const aiArticlesFiltered = (aiArticles || [])
          .filter(article => article.image_url && article.image_url.trim() !== '') // Filtrar artículos sin imagen
          .map(article => ({ ...article, isAI: true }));

        const rssArticlesFiltered = (rssArticles || [])
          .filter(article => article.image_url && article.image_url.trim() !== '') // Filtrar artículos sin imagen
          .map(article => ({ ...article, isAI: false }));

        const localNewsArticlesFiltered = (localNewsArticles || [])
          .filter(article => article.image_url && article.image_url.trim() !== '') // Filtrar artículos sin imagen
          .map(article => ({ 
            ...article, 
            isAI: false,
            description: article.summary || article.content?.substring(0, 200) || ''
          }));

        // Combine articles and sort by created_at date (newest first), prioritizing AI articles
        const combinedArticles: CombinedArticle[] = [...aiArticlesFiltered, ...rssArticlesFiltered, ...localNewsArticlesFiltered];

        // Sort by: 1) AI articles first, 2) created_at date (newest first)
        combinedArticles.sort((a, b) => {
          // Priority to AI articles
          if (a.isAI && !b.isAI) return -1;
          if (!a.isAI && b.isAI) return 1;
          
          // Both same type, sort by created_at date (newest first)
          const dateA = new Date((a as any).created_at).getTime();
          const dateB = new Date((b as any).created_at).getTime();
          return dateB - dateA;
        });

        // Apply pagination to combined results
        const startIndex = (page - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        const paginatedArticles = combinedArticles.slice(startIndex, endIndex);

        // Calculate total count (after filtering)
        const totalCountValue = aiArticlesFiltered.length + rssArticlesFiltered.length + localNewsArticlesFiltered.length;
        setTotalCount(totalCountValue);

        setArticles(paginatedArticles);

        // Guardar en caché
        articlesCache.set({ category, page, pageSize }, paginatedArticles, totalCountValue);
        
        const duration = Date.now() - startTime;
        console.log(`[useArticles] ✅ Datos obtenidos y cacheados en ${duration}ms`);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Error fetching articles';
        setError(errorMessage);
        console.error('[useArticles] ❌ Error:', errorMessage);
      } finally {
        setLoading(false);
      }
  }, [category, page, pageSize]);

  useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('articles-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'articles' },
        (payload) => {
          console.log('Articles table changed:', payload);
          fetchArticles(); // Refetch articles on any change
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ai_generated_articles' },
        (payload) => {
          console.log('AI articles table changed:', payload);
          fetchArticles(); // Refetch articles on any change
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'news_api_articles' },
        (payload) => {
          console.log('NewsAPI articles table changed:', payload);
          fetchArticles(); // Refetch articles on any change
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'local_news' },
        (payload) => {
          console.log('Local news table changed:', payload);
          fetchArticles(); // Refetch articles on any change
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchArticles]); // Depend on fetchArticles

  return { articles, loading, error, totalCount };
}
