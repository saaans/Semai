import "server-only";
import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { formatRupiah } from "@/lib/format";
import type { PayslipLine } from "./calculate";
import { splitLines } from "./lines";

export type SlipDocument = {
  company: { name: string; address: string | null; phone: string | null; logo: Buffer | null };
  employee: { name: string; position: string | null };
  /** "September 2026". */
  periodLabel: string;
  /** "1 Sep 2026 – 30 Sep 2026". */
  periodRange: string;
  /** "1 Okt 2026". */
  lockedLabel: string;
  slipId: string;
  lines: PayslipLine[];
  netPay: number;
  attendance: { label: string; value: string }[];
  watermark: boolean;
};

const INK = "#000000";
const SMOKE = "#777169";
const STONE = "#ebe8e4";
const TAUPE = "#f5f3f1";

const s = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", color: INK, backgroundColor: "#ffffff" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 },
  companyBlock: { flexDirection: "row", alignItems: "center", gap: 10, maxWidth: 320 },
  logo: { width: 44, height: 44, objectFit: "contain" },
  companyName: { fontSize: 14, fontFamily: "Helvetica-Bold" },
  muted: { color: SMOKE },
  title: { fontSize: 18, textAlign: "right" },
  section: { marginBottom: 16 },
  panel: { backgroundColor: TAUPE, borderRadius: 8, padding: 12, marginBottom: 16, flexDirection: "row", justifyContent: "space-between" },
  label: { fontSize: 8, color: SMOKE, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: STONE },
  rowLeft: { flexDirection: "column", maxWidth: 360 },
  detail: { fontSize: 8, color: SMOKE, marginTop: 1 },
  amount: { fontFamily: "Courier" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingTop: 10, marginTop: 4, borderTopWidth: 1.5, borderTopColor: INK },
  totalText: { fontSize: 13, fontFamily: "Helvetica-Bold" },
  facts: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  fact: { minWidth: 70 },
  footer: { position: "absolute", bottom: 28, left: 40, right: 40, fontSize: 8, color: SMOKE, flexDirection: "row", justifyContent: "space-between" },
  watermark: {
    position: "absolute",
    top: 380,
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 46,
    color: "#000000",
    opacity: 0.06,
    transform: "rotate(-30deg)",
  },
});

function Lines({ title, lines, minus }: { title: string; lines: PayslipLine[]; minus?: boolean }) {
  if (lines.length === 0) return null;
  return (
    <View style={s.section}>
      <Text style={s.label}>{title}</Text>
      {lines.map((line, i) => (
        <View key={i} style={s.row} wrap={false}>
          <View style={s.rowLeft}>
            <Text>{line.label}</Text>
            {line.detail ? <Text style={s.detail}>{line.detail}</Text> : null}
          </View>
          <Text style={s.amount}>
            {minus ? "-" : ""}
            {formatRupiah(Math.abs(line.amount))}
          </Text>
        </View>
      ))}
    </View>
  );
}

function SlipPdf({ data }: { data: SlipDocument }) {
  const { income, deductions } = splitLines(data.lines);
  return (
    <Document title={`Slip gaji ${data.employee.name} ${data.periodLabel}`} author={data.company.name} creator="Semai">
      <Page size="A4" style={s.page}>
        {data.watermark && (
          <Text style={s.watermark} fixed>
            Dibuat dengan Semai
          </Text>
        )}

        <View style={s.header}>
          <View style={s.companyBlock}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- Image react-pdf, bukan <img> */}
            {data.company.logo && <Image style={s.logo} src={data.company.logo} />}
            <View>
              <Text style={s.companyName}>{data.company.name}</Text>
              {data.company.address && <Text style={s.muted}>{data.company.address}</Text>}
              {data.company.phone && <Text style={s.muted}>WA +{data.company.phone}</Text>}
            </View>
          </View>
          <View>
            <Text style={s.title}>Slip gaji</Text>
            <Text style={[s.muted, { textAlign: "right" }]}>{data.periodLabel}</Text>
          </View>
        </View>

        <View style={s.panel}>
          <View>
            <Text style={s.label}>Karyawan</Text>
            <Text>{data.employee.name}</Text>
            {data.employee.position && <Text style={s.muted}>{data.employee.position}</Text>}
          </View>
          <View>
            <Text style={s.label}>Periode</Text>
            <Text>{data.periodRange}</Text>
          </View>
        </View>

        {data.attendance.length > 0 && (
          <View style={s.section}>
            <Text style={s.label}>Ringkasan absen</Text>
            <View style={s.facts}>
              {data.attendance.map((f) => (
                <View key={f.label} style={s.fact}>
                  <Text style={s.muted}>{f.label}</Text>
                  <Text>{f.value}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <Lines title="Pendapatan" lines={income} />
        <Lines title="Potongan" lines={deductions} minus />

        <View style={s.totalRow} wrap={false}>
          <Text style={s.totalText}>Gaji bersih</Text>
          <Text style={[s.totalText, { fontFamily: "Courier-Bold" }]}>{formatRupiah(data.netPay)}</Text>
        </View>

        <View style={s.footer} fixed>
          <Text>
            Dikunci {data.lockedLabel} · No. {data.slipId.slice(0, 8).toUpperCase()}
          </Text>
          {data.watermark && <Text>Dibuat dengan Semai</Text>}
        </View>
      </Page>
    </Document>
  );
}

export function renderSlipPdf(data: SlipDocument): Promise<Buffer> {
  return renderToBuffer(<SlipPdf data={data} />);
}
