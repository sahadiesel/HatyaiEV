"use server";

import { revalidatePath } from "next/cache";
import { calcCommercialTotals, calcVehicleSaleVatTotals, calcWithholdingTotals, parseAmount, recalcLineAmount } from "@/lib/documents/calc";
import type { DocumentKind } from "@/lib/documents-firestore-types";
import {
  assignDocumentNumber as assignDocumentNumberRepo,
  createDocument,
  getDocument,
  updateDocument,
} from "@/lib/documents-repository";
import { nextDocumentNumber } from "@/lib/documents/next-number";
import {
  defaultCommercialMeta,
  defaultPaymentVoucherMeta,
  defaultWithholdingMeta,
  DOCUMENT_KIND_ROUTES,
  parseMetaJson,
  type CommercialDocumentMeta,
  type DocumentLineItem,
  type PaymentVoucherMeta,
  type WithholdingDocumentMeta,
} from "@/lib/documents/types";
import { postCashbookEntry } from "@/lib/cashbook-repository";

const COMMERCIAL_KINDS: DocumentKind[] = ["INVOICE", "TAX_INVOICE", "RECEIPT"];

function revalidateDoc(kind: DocumentKind) {
  const slug = DOCUMENT_KIND_ROUTES[kind].slug;
  revalidatePath(`/documents/${slug}`);
  revalidatePath(`/documents/${slug}/new`);
  revalidatePath("/cashbook");
}

function parseLinesFromForm(fd: FormData): DocumentLineItem[] {
  const raw = String(fd.get("linesJson") ?? "[]");
  try {
    const arr = JSON.parse(raw) as DocumentLineItem[];
    if (!Array.isArray(arr)) return [];
    return arr.map((l, i) => recalcLineAmount({ ...l, sequence: i + 1 }));
  } catch {
    return [];
  }
}

async function autoPostCashFromDocument(opts: {
  documentId: string;
  kind: DocumentKind;
  number: string;
  issueDate: Date;
  totalAmount: number;
  description: string;
  issuedByName?: string;
}) {
  if (opts.totalAmount <= 0) return;
  if (opts.kind === "RECEIPT") {
    await postCashbookEntry({
      entryDate: opts.issueDate.toISOString().slice(0, 10),
      direction: "IN",
      entryType: "DOCUMENT_AUTO",
      amount: opts.totalAmount,
      description: opts.description || `ใบเสร็จ ${opts.number}`,
      documentId: opts.documentId,
      documentKind: opts.kind,
      documentNumber: opts.number,
      createdByName: opts.issuedByName,
    });
  } else if (opts.kind === "PAYMENT_VOUCHER") {
    await postCashbookEntry({
      entryDate: opts.issueDate.toISOString().slice(0, 10),
      direction: "OUT",
      entryType: "DOCUMENT_AUTO",
      amount: opts.totalAmount,
      description: opts.description || `ใบสำคัญจ่าย ${opts.number}`,
      documentId: opts.documentId,
      documentKind: opts.kind,
      documentNumber: opts.number,
      createdByName: opts.issuedByName,
    });
  }
}

export async function saveCommercialDocument(formData: FormData) {
  const kind = String(formData.get("kind") ?? "") as DocumentKind;
  if (!COMMERCIAL_KINDS.includes(kind)) {
    return { ok: false as const, message: "ประเภทเอกสารไม่ถูกต้อง" };
  }
  const id = String(formData.get("id") ?? "").trim();
  const clientId = String(formData.get("clientId") ?? "").trim() || null;
  const issueDateStr = String(formData.get("issueDate") ?? "");
  const issueDate = issueDateStr ? new Date(issueDateStr) : new Date();
  const lines = parseLinesFromForm(formData);
  const issuedByName = String(formData.get("issuedByName") ?? "").trim();
  const meta = {
    ...parseMetaJson<CommercialDocumentMeta>(
      String(formData.get("metaJson") ?? ""),
      defaultCommercialMeta(),
    ),
    issuedByName,
  };
  const vatRate = meta.vatRatePercent ?? 7;
  let subtotal: number;
  let vatAmount: number;
  let totalAmount: number;

  if (meta.vatScheme === "MARGIN" || meta.vatScheme === "FULL_SALE") {
    const salePriceInclusive = lines.reduce((s, l) => s + parseAmount(l.amount), 0);
    const purchaseType =
      meta.purchaseType ?? (meta.vatScheme === "MARGIN" ? "INDIVIDUAL_NO_VAT" : "COMPANY_VAT_7");
    const r = calcVehicleSaleVatTotals({
      purchaseType,
      salePriceInclusive,
      totalCost: meta.totalCostSnapshot ?? 0,
      vatRatePercent: vatRate,
    });
    subtotal = r.subtotal;
    vatAmount = r.vatAmount;
    totalAmount = r.totalAmount;
  } else {
    const t = calcCommercialTotals(lines, vatRate);
    subtotal = t.subtotal;
    vatAmount = t.vatAmount;
    totalAmount = t.totalAmount;
  }
  const notes = String(formData.get("notes") ?? "");
  const assignNumber = formData.get("assignNumber") === "1";

  const data = {
    kind,
    issueDate,
    subtotal: String(subtotal),
    vatAmount: String(vatAmount),
    totalAmount: String(totalAmount),
    withholdingAmount: "0",
    notes,
    linesJson: JSON.stringify(lines),
    metaJson: JSON.stringify(meta),
    clientId,
    contractorId: null as string | null,
  };

  try {
    if (id) {
      await updateDocument(id, data);
      revalidateDoc(kind);
      return { ok: true as const, id, number: null };
    }

    const number = assignNumber ? await nextDocumentNumber(kind, issueDate) : "";
    const created = await createDocument({ ...data, number });
    if (number) {
      await autoPostCashFromDocument({
        documentId: created.id,
        kind,
        number: created.number || number,
        issueDate,
        totalAmount,
        description: `${DOCUMENT_KIND_ROUTES[kind].titleTh} ${created.number || number} — ${meta.counterpartyName}`,
        issuedByName,
      });
    }
    revalidateDoc(kind);
    return { ok: true as const, id: created.id, number: created.number || null };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false as const, message };
  }
}

export async function saveWithholdingDocument(formData: FormData) {
  const kind: DocumentKind = "WITHHOLDING_TAX";
  const id = String(formData.get("id") ?? "").trim();
  const contractorId = String(formData.get("contractorId") ?? "").trim() || null;
  const issueDateStr = String(formData.get("issueDate") ?? "");
  const issueDate = issueDateStr ? new Date(issueDateStr) : new Date();
  const issuedByName = String(formData.get("issuedByName") ?? "").trim();
  const meta = {
    ...parseMetaJson<WithholdingDocumentMeta>(
      String(formData.get("metaJson") ?? ""),
      defaultWithholdingMeta(),
    ),
    issuedByName,
  };
  const base = parseAmount(meta.withholdingTaxBase);
  const whtRate = parseAmount(meta.withholdingTaxRatePercent);
  const vatRate = 7;
  const { subtotal, vatAmount, totalAmount, withholdingAmount } = calcWithholdingTotals({
    base,
    vatRatePercent: vatRate,
    whtRatePercent: whtRate,
  });
  const notes = String(formData.get("notes") ?? "");
  const assignNumber = formData.get("assignNumber") === "1";

  const data = {
    kind,
    issueDate,
    subtotal: String(subtotal),
    vatAmount: String(vatAmount),
    totalAmount: String(totalAmount),
    withholdingAmount: String(withholdingAmount),
    notes,
    linesJson: "[]",
    metaJson: JSON.stringify(meta),
    clientId: null as string | null,
    contractorId,
  };

  try {
    if (id) {
      await updateDocument(id, data);
      revalidateDoc(kind);
      return { ok: true as const, id, number: null };
    }

    const number = assignNumber ? await nextDocumentNumber(kind, issueDate) : "";
    const created = await createDocument({ ...data, number });
    revalidateDoc(kind);
    return { ok: true as const, id: created.id, number: created.number || null };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false as const, message };
  }
}

export async function savePaymentVoucherAction(formData: FormData) {
  const kind: DocumentKind = "PAYMENT_VOUCHER";
  const id = String(formData.get("id") ?? "").trim();
  const issueDateStr = String(formData.get("issueDate") ?? "");
  const issueDate = issueDateStr ? new Date(issueDateStr) : new Date();
  const issuedByName = String(formData.get("issuedByName") ?? "").trim();
  const meta = {
    ...parseMetaJson<PaymentVoucherMeta>(
      String(formData.get("metaJson") ?? ""),
      defaultPaymentVoucherMeta(),
    ),
    issuedByName,
  };
  const totalAmount = parseAmount(String(formData.get("totalAmount") ?? "0"));
  const notes = String(formData.get("notes") ?? "");
  const assignNumber = formData.get("assignNumber") === "1";
  const postCash = formData.get("postCashbook") !== "0";

  const data = {
    kind,
    issueDate,
    subtotal: String(totalAmount),
    vatAmount: "0",
    totalAmount: String(totalAmount),
    withholdingAmount: "0",
    notes,
    linesJson: JSON.stringify([
      {
        sequence: 1,
        code: "",
        description: meta.purpose || "จ่ายเงิน",
        unitPrice: String(totalAmount),
        quantity: "1",
        amount: String(totalAmount),
      },
    ]),
    metaJson: JSON.stringify(meta),
    clientId: null as string | null,
    contractorId: null as string | null,
  };

  try {
    if (id) {
      await updateDocument(id, data);
      revalidateDoc(kind);
      return { ok: true as const, id, number: null };
    }

    const number = assignNumber ? await nextDocumentNumber(kind, issueDate) : "";
    const created = await createDocument({ ...data, number });
    if (postCash && (created.number || number)) {
      await autoPostCashFromDocument({
        documentId: created.id,
        kind,
        number: created.number || number,
        issueDate,
        totalAmount,
        description: `ใบสำคัญจ่าย — ${meta.purpose || meta.payeeName}`,
        issuedByName,
      });
    }
    revalidateDoc(kind);
    return { ok: true as const, id: created.id, number: created.number || null };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false as const, message };
  }
}

export async function assignDocumentNumber(documentId: string) {
  const doc = await getDocument(documentId);
  if (!doc) return { ok: false as const, message: "ไม่พบเอกสาร" };
  if (doc.number) return { ok: true as const, number: doc.number };
  try {
    const number = await nextDocumentNumber(doc.kind, doc.issueDate);
    await assignDocumentNumberRepo(documentId, number);
    const totalAmount = parseAmount(doc.totalAmount);
    await autoPostCashFromDocument({
      documentId,
      kind: doc.kind,
      number,
      issueDate: doc.issueDate,
      totalAmount,
      description: `${DOCUMENT_KIND_ROUTES[doc.kind].titleTh} ${number}`,
    });
    revalidateDoc(doc.kind);
    return { ok: true as const, number };
  } catch (e) {
    return { ok: false as const, message: e instanceof Error ? e.message : "ออกเลขไม่สำเร็จ" };
  }
}
