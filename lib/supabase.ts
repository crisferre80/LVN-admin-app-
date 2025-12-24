import { createClient } from '@supabase/supabase-js';

// Vite provides types for import.meta.env automatically.
// If you need to extend them, use module augmentation in a .d.ts file.

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

export default supabase