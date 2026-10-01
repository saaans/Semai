"use client";

import { useState } from "react";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import type { InviteResult } from "../actions";

/** Link aktivasi + QR + kirim via WA. Token hanya tampil sekali di sini. */
export function InviteCard({ invite, reset = false }: { invite: InviteResult; reset?: boolean }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(invite.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <CardTitle>{reset ? "PIN direset" : "Link undangan siap"}</CardTitle>
        <CardDescription>
          Kirim ke {invite.employeeName}. Berlaku sampai {invite.expiresLabel}. Link ini hanya
          tampil sekali; kalau hilang, buat link baru.
        </CardDescription>
      </div>
      <a
        href={invite.waUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={buttonClasses({ fullWidth: true })}
      >
        <span className="flex-1 pl-0.5 text-left">Kirim via WA</span>
        <span
          aria-hidden
          className="flex size-8 shrink-0 items-center justify-center rounded-[7px] bg-on-accent text-accent"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </span>
      </a>
      <div className="flex items-center gap-2">
        <input
          readOnly
          value={invite.url}
          aria-label="Link aktivasi"
          onFocus={(e) => e.currentTarget.select()}
          className="min-h-11 min-w-0 flex-1 rounded-button border border-stone bg-canvas px-3 font-mono text-xs text-graphite"
        />
        <Button variant="secondary" arrow={false} onClick={copy}>
          {copied ? "Tersalin" : "Salin"}
        </Button>
      </div>
      <div className="flex flex-col items-center gap-2">
        {/* QR dibuat server dari link kita sendiri (library qrcode), bukan input pengguna. */}
        <div
          className="w-48 rounded-button bg-white p-2 [&_svg]:h-auto [&_svg]:w-full"
          role="img"
          aria-label="QR link aktivasi"
          dangerouslySetInnerHTML={{ __html: invite.qrSvg }}
        />
        <p className="text-sm text-ash">Atau minta karyawan memindai QR ini dari HP-nya.</p>
      </div>
    </Card>
  );
}
