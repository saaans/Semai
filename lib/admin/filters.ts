/**
 * Filter daftar usaha di /admin/usaha. Dibaca dari query string supaya
 * tautan bisa dibagikan antar tim. Fungsi murni, aman di server maupun client.
 */

import { z } from "zod";
import { BUSINESS_TYPES, type BusinessType } from "@/lib/onboarding/defaults";

export const ACTIVITY_FILTERS = [
  { value: "7_hari", label: "Aktif 7 hari terakhir" },
  { value: "30_hari", label: "Aktif 30 hari terakhir" },
  { value: "tidak_aktif_30", label: "Tidak aktif > 30 hari" },
  { value: "belum_pernah", label: "Belum pernah aktif" },
] as const;

export type ActivityFilter = (typeof ACTIVITY_FILTERS)[number]["value"];

export const PAGE_SIZE = 50;

export type CompanyFilters = {
  search: string | null;
  businessType: BusinessType | null;
  city: string | null;
  /** Kode paket, "trial", atau null. */
  plan: string | null;
  activity: ActivityFilter | null;
  page: number;
};

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .catch(null);

const schema = z.object({
  q: text(80),
  bidang: z
    .enum(BUSINESS_TYPES.map((b) => b.value) as [BusinessType, ...BusinessType[]])
    .nullable()
    .catch(null),
  kota: text(80),
  paket: z
    .string()
    .regex(/^[a-z0-9_]{1,40}$/)
    .nullable()
    .catch(null),
  aktif: z
    .enum(ACTIVITY_FILTERS.map((a) => a.value) as [ActivityFilter, ...ActivityFilter[]])
    .nullable()
    .catch(null),
  hal: z.coerce.number().int().min(1).max(10_000).catch(1),
});

type RawParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export function parseCompanyFilters(params: RawParams): CompanyFilters {
  const parsed = schema.parse({
    q: first(params.q),
    bidang: first(params.bidang),
    kota: first(params.kota),
    paket: first(params.paket),
    aktif: first(params.aktif),
    hal: first(params.hal) ?? 1,
  });
  return {
    search: parsed.q,
    businessType: parsed.bidang,
    city: parsed.kota,
    plan: parsed.paket,
    activity: parsed.aktif,
    page: parsed.hal,
  };
}

/** Query string untuk filter (tanpa nilai kosong). Halaman 1 tidak ditulis. */
export function companyFiltersQuery(filters: Partial<CompanyFilters>): string {
  const params = new URLSearchParams();
  if (filters.search) params.set("q", filters.search);
  if (filters.businessType) params.set("bidang", filters.businessType);
  if (filters.city) params.set("kota", filters.city);
  if (filters.plan) params.set("paket", filters.plan);
  if (filters.activity) params.set("aktif", filters.activity);
  if (filters.page && filters.page > 1) params.set("hal", String(filters.page));
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function hasActiveFilter(filters: CompanyFilters): boolean {
  return Boolean(filters.search || filters.businessType || filters.city || filters.plan || filters.activity);
}

export function businessTypeLabel(value: string | null): string {
  return BUSINESS_TYPES.find((b) => b.value === value)?.label ?? "–";
}
