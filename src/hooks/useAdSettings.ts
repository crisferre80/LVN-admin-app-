import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function useAdSettings() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSettings() {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('ad_settings')
          .select('*');

        if (error) {
          console.error('Error fetching ad settings:', error);
          // Try to create default settings
          try {
            const { error: insertError } = await supabase
              .from('ad_settings')
              .upsert([
                {
                  key: 'articles_between_ads',
                  value: '3',
                  description: 'Número de artículos entre publicidades en la lista principal'
                },
                {
                  key: 'sidebar_ads_interval',
                  value: '5',
                  description: 'Número de artículos entre publicidades en barra lateral (si se implementa)'
                }
              ], { onConflict: 'key' });

            if (!insertError) {
              // Fetch again after insert
              const { data: newData } = await supabase
                .from('ad_settings')
                .select('*');
              if (newData) {
                const settingsMap: Record<string, string> = {};
                newData.forEach(setting => {
                  settingsMap[setting.key] = setting.value;
                });
                setSettings(settingsMap);
              }
            }
          } catch (insertErr) {
            console.error('Error creating default settings:', insertErr);
          }
        } else {
          const settingsMap: Record<string, string> = {};
          data?.forEach(setting => {
            settingsMap[setting.key] = setting.value;
          });
          setSettings(settingsMap);
        }
      } catch (err) {
        console.error('Error in fetchSettings:', err);
        // Set defaults if error
        setSettings({
          articles_between_ads: '3',
          sidebar_ads_interval: '5'
        });
      } finally {
        setLoading(false);
      }
    }

    fetchSettings();
  }, []);

  // Realtime subscriptions
  useEffect(() => {
    const channel = supabase
      .channel('ad_settings_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ad_settings' },
        (payload) => {
          console.log('Ad settings table changed:', payload);
          fetchSettings(); // Refetch settings on any change
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const getSetting = (key: string, defaultValue: string = ''): string => {
    return settings[key] || defaultValue;
  };

  const getSettingNumber = (key: string, defaultValue: number = 0): number => {
    const value = settings[key];
    const parsed = parseInt(value || '', 10);
    return isNaN(parsed) ? defaultValue : parsed;
  };

  const getSettingBoolean = (key: string, defaultValue: boolean = false): boolean => {
    const value = settings[key];
    if (value === undefined || value === null) return defaultValue;
    // Accept '1'/'0' or 'true'/'false'
    if (value === '1' || value.toLowerCase?.() === 'true') return true;
    if (value === '0' || value.toLowerCase?.() === 'false') return false;
    return defaultValue;
  };

  return { settings, loading, getSetting, getSettingNumber, getSettingBoolean };
}