/**
 * Siapkan logo di browser: potong jadi persegi di tengah, perkecil ke
 * 256 px, simpan WebP (atau JPEG berlatar putih kalau browser tidak bisa
 * WebP). Target di bawah 50 KB.
 */
const SIZE = 256;
const QUALITIES = [0.85, 0.75, 0.6, 0.45];
const TARGET_BYTES = 50 * 1024;

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

export async function compressLogo(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    const side = Math.min(bitmap.width, bitmap.height);
    if (!side) throw new Error("Gambar kosong.");

    const canvas = document.createElement("canvas");
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas tidak tersedia.");

    const draw = (background?: string) => {
      ctx.clearRect(0, 0, SIZE, SIZE);
      if (background) {
        ctx.fillStyle = background;
        ctx.fillRect(0, 0, SIZE, SIZE);
      }
      ctx.drawImage(
        bitmap,
        (bitmap.width - side) / 2,
        (bitmap.height - side) / 2,
        side,
        side,
        0,
        0,
        SIZE,
        SIZE,
      );
    };

    draw();
    let type = "image/webp";
    const probe = await toBlob(canvas, type, QUALITIES[0]!);
    if (!probe || probe.type !== type) {
      // Browser lama tanpa WebP: JPEG tidak punya transparansi, beri latar putih.
      type = "image/jpeg";
      draw("#ffffff");
    }

    let smallest: Blob | null = null;
    for (const quality of QUALITIES) {
      const blob = await toBlob(canvas, type, quality);
      if (!blob) continue;
      if (!smallest || blob.size < smallest.size) smallest = blob;
      if (blob.size <= TARGET_BYTES) return blob;
    }
    if (smallest) return smallest;
    throw new Error("Gagal memproses gambar.");
  } finally {
    bitmap.close();
  }
}
