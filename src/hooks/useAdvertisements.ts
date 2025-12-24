import { useState, useEffect } from 'react';
import { supabase, Advertisement } from '../lib/supabase';

export function useAdvertisements(placement: string) {
  const [ads, setAds] = useState<Advertisement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAds() {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('advertisements')
          .select('*')
          .eq('placement', placement)
          .eq('is_active', true)
          .order('order', { ascending: true });

        if (error) throw error;
        setAds(data || []);
      } catch (err) {
        console.error('Error fetching ads:', err);
        // Don't throw, just log
      } finally {
        setLoading(false);
      }
    }

    fetchAds();
  }, [placement]);

  // Realtime subscriptions
  useEffect(() => {
    const channel = supabase
      .channel('advertisements_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'advertisements' },
        (payload) => {
          console.log('Advertisements table changed:', payload);
          fetchAds(); // Refetch ads on any change
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [placement]);

  return { ads, loading };
}
