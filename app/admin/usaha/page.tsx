import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
import {
  ACTIVITY_FILTERS,
  PAGE_SIZE,
  businessTypeLabel,
  companyFiltersQuery,
  hasActiveFilter,
  parseCompanyFilters,
} from "@/lib/admin/filters";
import { listCities, listCompanies, listPlans } from "@/lib/admin/server";
import { formatDate } from "@/lib/format";
import { BUSINESS_TYPES } from "@/lib/onboarding/defaults";
import { FilterSelect } from "../_components/filter-select";
import { Pagination } from "../_components/pagination";

export const metadata: Metadata = { title: "Daftar usaha" };

type Row = Awaited<ReturnType<typeof listCompanies>>["rows"][number];

function lastActive(value: string | null): string {
  if (!value) return "Belum pernah";
  const days = Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000);
  if (days <= 0) return "Hari ini";
  if (days === 1) return "Kemarin";
  if (days < 30) return `${days} hari lalu`;
  return formatDate(value);
}

function PlanCell({ row }: { row: Row }) {
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <span>{row.plan_name}</span>
      {row.subscription_status === "trialing" && <Tag tone="outline">Trial</Tag>}
      {row.subscription_status === "past_due" && <Tag tone="outline">Lewat jatuh tempo</Tag>}
      {row.suspended_at && <Tag tone="ink">Ditangguhkan</Tag>}
      {!row.onboarding_done && <Tag tone="outline">Belum onboarding</Tag>}
    </span>
  );
}

export default async function UsahaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = parseCompanyFilters(await searchParams);
  const [{ rows, total }, cities, plans] = await Promise.all([listCompanies(filters), listCities(), listPlans()]);

  const planOptions = [
    ...plans.map((p) => ({ value: p.code, label: p.name })),
    { value: "trial", label: "Sedang trial" },
  ];

  return (
    <>
      <div>
        <h1 className="text-3xl sm:text-4xl">Daftar usaha</h1>
        <p className="mt-1 text-sm text-smoke">
          {total.toLocaleString("id-ID")} usaha{hasActiveFilter(filters) ? " sesuai filter" : ""}.
        </p>
      </div>

      <Card>
        <form method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6 lg:items-end">
          <label className="flex flex-col gap-1.5 text-sm font-medium text-graphite lg:col-span-2">
            Cari nama usaha
            <input
              type="search"
              name="q"
              defaultValue={filters.search ?? ""}
              placeholder="Contoh: Kopi Senja"
              className="min-h-11 w-full rounded-button border border-stone bg-canvas px-3.5 text-base font-normal text-ink placeholder:text-ash hover:border-ash focus:border-ink focus:outline-none"
            />
          </label>
          <FilterSelect
            label="Bidang"
            name="bidang"
            value={filters.businessType}
            options={BUSINESS_TYPES.map((b) => ({ value: b.value, label: b.label }))}
          />
          <FilterSelect
            label="Kota"
            name="kota"
            value={filters.city}
            options={cities.map((c) => ({ value: c, label: c }))}
          />
          <FilterSelect label="Paket" name="paket" value={filters.plan} options={planOptions} />
          <FilterSelect
            label="Terakhir aktif"
            name="aktif"
            value={filters.activity}
            options={ACTIVITY_FILTERS.map((a) => ({ value: a.value, label: a.label }))}
          />
          <div className="flex gap-2 sm:col-span-2 lg:col-span-6">
            <Button type="submit" arrow={false}>
              Terapkan filter
            </Button>
            {hasActiveFilter(filters) && (
              <Link
                href="/admin/usaha"
                className="flex min-h-11 items-center rounded-button px-3 text-sm text-graphite underline underline-offset-4 hover:text-ink"
              >
                Hapus filter
              </Link>
            )}
          </div>
        </form>
      </Card>

      {rows.length === 0 ? (
        <Card>
          <p className="text-sm text-smoke">
            Tidak ada usaha yang cocok. Coba hapus salah satu filter atau ganti kata pencarian.
          </p>
        </Card>
      ) : (
        <>
          {/* HP: kartu */}
          <ul className="flex flex-col gap-3 lg:hidden">
            {rows.map((row) => (
              <li key={row.id}>
                <Link href={`/admin/usaha/${row.id}`} className="block">
                  <Card className="flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-medium text-ink">{row.name ?? "Tanpa nama"}</p>
                      <span className="shrink-0 text-xs text-smoke">{lastActive(row.last_active_at)}</span>
                    </div>
                    <p className="text-sm text-smoke">
                      {businessTypeLabel(row.business_type)} · {row.city ?? "–"} · {row.employees_active} karyawan
                    </p>
                    <div className="text-sm text-graphite">
                      <PlanCell row={row} />
                    </div>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>

          {/* Laptop: tabel */}
          <div className="hidden overflow-x-auto rounded-card bg-taupe lg:block">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-smoke">
                <tr className="border-b border-stone">
                  <th className="px-5 py-3 font-medium">Usaha</th>
                  <th className="px-3 py-3 font-medium">Bidang</th>
                  <th className="px-3 py-3 font-medium">Kota</th>
                  <th className="px-3 py-3 font-medium">Paket</th>
                  <th className="px-3 py-3 text-right font-medium">Karyawan</th>
                  <th className="px-3 py-3 font-medium">Daftar</th>
                  <th className="px-5 py-3 font-medium">Terakhir aktif</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-stone last:border-0 hover:bg-canvas/60">
                    <td className="px-5 py-3">
                      <Link href={`/admin/usaha/${row.id}`} className="font-medium text-ink underline-offset-4 hover:underline">
                        {row.name ?? "Tanpa nama"}
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-graphite">{businessTypeLabel(row.business_type)}</td>
                    <td className="px-3 py-3 text-graphite">{row.city ?? "–"}</td>
                    <td className="px-3 py-3 text-graphite">
                      <PlanCell row={row} />
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-graphite">{row.employees_active}</td>
                    <td className="px-3 py-3 whitespace-nowrap text-graphite">{formatDate(row.created_at)}</td>
                    <td className="px-5 py-3 whitespace-nowrap text-graphite">{lastActive(row.last_active_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Pagination
        page={filters.page}
        total={total}
        pageSize={PAGE_SIZE}
        hrefFor={(page) => `/admin/usaha${companyFiltersQuery({ ...filters, page })}`}
      />
    </>
  );
}
