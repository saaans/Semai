/**
 * Kompres foto di browser sebelum upload. Target ±50 KB (PRD: < 100 KB per
 * absen). Turunkan kualitas dulu, lalu ukuran, sampai muat.
 */
const TARGET_BYTES = 50 * 1024;
const HARD_LIMIT_BYTES = 95 * 1024;
const SIZES = [480, 400, 320];
const QUALITIES = [0.7, 0.6, 0.5, 0.4, 0.3];

type Source = HTMLVideoElement | HTMLImageElement | ImageBitmap;

function sourceSize(source: Source): { width: number; height: number } {
  if (source instanceof HTMLVideoElement) {
    return { width: source.videoWidth, height: source.videoHeight };
  }
  if (source instanceof HTMLImageElement) {
    return { width: source.naturalWidth, height: source.naturalHeight };
  }
  return { width: source.width, height: source.height };
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

export async function compressPhoto(source: Source): Promise<Blob> {
  const { width, height } = sourceSize(source);
  if (!width || !height) throw new Error("Foto kosong.");

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas tidak tersedia.");

  let smallest: Blob | null = null;
  for (const maxSide of SIZES) {
    const scale = Math.min(1, maxSide / Math.max(width, height));
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);

    for (const quality of QUALITIES) {
      const blob = await toBlob(canvas, quality);
      if (!blob) continue;
      if (!smallest || blob.size < smallest.size) smallest = blob;
      if (blob.size <= TARGET_BYTES) return blob;
    }
  }

  if (smallest && smallest.size <= HARD_LIMIT_BYTES) return smallest;
  throw new Error("Foto terlalu besar.");
}

/** Foto dari input file (cadangan kalau kamera langsung tidak bisa dibuka). */
export async function compressFile(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    return await compressPhoto(bitmap);
  } finally {
    bitmap.close();
  }
}
