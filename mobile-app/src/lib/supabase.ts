import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
export const CONFIGURED = !!SUPABASE_URL && !!SUPABASE_ANON_KEY && !!process.env.EXPO_PUBLIC_API_URL;

// Same Supabase project and accounts as the web platform. The session lives on the device; the
// access token is sent to the platform API as `Authorization: Bearer` (see lib/api.ts).
export const supabase = createClient(SUPABASE_URL || 'http://not-configured.invalid', SUPABASE_ANON_KEY || 'missing', {
  auth: {
    storage: Platform.OS === 'web' ? undefined : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Refresh tokens only while the app is in the foreground (Supabase RN guidance).
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', state => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
