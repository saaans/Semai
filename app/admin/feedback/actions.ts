"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { fieldErrors } from "@/lib/auth/schemas";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { feedbackStatusSchema } from "@/lib/feedback/schemas";
import { createClient } from "@/lib/supabase/server";

export type FeedbackStatusState = { message?: string; saved?: boolean };

const SAVE_FAILED = "Gagal menyimpan. Muat ulang halaman, lalu coba lagi.";

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function ubahStatusMasukan(
  _prev: FeedbackStatusState,
  formData: FormData,
): Promise<FeedbackStatusState> {
  try {
    return await simpanStatus(formData);
  } catch (error) {
    unstable_rethrow(error);
    console.error("[ubahStatusMasukan] gagal", error);
    return { message: SAVE_FAILED };
  }
}

async function simpanStatus(formData: FormData): Promise<FeedbackStatusState> {
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
    return { message: SAVE_FAILED };
  }

  revalidatePath("/admin/feedback");
  return { saved: true };
}
