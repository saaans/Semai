import { redirect } from "next/navigation";
import { requireOwner } from "@/lib/auth/session";
import { furthestStep, getOnboardingData } from "@/lib/onboarding/data";

/** Lanjutkan dari langkah terakhir yang belum selesai. */
export default async function OnboardingPage() {
  const owner = await requireOwner();
  if (owner.onboardingCompleted) redirect("/owner");

  const { progress } = await getOnboardingData(owner.companyId);
  redirect(`/owner/onboarding/${furthestStep(progress)}`);
}
