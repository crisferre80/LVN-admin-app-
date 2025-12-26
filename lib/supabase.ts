import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface Article {
  id: string;
  title: string;
  content: string;
  category: string;
  status: 'draft' | 'published' | 'archived' | 'pending_review';
  source_rss_id?: string;
  prompt_used?: string;
  created_at: string;
  published_at?: string;
  updated_at: string;
  image_url?: string;
  summary?: string;
  image_caption?: string;
  gallery_urls?: string[];
  gallery_template?: 'list' | 'grid-2' | 'grid-3';
  visits?: number;
  author?: string;
  url?: string;
  description?: string;
  is_featured?: boolean;
  audio_url?: string;
}