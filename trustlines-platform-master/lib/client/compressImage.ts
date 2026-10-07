// Browser-only. Phone/tablet photos are 3–10 MB (or far more), but a serverless request body is
// capped at ~4.5 MB (the server answers 413 with a non-JSON body). So photos are re-encoded to
// JPEG, and shrunk step by step until they fit — in practice no photo is ever turned away.
export const MAX_UPLOAD_BYTES = 4_000_000;

// [longest edge in px, JPEG quality] — tried in order until the result fits.
const STEPS: [number, number][] = [[1800, 0.82], [1400, 0.72], [1100, 0.62], [800, 0.55], [600, 0.5]];

export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;
  try {
    const bitmap = await createImageBitmap(file);
    let best: Blob | null = null;
    for (const [edge, quality] of STEPS) {
      const scale = Math.min(1, edge / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
      if (blob && (!best || blob.size < best.size)) best = blob;
      if (best && best.size <= MAX_UPLOAD_BYTES) break;
    }
    // Keep the original only when it already fits and re-encoding didn't make it smaller.
    if (!best || (file.size <= MAX_UPLOAD_BYTES && best.size >= file.size)) return file;
    return new File([best], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return file; // e.g. a HEIC this browser can't decode — sent as-is
  }
}
