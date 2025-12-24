import { useState, useEffect } from 'react';
import { supabase, UserNews } from '../lib/supabase';

export function useUserNews() {
  const [userNews, setUserNews] = useState<UserNews[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchUserNews() {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('user_news')
          .select('*')
          .eq('status', 'approved')
          .order('published_at', { ascending: false })
          .limit(20);

        if (error) throw error;
        setUserNews(data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error fetching user news');
      } finally {
        setLoading(false);
      }
    }

    fetchUserNews();
  }, []);

  // Realtime subscriptions
  useEffect(() => {
    const channel = supabase
      .channel('user_news_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_news' },
        (payload) => {
          console.log('User news table changed:', payload);
          fetchUserNews(); // Refetch user news on any change
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { userNews, loading, error };
}
