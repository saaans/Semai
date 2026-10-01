import { Card, CardDescription, CardTitle } from "@/components/ui/card";

/** Admin (paket Plus) tidak membuka gaji. */
export function OwnerOnlyCard() {
  return (
    <Card className="max-w-xl">
      <CardTitle>Khusus pemilik usaha</CardTitle>
      <CardDescription>Gaji, slip, dan kasbon hanya bisa dibuka dan diproses oleh pemilik usaha.</CardDescription>
    </Card>
  );
}
