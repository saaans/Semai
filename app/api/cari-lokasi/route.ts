import { NextResponse, type NextRequest } from "next/server";
import { getOwnerState } from "@/lib/auth/session";

/**
 * Cari alamat/tempat untuk peta lokasi absen. Gratis tanpa API key, data
 * OpenStreetMap:
 * 1. Photon (komoot): cocok untuk cari sambil mengetik, bisa potongan kata.
 * 2. Nominatim: cadangan kalau Photon gagal atau kosong (hanya kata utuh,
 *    maksimal ±1 permintaan per detik).
 * Lewat server supaya User-Agent jelas dan hanya owner/admin yang login bisa
 * memakai. Hasil tidak di-cache: hasil kosong tidak boleh tersimpan.
 */

export type HasilLokasi = { name: string; lat: number; lng: number };

/** Kotak Indonesia (lon kiri, lat bawah, lon kanan, lat atas). */
const INDONESIA_BBOX = "94.9,-11.2,141.1,6.3";
const LIMIT = 6;
const USER_AGENT = `Semai/1.0 (${process.env.NEXT_PUBLIC_SITE_URL || "https://github.com/saaans/Semai"})`;

type PhotonFeature = {
  geometry?: { coordinates?: [number, number] };
  properties?: Record<string, string | undefined>;
};

function photonLabel(p: Record<string, string | undefined>): string {
  const street = [p.street, p.housenumber].filter(Boolean).join(" ");
  const parts = [p.name, street, p.district ?? p.locality, p.city ?? p.county, p.state];
  return parts.filter((part, i): part is string => Boolean(part) && parts.indexOf(part) === i).join(", ");
}

async function searchPhoton(q: string): Promise<HasilLokasi[]> {
  const url = new URL("https://photon.komoot.io/api/");
  url.searchParams.set("q", q);
  url.searchParams.set("limit", String(LIMIT));
  url.searchParams.set("bbox", INDONESIA_BBOX);

  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    cache: "no-store",
    signal: AbortSignal.timeout(6000),
  });
  if (!response.ok) throw new Error(`Photon ${response.status}`);

  const body = (await response.json()) as { features?: PhotonFeature[] };
  return (body.features ?? [])
    .filter((f) => !f.properties?.countrycode || f.properties.countrycode.toUpperCase() === "ID")
    .map((f) => ({
      name: photonLabel(f.properties ?? {}),
      lng: Number(f.geometry?.coordinates?.[0]),
      lat: Number(f.geometry?.coordinates?.[1]),
    }))
    .filter((r) => r.name && Number.isFinite(r.lat) && Number.isFinite(r.lng));
}

async function searchNominatim(q: string): Promise<HasilLokasi[]> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("countrycodes", "id");
  url.searchParams.set("limit", String(LIMIT));
  url.searchParams.set("accept-language", "id");

  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    cache: "no-store",
    signal: AbortSignal.timeout(6000),
  });
  if (!response.ok) throw new Error(`Nominatim ${response.status}`);

  const rows = (await response.json()) as { display_name?: string; lat?: string; lon?: string }[];
  return rows
    .map((row) => ({ name: row.display_name ?? "", lat: Number(row.lat), lng: Number(row.lon) }))
    .filter((r) => r.name && Number.isFinite(r.lat) && Number.isFinite(r.lng));
}

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

  let photonFailed = false;
  try {
    const results = await searchPhoton(q);
    if (results.length > 0) return NextResponse.json({ results });
  } catch (error) {
    photonFailed = true;
    console.error("[cari-lokasi] photon", error);
  }

  try {
    return NextResponse.json({ results: await searchNominatim(q) });
  } catch (error) {
    console.error("[cari-lokasi] nominatim", error);
    if (!photonFailed) return NextResponse.json({ results: [] });
    return NextResponse.json(
      { message: "Pencarian lokasi sedang tidak bisa dipakai. Coba lagi sebentar, atau ketuk titik di peta." },
      { status: 502 },
    );
  }
}
