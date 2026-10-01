import type { PayslipLine } from "./calculate";

/** Pendapatan vs potongan. Penyesuaian minus masuk potongan. */
export function splitLines(lines: PayslipLine[]) {
  const income: PayslipLine[] = [];
  const deductions: PayslipLine[] = [];
  for (const line of lines) {
    const isDeduction =
      line.group === "potongan" || line.group === "kasbon" || (line.group === "penyesuaian" && line.amount < 0);
    (isDeduction ? deductions : income).push(line);
  }
  return { income, deductions };
}
