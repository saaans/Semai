import type { MetadataRoute } from "next";

/** PWA karyawan: dipasang ke layar utama, langsung membuka halaman absen. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/app",
    name: "Semai: absen karyawan",
    short_name: "Semai",
    description: "Absen dari HP dengan selfie dan GPS.",
    lang: "id",
    start_url: "/app",
    scope: "/app",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fdfcfc",
    theme_color: "#fdfcfc",
    icons: [
      { src: "/pwa/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
