import { NextResponse, type NextRequest } from "next/server";
import { getOwnerState } from "@/lib/auth/session";

/**
 * Cari alamat/tempat untuk peta lokasi absen lewat Nominatim (OpenStreetMap,
 * gratis tanpa API key). Lewat server supaya User-Agent jelas sesuai aturan
 * Nominatim, hasil di-cache, dan hanya owner/admin yang login bisa memakai.
 * Aturan Nominatim: maksimal ±1 permintaan per detik, jadi UI hanya mencari
 * saat tombol Cari ditekan (bukan tiap ketikan).
 */

export type HasilLokasi = { name: string; lat: number; lng: number };

type NominatimRow = { display_name?: string; lat?: string; lon?: string };

export async function GET(request: NextRequest) {
  const state = await getOwnerState();
  if (state.kind !== "member") {
    return NextResponse.json({ message: "Sesi habis. Silakan masuk lagi." }, { status: 401 });
  }

  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 3 || q.length > 120) {
    return NextResponse.json(
      { message: "Tulis minimal 3 huruf. Contoh: Pasar Baru Bandung." },
      { status: 400 },
    );
  }

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("countrycodes", "id");
  url.searchParams.set("limit", "5");
  url.searchParams.set("accept-language", "id");

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": `Semai/1.0 (${process.env.NEXT_PUBLIC_SITE_URL || "https://github.com/saaans/Semai"})`,
      },
      // Pencarian yang sama tidak perlu ke Nominatim lagi selama sehari.
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error(`Nominatim ${response.status}`);

    const rows = (await response.json()) as NominatimRow[];
    const results: HasilLokasi[] = rows
      .map((row) => ({ name: row.display_name ?? "", lat: Number(row.lat), lng: Number(row.lon) }))
      .filter((r) => r.name && Number.isFinite(r.lat) && Number.isFinite(r.lng));

    return NextResponse.json({ results });
  } catch (error) {
    console.error("[cari-lokasi]", error);
    return NextResponse.json(
      { message: "Pencarian lokasi sedang tidak bisa dipakai. Coba lagi sebentar, atau ketuk titik di peta." },
      { status: 502 },
    );
  }
}
