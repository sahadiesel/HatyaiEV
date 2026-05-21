import type { DocumentKind } from "@/lib/documents-firestore-types";

export type DocumentLineItem = {
  sequence: number;
  code: string;
  description: string;
  unitPrice: string;
  quantity: string;
  amount: string;
};

export type PaymentMethod = "CASH" | "TRANSFER" | "CHEQUE";

export type CommercialDocumentMeta = {
  /** ชื่อผู้ออกเอกสาร (ผู้ login) */
  issuedByName?: string;
  counterpartyName: string;
  counterpartyAddress: string;
  counterpartyTaxId: string;
  counterpartyPhone: string;
  counterpartyBranchHeadOffice: boolean;
  counterpartyBranchNo: string;
  paymentMethod?: PaymentMethod;
  bankAccountText?: string;
  chequeNo?: string;
  chequeDate?: string;
  vatRatePercent?: number;
};

export type WithholdingDocumentMeta = {
  issuedByName?: string;
  payeeName: string;
  payeeTaxId: string;
  payeeAddress: string;
  payeeBranchHeadOffice: boolean;
  payeeBranchNo: string;
  incomeTypeLabel: string;
  jobDescription: string;
  withholdingTaxRatePercent: string;
  withholdingTaxBase: string;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  referenceNo: string;
};

export type DocumentPayload = {
  lines: DocumentLineItem[];
  meta: CommercialDocumentMeta | WithholdingDocumentMeta;
};

export const DOCUMENT_KIND_ROUTES: Record<
  DocumentKind,
  { slug: string; titleTh: string; titleEn: string; prefixKey: string }
> = {
  INVOICE: { slug: "invoice", titleTh: "ใบแจ้งหนี้", titleEn: "INVOICE", prefixKey: "docPrefixInvoice" },
  TAX_INVOICE: {
    slug: "tax-invoice",
    titleTh: "ใบส่งสินค้า / ใบกำกับภาษี",
    titleEn: "DELIVERY NOTE / TAX INVOICE",
    prefixKey: "docPrefixTaxInvoice",
  },
  RECEIPT: { slug: "receipt", titleTh: "ใบเสร็จรับเงิน", titleEn: "RECEIPT", prefixKey: "docPrefixReceipt" },
  PURCHASE_ORDER: { slug: "purchase-order", titleTh: "ใบสั่งจ้าง", titleEn: "PURCHASE ORDER", prefixKey: "docPrefixPo" },
  WITHHOLDING_TAX: {
    slug: "withholding",
    titleTh: "หนังสือรับรองการหักภาษี ณ ที่จ่าย",
    titleEn: "WITHHOLDING TAX",
    prefixKey: "docPrefixWht",
  },
  PAYMENT_VOUCHER: {
    slug: "payment-voucher",
    titleTh: "ใบสำคัญจ่าย",
    titleEn: "PAYMENT VOUCHER",
    prefixKey: "docPrefixPo",
  },
};

export function parseLinesJson(raw: string | null | undefined): DocumentLineItem[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as DocumentLineItem[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((l, i) => ({
      sequence: l.sequence ?? i + 1,
      code: String(l.code ?? ""),
      description: String(l.description ?? ""),
      unitPrice: String(l.unitPrice ?? ""),
      quantity: String(l.quantity ?? "1"),
      amount: String(l.amount ?? ""),
    }));
  } catch {
    return [];
  }
}

export function parseMetaJson<T>(raw: string | null | undefined, defaults: T): T {
  if (!raw?.trim()) return defaults;
  try {
    return { ...defaults, ...(JSON.parse(raw) as object) };
  } catch {
    return defaults;
  }
}

export function defaultCommercialMeta(): CommercialDocumentMeta {
  return {
    counterpartyName: "",
    counterpartyAddress: "",
    counterpartyTaxId: "",
    counterpartyPhone: "",
    counterpartyBranchHeadOffice: true,
    counterpartyBranchNo: "",
    paymentMethod: "TRANSFER",
    bankAccountText: "กรุณาโอนเข้าบัญชี ธ.กสิกรไทย เลขที่ 215-8-41628-2 ชื่อบัญชี บจก. หาดใหญ่ อีวี",
    vatRatePercent: 7,
  };
}

export function defaultWithholdingMeta(): WithholdingDocumentMeta {
  return {
    payeeName: "",
    payeeTaxId: "",
    payeeAddress: "",
    payeeBranchHeadOffice: true,
    payeeBranchNo: "",
    incomeTypeLabel: "ค่าจ้างทำของ / ค่าบริการ",
    jobDescription: "",
    withholdingTaxRatePercent: "3",
    withholdingTaxBase: "",
    paymentDate: new Date().toISOString().slice(0, 10),
    paymentMethod: "TRANSFER",
    referenceNo: "",
  };
}

export function emptyLine(sequence: number): DocumentLineItem {
  return { sequence, code: "", description: "", unitPrice: "", quantity: "1", amount: "" };
}
