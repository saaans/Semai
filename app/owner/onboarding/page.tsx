import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { requireOwner } from "@/lib/auth/session";
import { formatPhone } from "@/lib/auth/schemas";

export const metadata: Metadata = { title: "Onboarding" };

export default async function OnboardingPage() {
  const owner = await requireOwner();
  if (owner.onboardingCompleted) redirect("/owner");

  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl">Siapkan usahamu</h1>
        <p className="text-smoke">Onboarding 6 langkah menyusul.</p>
      </div>
      {owner.phone && (
        <Card>
          <CardTitle>Nomor WA kamu</CardTitle>
          <CardDescription>
            <span className="font-mono text-ink">{formatPhone(owner.phone)}</span>. Bisa diubah
            di langkah profil usaha.
          </CardDescription>
        </Card>
      )}
    </>
  );
}
