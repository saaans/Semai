"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { FormAlert } from "@/app/(auth)/_components/form-alert";
import { Button } from "@/components/ui/button";
import { compressLogo } from "@/lib/company/compress-logo";
import { simpanLogo, type LogoState } from "./actions";

/** Logo usaha: pilih gambar → dipotong persegi & dikompres di HP → unggah. */
export function LogoForm({ logoUrl, companyName }: { logoUrl: string | null; companyName: string }) {
  const [state, action, pending] = useActionState<LogoState, FormData>(simpanLogo, {});
  const [, startTransition] = useTransition();
  const [preview, setPreview] = useState<{ url: string; blob: Blob } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Lepas blob URL lama.
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview.url);
  }, [preview]);

  // Setelah tersimpan, tampilkan logo dari server.
  const [handled, setHandled] = useState<LogoState | null>(null);
  if (state.saved && handled !== state) {
    setHandled(state);
    setPreview(null);
  }

  const onPick = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError(null);
    if (!file.type.startsWith("image/")) {
      setError("File harus berupa gambar (JPG, PNG, atau WebP).");
      return;
    }
    setPreparing(true);
    try {
      const blob = await compressLogo(file);
      setPreview({ url: URL.createObjectURL(blob), blob });
    } catch {
      setError("Gambar tidak bisa dibaca. Coba gambar lain, misalnya JPG atau PNG.");
    } finally {
      setPreparing(false);
    }
  };

  const submit = (remove = false) => {
    const formData = new FormData();
    if (remove) {
      formData.set("hapus", "1");
    } else if (preview) {
      const ext = preview.blob.type === "image/webp" ? "webp" : "jpg";
      formData.set("logo", new File([preview.blob], `logo.${ext}`, { type: preview.blob.type }));
    }
    startTransition(() => action(formData));
  };

  const shown = preview?.url ?? logoUrl;
  const busy = pending || preparing;

  return (
    <div className="flex flex-col gap-4">
      {(error ?? state.message) && <FormAlert tone="error">{error ?? state.message}</FormAlert>}
      {state.saved && !preview && (
        <FormAlert tone="success">{state.saved === "dihapus" ? "Logo dihapus." : "Logo disimpan."}</FormAlert>
      )}
      <div className="flex items-center gap-4">
        <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-card border border-stone bg-canvas">
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element -- blob URL / bucket publik Supabase
            <img src={shown} alt={`Logo ${companyName}`} className="size-full object-cover" />
          ) : (
            <span className="font-display text-3xl text-smoke">{companyName.slice(0, 1).toUpperCase() || "?"}</span>
          )}
        </div>
        <div className="flex flex-col gap-1 text-sm text-smoke">
          <span>Gambar dipotong persegi dan diperkecil otomatis.</span>
          <span className="text-ash">Tampil di menu, aplikasi karyawan, dan slip gaji.</span>
        </div>
      </div>

      <input ref={inputRef} type="file" accept="image/*" className="sr-only" onChange={onPick} tabIndex={-1} aria-hidden />
      <div className="flex flex-wrap gap-2">
        {preview ? (
          <>
            <Button onClick={() => submit()} disabled={busy} aria-busy={pending}>
              {pending ? "Mengunggah…" : "Simpan logo"}
            </Button>
            <Button variant="secondary" arrow={false} onClick={() => setPreview(null)} disabled={busy}>
              Batal
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" arrow={false} onClick={() => inputRef.current?.click()} disabled={busy}>
              {preparing ? "Menyiapkan gambar…" : logoUrl ? "Ganti logo" : "Pilih logo"}
            </Button>
            {logoUrl && (
              <Button
                variant="secondary"
                arrow={false}
                disabled={busy}
                onClick={() => {
                  if (window.confirm("Hapus logo usaha?")) submit(true);
                }}
              >
                {pending ? "Menghapus…" : "Hapus logo"}
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
