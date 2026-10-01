"use client";

import { useState } from "react";
import { FormAlert } from "@/app/(auth)/_components/form-alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { simpanLokasi } from "../actions";
import { LocationMap, type Point } from "./location-map";
import { useStepForm } from "./use-step-form";

type GeoStatus =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok"; accuracy: number }
  | { kind: "error"; message: string };

function geoErrorMessage(error: GeolocationPositionError): string {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return "Izin lokasi ditolak. Aktifkan izin lokasi untuk browser ini di pengaturan HP, atau ketuk titik di peta.";
    case error.POSITION_UNAVAILABLE:
      return "Lokasi belum terbaca. Nyalakan GPS lalu coba lagi, atau ketuk titik di peta.";
    default:
      return "Lokasi terlalu lama terbaca. Coba lagi di tempat terbuka, atau ketuk titik di peta.";
  }
}

export function LokasiForm({
  initial,
}: {
  initial: { name: string; point: Point | null; radiusM: number };
}) {
  const { state, pending, onSubmit } = useStepForm(simpanLokasi);
  const errors = state.errors ?? {};

  const [point, setPoint] = useState<Point | null>(initial.point);
  const [radiusM, setRadiusM] = useState(initial.radiusM);
  const [geo, setGeo] = useState<GeoStatus>({ kind: "idle" });

  function readMyLocation() {
    if (!("geolocation" in navigator)) {
      setGeo({ kind: "error", message: "Browser ini tidak bisa membaca lokasi. Ketuk titik di peta." });
      return;
    }
    setGeo({ kind: "loading" });
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setPoint({ lat: position.coords.latitude, lng: position.coords.longitude });
        setGeo({ kind: "ok", accuracy: Math.round(position.coords.accuracy) });
      },
      (error) => setGeo({ kind: "error", message: geoErrorMessage(error) }),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }

  function pick(next: Point) {
    setPoint(next);
    setGeo({ kind: "idle" });
  }

  const pointError = errors.latitude ?? errors.longitude;

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      {state.message && <FormAlert tone="error">{state.message}</FormAlert>}

      <Input
        label="Nama lokasi"
        name="name"
        defaultValue={initial.name}
        placeholder="Contoh: Toko pusat"
        error={errors.name}
        required
      />

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium text-graphite">Titik lokasi</span>
          <Button
            variant="secondary"
            arrow={false}
            onClick={readMyLocation}
            disabled={geo.kind === "loading"}
            className="min-h-10"
          >
            {geo.kind === "loading" ? "Membaca lokasi…" : "Pakai lokasi saya"}
          </Button>
        </div>
        <LocationMap point={point} radiusM={radiusM} onPick={pick} />
        <p className="text-sm text-ash" aria-live="polite">
          {geo.kind === "error" ? (
            <span className="text-danger">{geo.message}</span>
          ) : point ? (
            <>
              <span className="font-mono text-graphite">
                {point.lat.toFixed(6)}, {point.lng.toFixed(6)}
              </span>
              {geo.kind === "ok" && ` · akurasi ±${geo.accuracy} m`}
              {". Ketuk peta untuk menggeser titik."}
            </>
          ) : (
            "Ketuk peta di titik tempat usahamu, atau pakai lokasi saat ini kalau kamu sedang di sana."
          )}
        </p>
        {pointError && <p className="text-sm text-danger">{pointError}</p>}
        <input type="hidden" name="latitude" value={point?.lat ?? ""} />
        <input type="hidden" name="longitude" value={point?.lng ?? ""} />
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label htmlFor="radiusM" className="text-sm font-medium text-graphite">
            Radius absen
          </label>
          <span className="font-mono text-sm text-ink">{radiusM} m</span>
        </div>
        <input
          id="radiusM"
          name="radiusM"
          type="range"
          min={10}
          max={1000}
          step={10}
          value={radiusM}
          onChange={(e) => setRadiusM(Number(e.target.value))}
          className="h-11 w-full accent-ink"
        />
        <p className="text-sm text-ash">
          Karyawan hanya bisa absen di dalam lingkaran ini. 100 m cukup untuk kebanyakan toko.
        </p>
        {errors.radiusM && <p className="text-sm text-danger">{errors.radiusM}</p>}
      </div>

      <Button type="submit" fullWidth disabled={pending} aria-busy={pending}>
        {pending ? "Menyimpan…" : "Lanjut"}
      </Button>
    </form>
  );
}
