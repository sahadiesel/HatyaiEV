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

/**
 * VAT รถยนต์มือสองตามประเภทการซื้อเข้า (ป.111)
 * - INDIVIDUAL_NO_VAT → Margin Scheme: VAT จากกำไรขั้นต้น × 7/107
 * - COMPANY_VAT_7 → VAT จากยอดขายเต็ม × 7/107 (ราคารวม VAT)
 */
export function calcVehicleSaleVatTotals(opts: {
  purchaseType: "INDIVIDUAL_NO_VAT" | "COMPANY_VAT_7";
  salePriceInclusive: number;
  totalCost: number;
  vatRatePercent?: number;
}) {
  const rate = opts.vatRatePercent ?? 7;
  const sale = roundMoney2(opts.salePriceInclusive);
  const cost = roundMoney2(opts.totalCost);

  if (opts.purchaseType === "INDIVIDUAL_NO_VAT") {
    const margin = roundMoney2(Math.max(0, sale - cost));
    const vatAmount = roundMoney2((margin * rate) / (100 + rate));
    const subtotal = roundMoney2(sale - vatAmount);
    return {
      scheme: "MARGIN" as const,
      subtotal,
      vatAmount,
      totalAmount: sale,
      margin,
      taxableBase: roundMoney2(margin - vatAmount),
    };
  }

  const vatAmount = roundMoney2((sale * rate) / (100 + rate));
  const subtotal = roundMoney2(sale - vatAmount);
  return {
    scheme: "FULL" as const,
    subtotal,
    vatAmount,
    totalAmount: sale,
    margin: roundMoney2(sale - cost),
    taxableBase: subtotal,
  };
}
