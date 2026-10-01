import { Tag } from "@/components/ui/tag";

const labels = {
  aktif: { label: "Aktif", tone: "ink" },
  diundang: { label: "Diundang", tone: "outline" },
  nonaktif: { label: "Nonaktif", tone: "neutral" },
} as const;

export function StatusTag({ status }: { status: string }) {
  const item = labels[status as keyof typeof labels] ?? labels.nonaktif;
  return <Tag tone={item.tone}>{item.label}</Tag>;
}
