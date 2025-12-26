import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Cliente de Supabase con configuración optimizada para mantener sesión
 * 
 * Configuración clave:
 * - persistSession: false - No mantener sesión en localStorage
 * - autoRefreshToken: true - Refresca token automáticamente
 * - detectSessionInUrl: true - Detecta sesión en URL (para OAuth)
 * - flowType: 'pkce' - Flujo seguro de autenticación
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Persistir sesión para mantener autenticación (necesario para funcionalidad)
    persistSession: true,
    
    // Refrescar token automáticamente (recomendado)
    autoRefreshToken: true,
    
    // Detectar sesión en URL (importante para OAuth y enlaces de confirmación)
    detectSessionInUrl: true,
    
    // Flujo seguro de autenticación (PKCE)
    flowType: 'pkce',
    
    // Habilitar debug en desarrollo (cambiar a true si necesitas logs detallados)
    debug: false,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
  db: {
    schema: 'public',
  },
  global: {
    headers: {
      'X-Client-Info': 'diario-santiago',
    },
  },
});

export type Article = {
  id: string;
  rss_source_id: string;
  title: string;
  translated_title?: string | null;
  description: string | null;
  translated_description?: string | null;
  content: string | null;
  url: string;
  image_url: string | null;
  author: string | null;
  category: string;
  published_at: string;
  created_at: string;
  visits?: number;
  is_featured?: boolean;
  audio_url?: string | null;
  gallery_urls?: string[] | null;
  gallery_template?: string | null;
  rss_sources?: {
    name: string;
    country: string;
  };
};

export type AIGeneratedArticle = {
  id: string;
  title: string;
  content: string;
  category: string;
  status: 'draft' | 'published';
  source_rss_id?: string;
  prompt_used?: string;
  image_url?: string;
  image_caption?: string;
  summary?: string;
  created_at: string;
  published_at?: string;
  updated_at: string;
  visits?: number;
  is_featured?: boolean;
  audio_url?: string | null;
  gallery_urls?: string[] | null;
  gallery_template?: string | null;
  rss_sources?: {
    name: string;
    country: string;
  };
};

export type ClassifiedAd = {
  id: string;
  title: string;
  description: string;
  category: string;
  price: number | null;
  contact_name: string;
  contact_phone: string | null;
  contact_email: string | null;
  image_url: string | null;
  status: string;
  created_at: string;
  expires_at: string;
};

export type UserNews = {
  id: string;
  title: string;
  content: string;
  author_name: string;
  author_email: string;
  location: string | null;
  image_url: string | null;
  status: string;
  created_at: string;
  published_at: string | null;
};

export type Advertisement = {
  id: string;
  title: string;
  image_url: string;
  link_url: string;
  placement: string; // Changed from 'position' to match database column
  width: number;
  height: number;
  is_active: boolean;
  start_date: string;
  end_date: string | null;
  click_count?: number;
  impression_count?: number;
  created_at: string;
  updated_at?: string;
  order?: number;
};

export type Video = {
  id: string;
  title: string;
  url: string;
  category: string;
  placement: 'featured' | 'inline';
  created_at: string;
  updated_at: string;
};

export type ModalToast = {
  id: string;
  title: string;
  body: string;
  image_url?: string | null;
  link_url?: string | null;
  is_active: boolean;
  start_at?: string | null;
  end_at?: string | null;
  repeatable?: boolean;
  show_once?: boolean;
  created_at?: string;
  updated_at?: string;
};
