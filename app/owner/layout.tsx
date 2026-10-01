import Link from "next/link";
import { LogoutButton } from "@/components/logout-button";
import { requireOwner } from "@/lib/auth/session";
import { getBillingOverview } from "@/lib/billing/server";
import { companyLogoUrl } from "@/lib/company/logo";
import { getCompanyPlan } from "@/lib/plans-server";
import { createClient } from "@/lib/supabase/server";
import { BillingBanner } from "./_components/billing-banner";
import { buildOwnerMenu } from "./_components/menu";
import { OwnerNav, type OwnerAccount } from "./_components/owner-nav";

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  // Wajib login + anggota usaha + nomor WA. Owner baru dibuatkan usaha kosong.
  const owner = await requireOwner();

  // Selama onboarding semua halaman owner diarahkan ke onboarding: tanpa menu.
  if (!owner.onboardingCompleted) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-6xl flex-col gap-8 px-5 py-6 sm:px-8">
        <header className="flex items-center justify-between gap-4 border-b border-stone pb-4">
          <Link href="/owner" className="font-display text-2xl tracking-tight">
            semai
          </Link>
          <LogoutButton />
        </header>
        <main className="flex flex-1 flex-col gap-6">{children}</main>
      </div>
    );
  }

  const supabase = await createClient();
  const [plan, overview, { data: company }, { data: profile }] = await Promise.all([
    getCompanyPlan(owner.companyId),
    // Banner tagihan tidak boleh membuat seluruh area owner gagal dimuat.
    getBillingOverview(owner.companyId).catch(() => null),
    supabase.from("companies").select("name, logo_path, timezone").eq("id", owner.companyId).maybeSingle(),
    supabase.from("profiles").select("full_name").eq("id", owner.userId).maybeSingle(),
  ]);

  const account: OwnerAccount = {
    name: profile?.full_name?.trim() || owner.email?.split("@")[0] || "Owner",
    email: owner.email,
    plan: planBadge(overview?.status ?? null, overview?.level ?? plan.level),
  };

  return (
    <div className="min-h-dvh lg:flex">
      <OwnerNav
        groups={buildOwnerMenu(plan)}
        companyName={company?.name ?? "Usahamu"}
        logoUrl={companyLogoUrl(company?.logo_path)}
        account={account}
        logout={<LogoutButton variant="menu" />}
      />
      <main className="mx-auto flex w-full max-w-5xl min-w-0 flex-1 flex-col gap-6 px-5 py-6 sm:px-8 lg:py-10">
        {overview && <BillingBanner overview={overview} timezone={company?.timezone ?? "Asia/Jakarta"} />}
        {children}
      </main>
    </div>
  );
}

/** Badge paket di akun kiri bawah: Gratis (Benih), Trial, atau Premium. */
function planBadge(status: string | null, level: string): OwnerAccount["plan"] {
  if (status === "trialing") return { kind: "trial", label: "Trial Premium" };
  if (level === "benih") return { kind: "gratis", label: "Gratis" };
  return { kind: "premium", label: "Premium" };
}
