import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://wsvqomiycexnfrclqwgq.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_7vs6qwqw--H02g2Q2D47ZQ_ywv7whjn';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: {
      getItem: () => Promise.resolve(null),
      setItem: () => Promise.resolve(),
      removeItem: () => Promise.resolve(),
    },
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});