// Browser-only. Phone/tablet photos are 3–10 MB, but a serverless request body is capped at
// ~4.5 MB (the server answers 413 with a non-JSON body). Shrink photos to a sensible JPEG
// before they are posted so comment/Activity uploads fit.
export const MAX_UPLOAD_BYTES = 4_000_000;

export async function compressImage(file: File, maxEdge = 1800, quality = 0.82): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return file; // e.g. a HEIC the browser can't decode — sent as-is, the size check still applies
  }
}
