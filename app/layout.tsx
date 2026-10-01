import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Geist_Mono, Inter, Onest } from "next/font/google";
import { TopLoader } from "@/components/top-loader";
import "./globals.css";

const onest = Onest({
  subsets: ["latin"],
  weight: ["300"],
  variable: "--font-onest",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-inter",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Semai: absen dan gajian untuk usaha kecil",
    template: "%s · Semai",
  },
  description:
    "Absen dari HP dengan selfie dan GPS, hitung gaji, lembur, dan kasbon otomatis. Untuk resto, kafe, toko, klinik, salon, bengkel, dan laundry.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fdfcfc" },
    { media: "(prefers-color-scheme: dark)", color: "#0f0e0d" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="id"
      className={`${onest.variable} ${inter.variable} ${geistMono.variable}`}
    >
      <body className="min-h-dvh">
        <Suspense fallback={null}>
          <TopLoader />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
