"use client";

import { LokasiForm } from "../onboarding/_components/lokasi-form";
import { simpanLokasiAbsen } from "./actions";

/** Form lokasi onboarding, dipakai ulang di pengaturan dengan action sendiri. */
export function LokasiCard({
  location,
  fallbackName,
}: {
  location: { id: string; name: string; latitude: number; longitude: number; radius_m: number } | null;
  fallbackName: string;
}) {
  // locationId dikirim lewat FormData: bungkus action supaya tetap satu form.
  const action = (prev: Parameters<typeof simpanLokasiAbsen>[0], formData: FormData) => {
    if (location) formData.set("locationId", location.id);
    return simpanLokasiAbsen(prev, formData);
  };

  return (
    <LokasiForm
      action={action}
      submitLabel="Simpan lokasi"
      savedText="Lokasi absen disimpan. Berlaku untuk absen berikutnya."
      initial={{
        name: location?.name ?? fallbackName,
        point: location ? { lat: location.latitude, lng: location.longitude } : null,
        radiusM: location?.radius_m ?? 100,
      }}
    />
  );
}
