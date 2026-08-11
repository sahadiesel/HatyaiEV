import { calcWithholdingTotals, parseAmount, withholdingVatRatePercent } from "@/lib/documents/calc";
import type { DocumentRecord } from "@/lib/documents-firestore-types";
import {
  defaultPaymentVoucherMeta,
  defaultWithholdingMeta,
  parseMetaJson,
  type PaymentVoucherMeta,
  type WithholdingDocumentMeta,
} from "@/lib/documents/types";

/** ดึงเลขที่ใบหัก ณ ที่จ่ายจาก meta หรือหมายเหตุ */
export function extractWhtDocNumber(
  meta: PaymentVoucherMeta,
  notes = "",
): string {
  if (meta.withholdingDocumentNumber?.trim()) {
    return meta.withholdingDocumentNumber.trim();
  }
  const m = notes.match(/หัก\s*ณ\s*ที่จ่าย\s*([A-Za-z0-9\-]+)/i);
  return (m?.[1] || "").trim();
}

export function resolvePaymentVoucherWht(
  meta: PaymentVoucherMeta,
  notes = "",
): {
  hasWht: boolean;
  whtNo: string;
  rate: number;
  base: number;
  whtAmt: number;
} {
  const whtNo = extractWhtDocNumber(meta, notes);
  const rate = parseAmount(meta.withholdingTaxRatePercent ?? "");
  const base = parseAmount(meta.withholdingTaxBase ?? "");
  const whtAmt = parseAmount(meta.withholdingAmount ?? "");
  const hasWht = Boolean(whtNo || whtAmt > 0 || rate > 0);
  return { hasWht, whtNo, rate, base, whtAmt };
}

/** เติมรายละเอียดหัก ณ ที่จ่ายจากเอกสาร WHT (ถ้ายังไม่มียอดใน meta) */
export function enrichPaymentVoucherMetaFromWhtDoc(
  meta: PaymentVoucherMeta,
  notes: string,
  whtDoc: DocumentRecord | null | undefined,
): PaymentVoucherMeta {
  const whtNo = extractWhtDocNumber(meta, notes) || whtDoc?.number || "";
  if (!whtDoc && !whtNo) return meta;

  const whtMeta = whtDoc
    ? parseMetaJson<WithholdingDocumentMeta>(whtDoc.metaJson, defaultWithholdingMeta())
    : null;

  const base =
    parseAmount(meta.withholdingTaxBase ?? "") ||
    (whtMeta ? parseAmount(whtMeta.withholdingTaxBase) : 0);
  const rate =
    parseAmount(meta.withholdingTaxRatePercent ?? "") ||
    (whtMeta ? parseAmount(whtMeta.withholdingTaxRatePercent) : 0);

  let whtAmt = parseAmount(meta.withholdingAmount ?? "");
  if (whtAmt <= 0 && whtDoc) {
    whtAmt = parseAmount(whtDoc.withholdingAmount);
  }
  if (whtAmt <= 0 && base > 0 && rate > 0 && whtMeta) {
    whtAmt = calcWithholdingTotals({
      base,
      vatRatePercent: withholdingVatRatePercent(whtMeta),
      whtRatePercent: rate,
    }).withholdingAmount;
  } else if (whtAmt <= 0 && base > 0 && rate > 0) {
    whtAmt = calcWithholdingTotals({
      base,
      vatRatePercent: 0,
      whtRatePercent: rate,
    }).withholdingAmount;
  }

  return {
    ...meta,
    withholdingDocumentNumber: whtNo || meta.withholdingDocumentNumber,
    withholdingTaxBase: base > 0 ? String(base) : meta.withholdingTaxBase,
    withholdingTaxRatePercent: rate > 0 ? String(rate) : meta.withholdingTaxRatePercent,
    withholdingAmount: whtAmt > 0 ? String(whtAmt) : meta.withholdingAmount,
  };
}

export function effectivePaymentVoucherWithholdingAmount(
  doc: Pick<DocumentRecord, "withholdingAmount" | "metaJson" | "notes" | "kind">,
  whtByNumber?: Map<string, DocumentRecord>,
): number {
  const root = parseAmount(doc.withholdingAmount);
  if (root > 0) return root;

  const meta = parseMetaJson<PaymentVoucherMeta>(doc.metaJson, defaultPaymentVoucherMeta());
  const fromMeta = parseAmount(meta.withholdingAmount ?? "");
  if (fromMeta > 0) return fromMeta;

  if (!whtByNumber) return 0;
  const no = extractWhtDocNumber(meta, doc.notes || "");
  if (!no) return 0;
  const whtDoc = whtByNumber.get(no);
  if (!whtDoc) return 0;
  const enriched = enrichPaymentVoucherMetaFromWhtDoc(meta, doc.notes || "", whtDoc);
  return parseAmount(enriched.withholdingAmount ?? "");
}
