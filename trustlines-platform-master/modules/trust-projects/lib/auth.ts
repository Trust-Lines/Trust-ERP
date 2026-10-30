// Auth API helper
// T-ERP ADAPTATION: every request goes to T-ERP's own proxy, /api/trust/* → Trust System /api/*.
// The proxy (app/api/trust/[...path]/route.ts) checks the T-ERP session and adds the API key on
// the server, so this file no longer handles JWTs, refresh tokens or a login redirect.
const API_URL = '/api/trust';

/** '/api/projects' → '/api/trust/projects'; already-proxied and absolute URLs are left alone. */
export const toProxyUrl = (url: string): string => {
  if (url.startsWith(`${API_URL}/`) || url === API_URL) return url;
  if (url.startsWith('/api/')) return `${API_URL}${url.substring(4)}`;
  return url;
};

// Helper function to construct API URLs
const buildApiUrl = (path: string): string => `${API_URL}${path}`;

export interface LoginCredentials {
  identifier: string;
  password: string;
  rememberMe?: boolean;
}

export interface ColumnVisibility {
  columnKey: string;
  isHidden: boolean;
  isReadOnly: boolean;
}

export interface UserAccessPolicy {
  columnsHidden: string[];
  columnsReadOnly: string[];
  rowScopes: Record<string, any>;
  modulePermissions: Record<string, any>;
}

export interface AuthResponse {
  accessToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    isActive: boolean;
  };
  role: {
    id: string;
    name: string;
    isSystem: boolean;
    isActive: boolean;
  };
  permissions: Array<{
    key: string;
    module: string;
    action: string;
  }>;
  columnVisibility?: ColumnVisibility[];
  userAccessPolicy?: UserAccessPolicy;
  isAdmin?: boolean; // 🚨 CRITICAL: Admin flag from backend
}

export interface MeResponse {
  user: {
    id: string;
    email: string;
    name: string | null;
    isActive: boolean;
    forcePasswordChange?: boolean;
    createdAt: string;
  };
  role: {
    id: string;
    name: string;
    isSystem: boolean;
    isActive: boolean;
  };
  permissions: Array<{
    key: string;
    module: string;
    action: string;
  }>;
  columnVisibility: ColumnVisibility[];
  userAccessPolicy: UserAccessPolicy;
  isAdmin: boolean; // 🚨 CRITICAL: Admin flag from backend
}

export interface AuthError {
  message: string;
  statusCode: number;
  error: string;
}

// Token storage helpers
// T-ERP ADAPTATION: no browser-held token — the proxy authenticates every request. Kept as no-ops
// so callers (AuthContext, trust-stock uploadForm) keep working unchanged.
export const getToken = (): string | null => null;

export const setToken = (_token: string): void => {};

export const removeToken = (): void => {};

// Refresh token helper — T-ERP ADAPTATION: nothing to refresh (the T-ERP session is the login).
export const refreshToken = async (): Promise<{ accessToken: string }> => {
  throw new Error('Not used in T-ERP: the session is checked by the /api/trust proxy');
};

// Central API client — T-ERP ADAPTATION: same signature; a plain fetch to the proxy with a JSON
// content type. T-ERP's session cookie goes along (same origin); a 401 means the T-ERP session
// ended, and T-ERP's own middleware handles the login redirect.
export const apiFetch = async (url: string, options: RequestInit = {}): Promise<Response> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers as Record<string, string>,
  };
  return fetch(toProxyUrl(url), {
    ...options,
    headers,
    credentials: 'same-origin',
  });
};

// API calls
// T-ERP ADAPTATION: there is no Trust System login screen in T-ERP.
export const login = async (_credentials: LoginCredentials): Promise<AuthResponse> => {
  throw new Error('Not used in T-ERP: sign in to T-ERP instead');
};

// T-ERP ADAPTATION: signing out is T-ERP's; nothing to revoke on the Trust side.
export const logout = async (): Promise<void> => {};

export const getCurrentUser = async (): Promise<MeResponse> => {
  // GET /api/trust/auth/me — the Trust System user behind the integration key, with its role,
  // page and column permissions (what usePagePermissions / useColumnPermissions read).
  const response = await apiFetch(buildApiUrl('/auth/me'));
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || 'Failed to get user info');
  }
  return data;
};

// Create authenticated request helper (DEPRECATED - use apiFetch instead)
export const createAuthenticatedRequest = (url: string, options: RequestInit = {}) => {
  console.warn('⚠️  createAuthenticatedRequest is deprecated, use apiFetch instead');
  return apiFetch(url, options);
};

// Session restoration — T-ERP ADAPTATION: just /auth/me (no refresh-token step).
export const restoreSession = async (): Promise<MeResponse> => getCurrentUser();
