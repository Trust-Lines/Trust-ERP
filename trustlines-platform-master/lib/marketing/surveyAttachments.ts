import { sanitizeFileName } from './prospectFiles';

// Public survey attachments (photos taken on the phone / uploaded files at the end of the
// NACS 26 survey) live in their own Dropbox section, one folder per contact.
export const SURVEY_ATTACHMENTS_ROOT = '/Marketing/NACS26 Contacts';

// Per-file ceiling. Serverless request bodies are capped at ~4.5 MB, so anything bigger
// than SURVEY_ATTACHMENT_SINGLE_MAX_BYTES is sent in SURVEY_ATTACHMENT_CHUNK_BYTES pieces
// through a Dropbox upload session (see the attachments route).
export const SURVEY_ATTACHMENT_MAX_BYTES = 200 * 1024 * 1024;
export const SURVEY_ATTACHMENT_SINGLE_MAX_BYTES = 4_000_000;
export const SURVEY_ATTACHMENT_CHUNK_BYTES = 4_000_000;
export const SURVEY_ATTACHMENT_MAX_COUNT = 5;

const IMAGE_EXT = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'gif'];
const FILE_EXT = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'csv', 'txt', 'zip', 'dwg', 'mp4', 'mov', 'm4v'];

function extOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i < 0 ? '' : name.slice(i + 1).toLowerCase();
}

export function isImageAttachment(name: string, mime?: string | null): boolean {
  return (mime ?? '').startsWith('image/') || IMAGE_EXT.includes(extOf(name));
}

export function isAllowedAttachment(name: string, mime?: string | null): boolean {
  return isImageAttachment(name, mime) || FILE_EXT.includes(extOf(name));
}

export function buildSurveyAttachmentFolder(displayName: string | null, prospectId: string): string {
  const safeName = sanitizeFileName(displayName || 'Contact');
  return `${SURVEY_ATTACHMENTS_ROOT}/${safeName} - ${prospectId.slice(0, 8)}`;
}
