import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
import { requireOwner } from "@/lib/auth/session";
import { hasFeature, isFeatureKey, minLevelLabel } from "@/lib/plans";
import { getCompanyPlan } from "@/lib/plans-server";
import { FEATURE_INFO } from "../../_components/menu";

export const metadata: Metadata = { title: "Fitur" };

/**
 * Fitur paket dari menu samping. Terkunci: satu kartu ajakan upgrade.
 * Termasuk paket tapi belum dibuat: info "segera tersedia".
 * Pratinjau dengan contoh data diburamkan menyusul di Langkah 8.
 */
export default async function FiturPage({ params }: { params: Promise<{ key: string }> }) {
  const owner = await requireOwner();
  if (!owner.onboardingCompleted) redirect("/owner/onboarding");

  const { key } = await params;
  const info = isFeatureKey(key) ? FEATURE_INFO[key] : undefined;
  if (!isFeatureKey(key) || !info) notFound();

  const plan = await getCompanyPlan(owner.companyId);
  const unlocked = hasFeature(plan, key);
  const planLabel = minLevelLabel(plan, key);

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <h1 className="text-3xl sm:text-4xl">{info.label}</h1>
      <Card>
        {unlocked ? (
          <>
            <Tag tone="outline">Segera tersedia</Tag>
            <CardTitle className="mt-3">Fitur ini sudah termasuk paketmu</CardTitle>
            <CardDescription>{info.benefit} Halamannya sedang kami siapkan.</CardDescription>
          </>
        ) : (
          <>
            <Tag tone="accent">Paket {planLabel ?? "berbayar"}</Tag>
            <CardTitle className="mt-3">Buka {info.label} dengan paket {planLabel ?? "berbayar"}</CardTitle>
            <CardDescription>{info.benefit}</CardDescription>
            <div className="mt-4">
              <Button variant="secondary" arrow={false} disabled>
                Lihat paket · segera tersedia
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
