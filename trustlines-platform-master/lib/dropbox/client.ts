import { Dropbox } from 'dropbox';

export function getDropboxClient(): Dropbox {
  return new Dropbox({
    clientId:     process.env.DROPBOX_APP_KEY!,
    clientSecret: process.env.DROPBOX_APP_SECRET!,
    refreshToken: process.env.DROPBOX_REFRESH_TOKEN!,
    fetch:        globalThis.fetch.bind(globalThis),
  });
}
