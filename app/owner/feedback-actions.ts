"use server";

import { fieldErrors } from "@/lib/auth/schemas";
import { requireOwner } from "@/lib/auth/session";
import { feedbackSchema } from "@/lib/feedback/schemas";
import { createClient } from "@/lib/supabase/server";

export type FeedbackState = { errors?: Record<string, string>; message?: string; saved?: boolean };

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function kirimMasukan(_prev: FeedbackState, formData: FormData): Promise<FeedbackState> {
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
    return { message: "Masukan belum terkirim. Periksa koneksi internet, lalu coba lagi." };
  }
  return { saved: true };
}
