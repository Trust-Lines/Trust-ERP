
const FOLDERS = [
  '00-deal',
  '01-design',
  '02-items/item-plan',
  '02-items/item-list',
  '02-items/boq',
  '02-items/book',
  '02-items/price-list',
  '03-po-bo',
  '04-pf/ms',
  '04-pf/ci',
  '05-qc',
  '06-packing',
  '07-shipment',
  '08-delivery',
];

const ROOT = '/Trust-Lines-Projects';

async function getAccessToken(): Promise<string> {
  const appKey    = Deno.env.get('DROPBOX_APP_KEY')!;
  const appSecret = Deno.env.get('DROPBOX_APP_SECRET')!;
  const refresh   = Deno.env.get('DROPBOX_REFRESH_TOKEN')!;

  const res = await fetch('https://api.dropbox.com/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'refresh_token',
      refresh_token: refresh,
      client_id:     appKey,
      client_secret: appSecret,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Dropbox token refresh failed: ${err}`);
  }

  const data = await res.json();
  return data.access_token as string;
}

async function createFolder(token: string, path: string): Promise<void> {
  const res = await fetch('https://api.dropboxapi.com/2/files/create_folder_v2', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ path, autorename: false }),
  });

  if (!res.ok && res.status !== 409) {
    const err = await res.text();
    throw new Error(`Failed to create folder ${path}: ${err}`);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin':  '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  try {
    const { projectCode } = await req.json() as { projectCode: string };

    if (!projectCode || typeof projectCode !== 'string') {
      return new Response(
        JSON.stringify({ error: 'projectCode is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const token   = await getAccessToken();
    const folders = FOLDERS.map(f => `${ROOT}/${projectCode}/${f}`);

    await Promise.all(folders.map(f => createFolder(token, f)));

    return new Response(
      JSON.stringify({ success: true, folders }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
});
