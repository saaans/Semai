"use server";

import { revalidatePath } from "next/cache";
import { fieldErrors } from "@/lib/auth/schemas";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { feedbackStatusSchema } from "@/lib/feedback/schemas";
import { createClient } from "@/lib/supabase/server";

export type FeedbackStatusState = { message?: string; saved?: boolean };

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function ubahStatusMasukan(
  _prev: FeedbackStatusState,
  formData: FormData,
): Promise<FeedbackStatusState> {
  await requirePlatformAdmin();
  const parsed = feedbackStatusSchema.safeParse({
    id: text(formData, "id"),
    status: text(formData, "status"),
    priority: text(formData, "priority"),
  });
  if (!parsed.success) return { message: Object.values(fieldErrors(parsed.error))[0] };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("feedbacks")
    .update({ status: parsed.data.status, priority: parsed.data.priority })
    .eq("id", parsed.data.id)
    .select("id");
  if (error || !data?.length) {
    if (error) console.error("[ubahStatusMasukan]", error);
    return { message: "Gagal menyimpan. Muat ulang halaman, lalu coba lagi." };
  }

  revalidatePath("/admin/feedback");
  return { saved: true };
}
