"use client";

import "leaflet/dist/leaflet.css";
import type * as Leaflet from "leaflet";
import { useEffect, useRef, useState } from "react";

export type Point = { lat: number; lng: number };

/** Tengah Indonesia, dipakai kalau titik belum dipilih. */
const INDONESIA: Leaflet.LatLngTuple = [-2.5, 118];

function cssVar(name: string, fallback: string) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

/**
 * Peta OpenStreetMap: ketuk untuk memilih titik, lingkaran menunjukkan radius.
 * Leaflet dimuat di browser saja (butuh window).
 */
export function LocationMap({
  point,
  radiusM,
  onPick,
}: {
  point: Point | null;
  radiusM: number;
  onPick: (point: Point) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const leafletRef = useRef<typeof Leaflet | null>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const circleRef = useRef<Leaflet.Circle | null>(null);
  const markerRef = useRef<Leaflet.CircleMarker | null>(null);
  const onPickRef = useRef(onPick);
  const initialPointRef = useRef(point);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    onPickRef.current = onPick;
  }, [onPick]);

  useEffect(() => {
    let cancelled = false;
    let map: Leaflet.Map | null = null;

    import("leaflet").then((L) => {
      if (cancelled || !containerRef.current) return;
      const start = initialPointRef.current;
      map = L.map(containerRef.current, {
        center: start ? [start.lat, start.lng] : INDONESIA,
        zoom: start ? 17 : 5,
      });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);
      map.on("click", (event) => onPickRef.current({ lat: event.latlng.lat, lng: event.latlng.lng }));

      leafletRef.current = L;
      mapRef.current = map;
      setReady(true);
    });

    return () => {
      cancelled = true;
      map?.remove();
      mapRef.current = null;
      circleRef.current = null;
      markerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!ready || !L || !map || !point) return;

    const latlng = L.latLng(point.lat, point.lng);
    const ink = cssVar("--ink", "#000000");
    const accent = cssVar("--accent", "#beff50");

    if (circleRef.current && markerRef.current) {
      circleRef.current.setLatLng(latlng).setRadius(radiusM);
      markerRef.current.setLatLng(latlng);
    } else {
      circleRef.current = L.circle(latlng, {
        radius: radiusM,
        color: ink,
        weight: 1.5,
        fillColor: accent,
        fillOpacity: 0.3,
      }).addTo(map);
      markerRef.current = L.circleMarker(latlng, {
        radius: 7,
        color: ink,
        weight: 2,
        fillColor: ink,
        fillOpacity: 1,
      }).addTo(map);
    }

    // Titik baru di luar layar (misalnya dari "Pakai lokasi saya"): arahkan peta.
    if (!map.getBounds().contains(latlng) || map.getZoom() < 14) {
      map.setView(latlng, 17);
    }
  }, [ready, point, radiusM]);

  return (
    <div
      ref={containerRef}
      className="isolate h-72 w-full overflow-hidden rounded-button border border-stone bg-taupe sm:h-96"
      role="application"
      aria-label="Peta lokasi absen. Ketuk peta untuk memilih titik."
    />
  );
}
