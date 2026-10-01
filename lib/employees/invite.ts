import "server-only";
import QRCode from "qrcode";
import { getSiteUrl } from "@/lib/auth/site-url";
import { formatDate } from "@/lib/format";

export type InviteLink = {
  url: string;
  waUrl: string;
  qrSvg: string;
  expiresLabel: string;
};

/** Link aktivasi + QR + link wa.me dengan teks siap kirim. */
export async function buildInviteLink(input: {
  token: string;
  expiresAt: string;
  employeeName: string;
  companyName: string;
  phone: string;
  timezone: string;
  reset?: boolean;
}): Promise<InviteLink> {
  const siteUrl = await getSiteUrl();
  const url = `${siteUrl}/app/aktivasi/${input.token}`;
  const expiresLabel = formatDate(input.expiresAt, input.timezone);
  const firstName = input.employeeName.split(/\s+/)[0];

  const text = input.reset
    ? `Halo ${firstName}, PIN absen kamu di ${input.companyName} sudah direset. Buka link ini untuk membuat PIN baru:\n${url}\n\nLink berlaku sampai ${expiresLabel}.`
    : `Halo ${firstName}, kamu diundang absen di ${input.companyName} lewat Semai. Buka link ini dari HP kamu untuk aktivasi dan membuat PIN:\n${url}\n\nLink berlaku sampai ${expiresLabel}.`;

  const qrSvg = await QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M" });

  return {
    url,
    waUrl: `https://wa.me/${input.phone}?text=${encodeURIComponent(text)}`,
    qrSvg,
    expiresLabel,
  };
}
