import type { Metadata } from "next";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";

export const metadata: Metadata = { title: "Dashboard" };

const summary = [
  { label: "Masuk", value: "–" },
  { label: "Telat", value: "–" },
  { label: "Izin", value: "–" },
  { label: "Belum absen", value: "–" },
];

export default function OwnerPage() {
  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl sm:text-4xl">Hari ini</h1>
        <p className="text-smoke">Dashboard pemilik usaha. Data absen tampil di sini nanti.</p>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {summary.map((item) => (
          <Card key={item.label}>
            <p className="text-sm text-smoke">{item.label}</p>
            <p className="mt-2 font-display text-4xl">{item.value}</p>
          </Card>
        ))}
      </div>
      <Card>
        <Tag tone="outline">Placeholder</Tag>
        <CardTitle className="mt-3">Belum ada karyawan</CardTitle>
        <CardDescription>Onboarding dan undang karyawan dibuat di langkah berikutnya.</CardDescription>
      </Card>
    </>
  );
}
