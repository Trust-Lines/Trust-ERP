
// The company's own public sites may always call the public endpoints (contact form, newsletter,
// surveys). PUBLIC_SURVEY_ORIGINS (comma-separated, exact origins incl. https://) adds more.
const DEFAULT_ORIGINS = ['https://tlines.us', 'https://www.tlines.us', 'https://sm.tlines.us'];

const ALLOWED_ORIGINS = [
  ...DEFAULT_ORIGINS,
  ...(process.env.PUBLIC_SURVEY_ORIGINS ?? '').split(',').map(o => o.trim().replace(/\/+$/, '')).filter(Boolean),
];

export function publicCorsHeaders(requestOrigin: string | null): HeadersInit {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    // The answer depends on the caller's origin, so caches must key on it even for denied origins.
    Vary: 'Origin',
  };
  if (requestOrigin && ALLOWED_ORIGINS.includes(requestOrigin)) {
    headers['Access-Control-Allow-Origin'] = requestOrigin;
  }
  return headers;
}

export function publicCorsPreflight(requestOrigin: string | null): Response {
  return new Response(null, { status: 204, headers: publicCorsHeaders(requestOrigin) });
}
