import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
import { requireOwner } from "@/lib/auth/session";
import { startingPrice } from "@/lib/billing/catalog";
import { getBillingOverview, getPlans } from "@/lib/billing/server";
import { formatRupiah } from "@/lib/format";
import { hasFeature, isFeatureKey, minLevelLabel } from "@/lib/plans";
import { getCompanyPlan } from "@/lib/plans-server";
import { FEATURE_INFO, FEATURE_PAGE } from "../../_components/menu";
import { TrialButton } from "../../paket/paket-forms";
import { FeaturePreview } from "./previews";

export const metadata: Metadata = { title: "Fitur" };

/**
 * Fitur paket dari menu samping. Terkunci: pratinjau contoh data yang
 * diburamkan + satu kartu ajakan upgrade. Termasuk paket tapi halamannya
 * belum dibuat: info "segera tersedia".
 */
export default async function FiturPage({ params }: { params: Promise<{ key: string }> }) {
  const owner = await requireOwner();
  if (!owner.onboardingCompleted) redirect("/owner/onboarding");

  const { key } = await params;
  const info = isFeatureKey(key) ? FEATURE_INFO[key] : undefined;
  if (!isFeatureKey(key) || !info) notFound();

  const plan = await getCompanyPlan(owner.companyId);
  const unlocked = hasFeature(plan, key);
  const page = FEATURE_PAGE[key];
  if (unlocked && page) redirect(page);

  if (unlocked) {
    return (
      <div className="flex max-w-xl flex-col gap-6">
        <h1 className="text-3xl sm:text-4xl">{info.label}</h1>
        <Card>
          <Tag tone="outline">Segera tersedia</Tag>
          <CardTitle className="mt-3">Fitur ini sudah termasuk paketmu</CardTitle>
          <CardDescription>{info.benefit} Halamannya sedang kami siapkan.</CardDescription>
        </Card>
      </div>
    );
  }

  const [overview, plans] = await Promise.all([getBillingOverview(owner.companyId), getPlans()]);
  const minLevel = plan.minLevel[key];
  const planLabel = minLevelLabel(plan, key) ?? "berbayar";
  const price = minLevel ? startingPrice(plans, minLevel) : null;
  const canTrial = owner.role === "owner" && !overview.trialUsed && overview.level === "benih";

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <h1 className="text-3xl sm:text-4xl">{info.label}</h1>
      <Card className="border border-stone bg-canvas">
        <Tag tone="accent">Paket {planLabel}</Tag>
        <CardTitle className="mt-3">
          Buka {info.label} dengan paket {planLabel}
        </CardTitle>
        <CardDescription>{info.benefit}</CardDescription>
        {price !== null && (
          <p className="mt-3 text-sm text-graphite">
            Mulai <span className="font-medium text-ink">{formatRupiah(price)}</span>/bulan
          </p>
        )}
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-start">
          {canTrial ? (
            <>
              <TrialButton next={page ?? `/owner/fitur/${key}`} />
              <ButtonLink href="/owner/paket" variant="secondary">
                Lihat paket
              </ButtonLink>
            </>
          ) : (
            <ButtonLink href="/owner/paket">Lihat paket</ButtonLink>
          )}
        </div>
        {canTrial && (
          <p className="mt-3 text-xs text-ash">Trial Plus 14 hari, tanpa kartu kredit. Setelah itu kembali ke Benih.</p>
        )}
      </Card>
      <FeaturePreview featureKey={key} />
    </div>
  );
}
