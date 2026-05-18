import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPABASE_URL = 'https://wsvqomiycexnfrclqwgq.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_7vs6qwqw--H02g2Q2D47ZQ_ywv7whjn';

const storageAdapter = {
  getItem: async (key) => {
    try { return await AsyncStorage.getItem(key); }
    catch { return null; }
  },
  setItem: async (key, value) => {
    try { await AsyncStorage.setItem(key, value); }
    catch {}
  },
  removeItem: async (key) => {
    try { await AsyncStorage.removeItem(key); }
    catch {}
  },
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: storageAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});