import { useState, useEffect } from 'react';
import { supabase, ClassifiedAd } from '../lib/supabase';

export function useClassifieds(category?: string) {
  const [classifieds, setClassifieds] = useState<ClassifiedAd[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchClassifieds() {
      try {
        setLoading(true);
        let query = supabase
          .from('classified_ads')
          .select('*')
          .eq('status', 'approved')
          .gte('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false });

        if (category && category !== 'Todas') {
          query = query.eq('category', category);
        }

        const { data, error } = await query;

        if (error) throw error;
        setClassifieds(data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error fetching classifieds');
      } finally {
        setLoading(false);
      }
    }

    fetchClassifieds();
  }, [category]);

  // Realtime subscriptions
  useEffect(() => {
    const channel = supabase
      .channel('classified_ads_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'classified_ads' },
        (payload) => {
          console.log('Classified ads table changed:', payload);
          fetchClassifieds(); // Refetch classifieds on any change
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [category]);

  return { classifieds, loading, error };
}
