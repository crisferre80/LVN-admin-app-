// @ts-nocheck
// This file is a Deno Edge Function and should not be type-checked by TypeScript

import { serve } from 'https://deno.land/std@0.199.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CleanupResult {
  success: boolean;
  total: number;
  deleted: number;
  remaining: number;
  details: Array<{
    title: string;
    reason: string;
    category: string;
  }>;
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Get all articles
    const { data: articles, error: fetchError } = await supabaseClient
      .from('articles')
      .select('id, title, image_url, category')
      .order('created_at', { ascending: false });

    if (fetchError) {
      throw new Error(`Error fetching articles: ${fetchError.message}`);
    }

    let deletedCount = 0;
    const deletedDetails = [];
    const totalArticles = articles?.length || 0;

    console.log(`Starting cleanup of ${totalArticles} articles...`);

    // Check each article
    for (const article of articles || []) {
      let shouldDelete = false;
      let reason = '';

      if (!article.image_url || article.image_url.trim() === '') {
        shouldDelete = true;
        reason = 'sin image_url';
      } else {
        // Check if URL is accessible
        try {
          const response = await fetch(article.image_url, {
            method: 'HEAD',
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; DiarioSantiagoDelEstero/1.0)',
            },
            signal: AbortSignal.timeout(5000), // 5 seconds timeout
          });

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
        const { error: deleteError } = await supabaseClient
          .from('articles')
          .delete()
          .eq('id', article.id);

        if (deleteError) {
          console.error(`Error deleting article ${article.id}:`, deleteError);
        } else {
          deletedCount++;
          deletedDetails.push({
            title: article.title,
            reason,
            category: article.category,
          });
        }
      }
    }

    const remaining = totalArticles - deletedCount;

    const result = {
      success: true,
      total: totalArticles,
      deleted: deletedCount,
      remaining,
      details: deletedDetails.slice(0, 10), // Return only first 10 details
    };

    console.log(`Cleanup completed: ${deletedCount} articles deleted`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Error in cleanup function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});