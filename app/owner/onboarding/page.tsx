import type { Metadata } from "next";

export const metadata: Metadata = { title: "Onboarding" };

export default function OnboardingPage() {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-3xl">Siapkan usahamu</h1>
      <p className="text-smoke">Onboarding 6 langkah menyusul.</p>
    </div>
  );
}
