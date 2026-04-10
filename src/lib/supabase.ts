import { createClient } from '@supabase/supabase-js';

const env = (import.meta as any).env;
const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials missing. Storage features will not work.');
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');
export const SUPABASE_BUCKET = env.VITE_SUPABASE_BUCKET || 'attendance-photos';
