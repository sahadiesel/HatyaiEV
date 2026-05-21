import type { DocumentKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { loadCompanyBrand } from "./brand";
import { DOCUMENT_KIND_ROUTES } from "./types";

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** เลขที่เอกสาร เช่น INV66008 จาก prefix + ปี พ.ศ. 2 หลัก + ลำดับ */
export async function nextDocumentNumber(kind: DocumentKind, now = new Date()): Promise<string> {
  const brand = await loadCompanyBrand();
  const route = DOCUMENT_KIND_ROUTES[kind];
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
  const rows = await prisma.document.findMany({
    where: { kind, number: { startsWith: head } },
    select: { number: true },
  });
  let max = 0;
  for (const r of rows) {
    const m = r.number.match(re);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${head}${String(max + 1).padStart(3, "0")}`;
}
