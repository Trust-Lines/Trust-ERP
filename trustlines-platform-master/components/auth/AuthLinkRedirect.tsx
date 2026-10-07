'use client';

import { useEffect } from 'react';

// Supabase e-mail links (password reset / invitation) land on whatever "Site URL" or redirect
// target the project has configured — often the home page or /login, and for someone who is
// already signed in on that browser, straight into the app. The tokens arrive in the URL
// fragment, which the server never sees, so this runs in the browser on every page and
// forwards such a landing to the set-password screen with the tokens intact.
export function AuthLinkRedirect() {
  useEffect(() => {
    const { hash, pathname } = window.location;
    if (pathname.startsWith('/auth/set-password')) return;
    if (hash.includes('access_token=') && (hash.includes('type=recovery') || hash.includes('type=invite'))) {
      window.location.replace('/auth/set-password' + hash);
    }
  }, []);
  return null;
}
