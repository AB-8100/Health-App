import { createClient } from '@supabase/supabase-js';

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey  = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);

// ── Data persistence ──────────────────────────────────────────────────────────

export async function loadUserData(userId) {
  const { data, error } = await supabase
    .from('user_data')
    .select('data')
    .eq('user_id', userId)
    .single();
  if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
  return data?.data ?? null;
}

export async function saveUserData(userId, snapshot) {
  const { error } = await supabase
    .from('user_data')
    .upsert({ user_id: userId, data: snapshot, updated_at: new Date().toISOString() });
  if (error) throw error;
}
