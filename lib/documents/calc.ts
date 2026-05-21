import type { DocumentLineItem } from "./types";

export function parseAmount(s: string | number): number {
  if (typeof s === "number") return Number.isFinite(s) ? s : 0;
  return parseFloat(String(s).replace(/,/g, "")) || 0;
}

export function roundMoney2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function recalcLineAmount(line: DocumentLineItem): DocumentLineItem {
  const up = parseAmount(line.unitPrice);
  const qty = parseAmount(line.quantity) || 1;
  return { ...line, amount: roundMoney2(up * qty).toFixed(2) };
}

export function calcCommercialTotals(lines: DocumentLineItem[], vatRatePercent = 7) {
  const subtotal = roundMoney2(
    lines.reduce((s, l) => s + parseAmount(l.amount), 0),
  );
  const vatAmount = roundMoney2((subtotal * vatRatePercent) / 100);
  const totalAmount = roundMoney2(subtotal + vatAmount);
  return { subtotal, vatAmount, totalAmount };
}

/** หัก ณ ที่จ่ายจากฐานก่อน VAT (แนว OPEC) */
export function calcWithholdingTotals(opts: {
  base: number;
  vatRatePercent: number;
  whtRatePercent: number;
}) {
  const subtotal = roundMoney2(opts.base);
  const vatAmount = roundMoney2((subtotal * opts.vatRatePercent) / 100);
  const totalAmount = roundMoney2(subtotal + vatAmount);
  const withholdingAmount = roundMoney2((subtotal * opts.whtRatePercent) / 100);
  return { subtotal, vatAmount, totalAmount, withholdingAmount };
}
