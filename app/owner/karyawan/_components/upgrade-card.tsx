import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";

/** Satu-satunya ajakan upgrade di halaman karyawan saat kuota penuh. */
export function UpgradeCard({ planName, limit }: { planName: string; limit: number | null }) {
  return (
    <Card>
      <Tag tone="accent">Kuota penuh</Tag>
      <CardTitle className="mt-3">Upgrade untuk menambah karyawan</CardTitle>
      <CardDescription>
        Paket {planName} untuk maksimal {limit ?? "–"} karyawan (aktif dan yang masih diundang).
        Upgrade paket, atau nonaktifkan karyawan yang sudah tidak bekerja. Absen karyawan yang ada
        tetap jalan seperti biasa.
      </CardDescription>
      <div className="mt-4">
        <Button variant="secondary" arrow={false} disabled>
          Lihat paket · segera tersedia
        </Button>
      </div>
    </Card>
  );
}
