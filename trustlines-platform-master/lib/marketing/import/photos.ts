import { sanitizeFileName } from '../prospectFiles';
import { SURVEY_ATTACHMENTS_ROOT } from '../surveyAttachments';

// Where imported pictures go in Dropbox and how they are named.

// The same event must always use the same folder: NACS 2026 uses the folder the survey already writes
// to ("NACS26 Contacts"); any other event gets "<event> Contacts" next to it.
const NACS_2026 = /nacs[\s-]*(20)?26/i;

export function importPhotoFolder(campaignName: string | null | undefined, displayName: string | null, prospectId: string): string {
  const root = campaignName && !NACS_2026.test(campaignName)
    ? `/Marketing/${sanitizeFileName(campaignName)} Contacts`
    : SURVEY_ATTACHMENTS_ROOT;
  return `${root}/${sanitizeFileName(displayName || 'Contact')} - ${prospectId.slice(0, 8)}`;
}

/** Name derived from the picture's content, so importing the same file again never adds a second copy. */
export function importPhotoName(hash: string, ext: string): string {
  return `import-${hash.slice(0, 10)}.${ext.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'jpg'}`;
}
