
const ALLOWED_ORIGINS = (process.env.PUBLIC_SURVEY_ORIGINS ?? '')
  .split(',').map(o => o.trim()).filter(Boolean);

export function publicCorsHeaders(requestOrigin: string | null): HeadersInit {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
  if (requestOrigin && ALLOWED_ORIGINS.includes(requestOrigin)) {
    headers['Access-Control-Allow-Origin'] = requestOrigin;
    headers['Vary'] = 'Origin';
  }
  return headers;
}

export function publicCorsPreflight(requestOrigin: string | null): Response {
  return new Response(null, { status: 204, headers: publicCorsHeaders(requestOrigin) });
}
