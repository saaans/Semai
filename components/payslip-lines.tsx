import { formatRupiah } from "@/lib/format";
import type { PayslipLine } from "@/lib/payroll/calculate";
import { splitLines } from "@/lib/payroll/lines";

function Row({ line, minus }: { line: PayslipLine; minus?: boolean }) {
  return (
    <li className="flex items-start justify-between gap-3 py-2">
      <div className="flex min-w-0 flex-col">
        <span className="text-sm text-ink">{line.label}</span>
        {line.detail && <span className="text-xs text-smoke">{line.detail}</span>}
      </div>
      <span className="shrink-0 font-mono text-sm text-ink">
        {minus ? "−" : ""}
        {formatRupiah(Math.abs(line.amount))}
      </span>
    </li>
  );
}

/** Rincian slip gaji: pendapatan, potongan, gaji bersih. */
export function PayslipLines({ lines, netPay }: { lines: PayslipLine[]; netPay: number }) {
  const { income, deductions } = splitLines(lines);
  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-xs font-medium tracking-wide text-smoke uppercase">Pendapatan</p>
        <ul className="divide-y divide-stone">
          {income.map((line, i) => (
            <Row key={`i${i}`} line={line} />
          ))}
        </ul>
      </div>
      {deductions.length > 0 && (
        <div>
          <p className="text-xs font-medium tracking-wide text-smoke uppercase">Potongan</p>
          <ul className="divide-y divide-stone">
            {deductions.map((line, i) => (
              <Row key={`d${i}`} line={line} minus />
            ))}
          </ul>
        </div>
      )}
      <div className="flex items-center justify-between gap-3 border-t border-ink pt-3">
        <span className="font-medium text-ink">Gaji bersih</span>
        <span className="font-mono text-lg font-medium text-ink">{formatRupiah(netPay)}</span>
      </div>
    </div>
  );
}
