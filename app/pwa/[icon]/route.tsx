import { ImageResponse } from "next/og";

/** Ikon PWA dibuat saat build: tunas outline hitam di atas lime. */
const ICONS = {
  "icon-192.png": { size: 192, maskable: false },
  "icon-512.png": { size: 512, maskable: false },
  "maskable-512.png": { size: 512, maskable: true },
} as const;

type IconName = keyof typeof ICONS;

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(ICONS).map((icon) => ({ icon }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ icon: string }> }) {
  const { icon } = await params;
  const spec = ICONS[icon as IconName];
  if (!spec) return new Response("Not found", { status: 404 });

  const { size, maskable } = spec;
  // Maskable: isi di zona aman 80% tengah.
  const glyph = Math.round(size * (maskable ? 0.5 : 0.62));

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#beff50",
          borderRadius: maskable ? 0 : Math.round(size * 0.22),
        }}
      >
        <svg
          width={glyph}
          height={glyph}
          viewBox="0 0 24 24"
          fill="none"
          stroke="#0b0b0a"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 21v-9" />
          <path d="M12 12c0-4 -3-6.5 -7-6.5c0 4 3 6.5 7 6.5z" />
          <path d="M12 14c0-3.5 2.5-6 6.5-6c0 3.5-2.5 6-6.5 6z" />
          <path d="M7 21h10" />
        </svg>
      </div>
    ),
    { width: size, height: size },
  );
}
