"use server";

import { unstable_rethrow } from "next/navigation";
import { fieldErrors } from "@/lib/auth/schemas";
import { requireOwner } from "@/lib/auth/session";
import { feedbackSchema } from "@/lib/feedback/schemas";
import { createClient } from "@/lib/supabase/server";

export type FeedbackState = { errors?: Record<string, string>; message?: string; saved?: boolean };

const SEND_FAILED = "Masukan belum terkirim. Periksa koneksi internet, lalu coba lagi.";

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

/**
 * Dipanggil dari tombol di layout owner, di luar error boundary halaman.
 * Jangan pernah melempar error: kalau gagal, tampilkan pesan di form.
 */
export async function kirimMasukan(_prev: FeedbackState, formData: FormData): Promise<FeedbackState> {
  try {
    const owner = await requireOwner();
    const parsed = feedbackSchema.safeParse({
      category: text(formData, "category"),
      message: text(formData, "message"),
      pagePath: text(formData, "pagePath"),
    });
    if (!parsed.success) return { errors: fieldErrors(parsed.error) };

    const supabase = await createClient();
    const { error } = await supabase.from("feedbacks").insert({
      company_id: owner.companyId,
      category: parsed.data.category,
      message: parsed.data.message,
      page_path: parsed.data.pagePath,
    });
    if (error) {
      console.error("[kirimMasukan]", error);
      return { message: SEND_FAILED };
    }
    return { saved: true };
  } catch (error) {
    unstable_rethrow(error);
    console.error("[kirimMasukan] gagal", error);
    return { message: SEND_FAILED };
  }
}
