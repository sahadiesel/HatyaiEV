import type { DocumentKind } from "@/lib/documents-firestore-types";
import { listDocumentNumbers } from "@/lib/documents-repository";
import { loadCompanyBrand } from "./brand";

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** เลขที่เอกสาร เช่น INV66008 จาก prefix + ปี พ.ศ. 2 หลัก + ลำดับ */
export async function nextDocumentNumber(kind: DocumentKind, now = new Date()): Promise<string> {
  const brand = await loadCompanyBrand();
  const prefixMap: Record<DocumentKind, string> = {
    INVOICE: brand.docPrefixInvoice,
    TAX_INVOICE: brand.docPrefixTaxInvoice,
    RECEIPT: brand.docPrefixReceipt,
    WITHHOLDING_TAX: brand.docPrefixWht,
    PURCHASE_ORDER: "PO",
    PAYMENT_VOUCHER: "PV",
  };
  const prefix = (prefixMap[kind] || "DOC").trim();
  const beYear = (now.getFullYear() + 543) % 100;
  const yy = String(beYear).padStart(2, "0");
  const head = `${prefix}${yy}`;
  const re = new RegExp(`^${escapeRegex(head)}(\\d+)$`, "i");
  const rows = await listDocumentNumbers(kind, head);
  let max = 0;
  for (const number of rows) {
    const m = number.match(re);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${head}${String(max + 1).padStart(3, "0")}`;
}
