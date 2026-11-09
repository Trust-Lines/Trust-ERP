import { supabase } from './supabase';

export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

/** Calls the platform API (trustlines-platform-master/app/api) as the signed-in user. */
export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new ApiError(401, 'Oturum kapandı — tekrar giriş yap.');

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: init.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        Accept: 'application/json',
        ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Sunucuya ulaşılamadı. İnternet bağlantını kontrol et.');
  }

  const json = await res.json().catch(() => null) as (T & { error?: string }) | null;
  if (!res.ok) {
    const fallback = res.status === 403 ? 'Bu işlem için yetkin yok.' : res.status === 401 ? 'Oturum kapandı — tekrar giriş yap.' : `Hata (${res.status})`;
    throw new ApiError(res.status, json?.error ?? fallback);
  }
  return json as T;
}
