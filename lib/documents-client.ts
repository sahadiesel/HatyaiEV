"use client";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Timestamp,
} from "firebase/firestore";
import { ensurePrimaryBankAccount } from "@/lib/bank-accounts-client";
import { postCashbookEntryClient } from "@/lib/cashbook-client";
import {
  calcCommercialTotals,
  calcVehicleSaleVatTotals,
  calcWithholdingTotals,
  parseAmount,
  recalcLineAmount,
} from "@/lib/documents/calc";
import { loadCompanyBrandClient, openPrintHtml } from "@/lib/documents/print-client";
import {
  buildCommercialPrintHtml,
  buildPaymentVoucherPrintHtml,
  buildWithholdingPrintHtml,
} from "@/lib/documents/print-html";
import {
  defaultCommercialMeta,
  defaultPaymentVoucherMeta,
  defaultWithholdingMeta,
  DOCUMENT_KIND_ROUTES,
  parseLinesJson,
  parseMetaJson,
  type CommercialDocumentMeta,
  type DocumentLineItem,
  type PaymentVoucherMeta,
  type WithholdingDocumentMeta,
} from "@/lib/documents/types";
import type {
  DocumentKind,
  DocumentListItem,
  DocumentRecord,
} from "@/lib/documents-firestore-types";
import { listEntitiesClient } from "@/lib/entities-client";
import { getFirestoreDb } from "@/lib/firebase";
import { firestoreCollections } from "@/lib/firestore-collections";

function newId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, "").slice(0, 25);
  }
  return `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function toDate(v: unknown): Date {
  if (v instanceof Date) return v;
  if (v && typeof v === "object" && "toDate" in v && typeof (v as Timestamp).toDate === "function") {
    return (v as Timestamp).toDate();
  }
  if (typeof v === "string" || typeof v === "number") return new Date(v);
  return new Date();
}

export function parseDocumentClient(id: string, d: Record<string, unknown>): DocumentRecord {
  return {
    id,
    kind: String(d.kind ?? "INVOICE") as DocumentKind,
    number: String(d.number ?? ""),
    issueDate: toDate(d.issueDate),
    subtotal: String(d.subtotal ?? "0"),
    vatAmount: String(d.vatAmount ?? "0"),
    totalAmount: String(d.totalAmount ?? "0"),
    withholdingAmount: String(d.withholdingAmount ?? "0"),
    notes: String(d.notes ?? ""),
    linesJson: String(d.linesJson ?? "[]"),
    metaJson: String(d.metaJson ?? "{}"),
    clientId: d.clientId ? String(d.clientId) : null,
    contractorId: d.contractorId ? String(d.contractorId) : null,
  };
}

export async function listDocumentsClient(kind?: DocumentKind): Promise<DocumentListItem[]> {
  const db = getFirestoreDb();
  if (!db) return [];
  try {
    const [snap, entities] = await Promise.all([
      getDocs(collection(db, firestoreCollections.documents)),
      listEntitiesClient(),
    ]);
    const nameById = new Map(entities.map((e) => [e.id, e.name]));
    let rows = snap.docs.map((d) => parseDocumentClient(d.id, d.data() as Record<string, unknown>));
    if (kind) rows = rows.filter((r) => r.kind === kind);
    rows.sort((a, b) => b.issueDate.getTime() - a.issueDate.getTime());
    return rows.slice(0, 200).map((r) => {
      const metaName =
        r.kind === "PAYMENT_VOUCHER"
          ? parseMetaJson<PaymentVoucherMeta>(r.metaJson, defaultPaymentVoucherMeta()).payeeName
          : r.kind === "WITHHOLDING_TAX"
            ? parseMetaJson<WithholdingDocumentMeta>(r.metaJson, defaultWithholdingMeta()).payeeName
            : parseMetaJson<CommercialDocumentMeta>(r.metaJson, defaultCommercialMeta())
                .counterpartyName;
      return {
        ...r,
        clientName: (r.clientId && nameById.get(r.clientId)) || metaName || null,
        contractorName: (r.contractorId && nameById.get(r.contractorId)) || null,
      };
    });
  } catch (e) {
    console.error("[listDocumentsClient]", e);
    return [];
  }
}

export async function getDocumentClient(id: string): Promise<DocumentRecord | null> {
  const db = getFirestoreDb();
  if (!db) return null;
  try {
    const snap = await getDoc(doc(db, firestoreCollections.documents, id));
    if (!snap.exists()) return null;
    return parseDocumentClient(snap.id, snap.data() as Record<string, unknown>);
  } catch (e) {
    console.error("[getDocumentClient]", e);
    return null;
  }
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function nextDocumentNumberClient(kind: DocumentKind, now: Date): Promise<string> {
  const brand = await loadCompanyBrandClient();
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
  const rows = await listDocumentsClient(kind);
  let max = 0;
  for (const r of rows) {
    const m = r.number.match(re);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${head}${String(max + 1).padStart(3, "0")}`;
}

async function autoPostCashClient(opts: {
  documentId: string;
  kind: DocumentKind;
  number: string;
  issueDate: Date;
  totalAmount: number;
  description: string;
  issuedByName?: string;
}) {
  if (opts.totalAmount <= 0) return;
  if (opts.kind !== "RECEIPT" && opts.kind !== "PAYMENT_VOUCHER") return;
  const primary = await ensurePrimaryBankAccount();
  await postCashbookEntryClient({
    entryDate: opts.issueDate.toISOString().slice(0, 10),
    direction: opts.kind === "RECEIPT" ? "IN" : "OUT",
    entryType: "DOCUMENT_AUTO",
    amount: opts.totalAmount,
    description: opts.description,
    documentId: opts.documentId,
    documentKind: opts.kind,
    documentNumber: opts.number,
    createdByName: opts.issuedByName,
    channel: "BANK",
    bankAccountId: primary?.id ?? null,
  });
}

function parseLines(raw: string): DocumentLineItem[] {
  try {
    const arr = JSON.parse(raw) as DocumentLineItem[];
    if (!Array.isArray(arr)) return [];
    return arr.map((l, i) => recalcLineAmount({ ...l, sequence: i + 1 }));
  } catch {
    return [];
  }
}

export type SaveCommercialClientInput = {
  id?: string | null;
  kind: DocumentKind;
  clientId?: string | null;
  issueDate: string;
  notes?: string;
  linesJson: string;
  metaJson: string;
  assignNumber?: boolean;
  issuedByName?: string;
};

export async function saveCommercialDocumentClient(
  input: SaveCommercialClientInput,
): Promise<{ ok: true; id: string; number: string | null } | { ok: false; message: string }> {
  const db = getFirestoreDb();
  if (!db) return { ok: false, message: "ยังไม่ได้ตั้งค่า Firebase (NEXT_PUBLIC_FIREBASE_*)" };

  const kind = input.kind;
  if (!["INVOICE", "TAX_INVOICE", "RECEIPT"].includes(kind)) {
    return { ok: false, message: "ประเภทเอกสารไม่ถูกต้อง" };
  }

  const issueDate = input.issueDate ? new Date(input.issueDate) : new Date();
  const lines = parseLines(input.linesJson);
  const issuedByName = (input.issuedByName ?? "").trim();
  const meta = {
    ...parseMetaJson<CommercialDocumentMeta>(input.metaJson, defaultCommercialMeta()),
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

  try {
    const existingId = input.id?.trim() || "";
    if (existingId) {
      const existing = await getDocumentClient(existingId);
      if (!existing) return { ok: false, message: "ไม่พบเอกสาร" };
      await setDoc(
        doc(db, firestoreCollections.documents, existingId),
        {
          kind,
          number: existing.number,
          issueDate,
          subtotal: String(subtotal),
          vatAmount: String(vatAmount),
          totalAmount: String(totalAmount),
          withholdingAmount: "0",
          notes: input.notes ?? "",
          linesJson: JSON.stringify(lines),
          metaJson: JSON.stringify(meta),
          clientId: input.clientId || null,
          contractorId: null,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      return { ok: true, id: existingId, number: existing.number || null };
    }

    const id = newId();
    const number = input.assignNumber ? await nextDocumentNumberClient(kind, issueDate) : "";
    await setDoc(doc(db, firestoreCollections.documents, id), {
      kind,
      number,
      issueDate,
      subtotal: String(subtotal),
      vatAmount: String(vatAmount),
      totalAmount: String(totalAmount),
      withholdingAmount: "0",
      notes: input.notes ?? "",
      linesJson: JSON.stringify(lines),
      metaJson: JSON.stringify(meta),
      clientId: input.clientId || null,
      contractorId: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    if (number) {
      await autoPostCashClient({
        documentId: id,
        kind,
        number,
        issueDate,
        totalAmount,
        description: `${DOCUMENT_KIND_ROUTES[kind].titleTh} ${number} — ${meta.counterpartyName}`,
        issuedByName,
      });
    }
    return { ok: true, id, number: number || null };
  } catch (e) {
    console.error("[saveCommercialDocumentClient]", e);
    const message = e instanceof Error ? e.message : "บันทึกไม่สำเร็จ";
    return { ok: false, message };
  }
}

export async function saveWithholdingDocumentClient(input: {
  id?: string | null;
  contractorId?: string | null;
  issueDate: string;
  notes?: string;
  metaJson: string;
  assignNumber?: boolean;
  issuedByName?: string;
}): Promise<{ ok: true; id: string; number: string | null } | { ok: false; message: string }> {
  const db = getFirestoreDb();
  if (!db) return { ok: false, message: "ยังไม่ได้ตั้งค่า Firebase (NEXT_PUBLIC_FIREBASE_*)" };

  const kind: DocumentKind = "WITHHOLDING_TAX";
  const issueDate = input.issueDate ? new Date(input.issueDate) : new Date();
  const issuedByName = (input.issuedByName ?? "").trim();
  const meta = {
    ...parseMetaJson<WithholdingDocumentMeta>(input.metaJson, defaultWithholdingMeta()),
    issuedByName,
  };
  const base = parseAmount(meta.withholdingTaxBase);
  const whtRate = parseAmount(meta.withholdingTaxRatePercent);
  const { subtotal, vatAmount, totalAmount, withholdingAmount } = calcWithholdingTotals({
    base,
    vatRatePercent: 7,
    whtRatePercent: whtRate,
  });

  try {
    const existingId = input.id?.trim() || "";
    if (existingId) {
      const existing = await getDocumentClient(existingId);
      if (!existing) return { ok: false, message: "ไม่พบเอกสาร" };
      await setDoc(
        doc(db, firestoreCollections.documents, existingId),
        {
          kind,
          number: existing.number,
          issueDate,
          subtotal: String(subtotal),
          vatAmount: String(vatAmount),
          totalAmount: String(totalAmount),
          withholdingAmount: String(withholdingAmount),
          notes: input.notes ?? "",
          linesJson: "[]",
          metaJson: JSON.stringify(meta),
          clientId: null,
          contractorId: input.contractorId || null,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      return { ok: true, id: existingId, number: existing.number || null };
    }

    const id = newId();
    const number = input.assignNumber ? await nextDocumentNumberClient(kind, issueDate) : "";
    await setDoc(doc(db, firestoreCollections.documents, id), {
      kind,
      number,
      issueDate,
      subtotal: String(subtotal),
      vatAmount: String(vatAmount),
      totalAmount: String(totalAmount),
      withholdingAmount: String(withholdingAmount),
      notes: input.notes ?? "",
      linesJson: "[]",
      metaJson: JSON.stringify(meta),
      clientId: null,
      contractorId: input.contractorId || null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { ok: true, id, number: number || null };
  } catch (e) {
    console.error("[saveWithholdingDocumentClient]", e);
    return { ok: false, message: e instanceof Error ? e.message : "บันทึกไม่สำเร็จ" };
  }
}

export async function savePaymentVoucherClient(input: {
  id?: string | null;
  issueDate: string;
  totalAmount: string | number;
  notes?: string;
  metaJson: string;
  assignNumber?: boolean;
  issuedByName?: string;
  postCashbook?: boolean;
}): Promise<{ ok: true; id: string; number: string | null } | { ok: false; message: string }> {
  const db = getFirestoreDb();
  if (!db) return { ok: false, message: "ยังไม่ได้ตั้งค่า Firebase (NEXT_PUBLIC_FIREBASE_*)" };

  const kind: DocumentKind = "PAYMENT_VOUCHER";
  const issueDate = input.issueDate ? new Date(input.issueDate) : new Date();
  const issuedByName = (input.issuedByName ?? "").trim();
  const meta = {
    ...parseMetaJson<PaymentVoucherMeta>(input.metaJson, defaultPaymentVoucherMeta()),
    issuedByName,
  };
  const totalAmount = parseAmount(input.totalAmount);

  try {
    const existingId = input.id?.trim() || "";
    const payload = {
      kind,
      issueDate,
      subtotal: String(totalAmount),
      vatAmount: "0",
      totalAmount: String(totalAmount),
      withholdingAmount: "0",
      notes: input.notes ?? "",
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
      clientId: null,
      contractorId: null,
      updatedAt: serverTimestamp(),
    };

    if (existingId) {
      const existing = await getDocumentClient(existingId);
      if (!existing) return { ok: false, message: "ไม่พบเอกสาร" };
      await setDoc(
        doc(db, firestoreCollections.documents, existingId),
        { ...payload, number: existing.number },
        { merge: true },
      );
      return { ok: true, id: existingId, number: existing.number || null };
    }

    const id = newId();
    const number = input.assignNumber ? await nextDocumentNumberClient(kind, issueDate) : "";
    await setDoc(doc(db, firestoreCollections.documents, id), {
      ...payload,
      number,
      createdAt: serverTimestamp(),
    });
    if (input.postCashbook !== false && number) {
      await autoPostCashClient({
        documentId: id,
        kind,
        number,
        issueDate,
        totalAmount,
        description: `ใบสำคัญจ่าย — ${meta.purpose || meta.payeeName}`,
        issuedByName,
      });
    }
    return { ok: true, id, number: number || null };
  } catch (e) {
    console.error("[savePaymentVoucherClient]", e);
    return { ok: false, message: e instanceof Error ? e.message : "บันทึกไม่สำเร็จ" };
  }
}

export async function printDocumentClient(
  documentId: string,
  issuedByName?: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const docRow = await getDocumentClient(documentId);
  if (!docRow) return { ok: false, message: "ไม่พบเอกสาร" };
  const company = await loadCompanyBrandClient();
  const subtotal = Number(docRow.subtotal);
  const vatAmount = Number(docRow.vatAmount);
  const totalAmount = Number(docRow.totalAmount);
  const withholdingAmount = Number(docRow.withholdingAmount);

  let html: string;
  if (docRow.kind === "WITHHOLDING_TAX") {
    const meta = parseMetaJson<WithholdingDocumentMeta>(docRow.metaJson, defaultWithholdingMeta());
    html = buildWithholdingPrintHtml({
      company,
      number: docRow.number,
      issueDate: docRow.issueDate,
      meta,
      subtotal,
      vatAmount,
      totalAmount,
      withholdingAmount,
      issuedByName: issuedByName || meta.issuedByName,
    });
  } else if (docRow.kind === "PAYMENT_VOUCHER") {
    const meta = parseMetaJson<PaymentVoucherMeta>(docRow.metaJson, defaultPaymentVoucherMeta());
    html = buildPaymentVoucherPrintHtml({
      company,
      number: docRow.number,
      issueDate: docRow.issueDate,
      meta,
      totalAmount,
      notes: docRow.notes,
      issuedByName: issuedByName || meta.issuedByName,
    });
  } else {
    const lines = parseLinesJson(docRow.linesJson);
    const meta = parseMetaJson<CommercialDocumentMeta>(docRow.metaJson, defaultCommercialMeta());
    html = buildCommercialPrintHtml({
      kind: docRow.kind,
      company,
      number: docRow.number,
      issueDate: docRow.issueDate,
      lines,
      meta,
      subtotal,
      vatAmount,
      totalAmount,
      notes: docRow.notes,
      issuedByName: issuedByName || meta.issuedByName,
    });
  }
  openPrintHtml(html);
  return { ok: true };
}

/** สำหรับหน้าแก้ไข — แปลง DocumentRecord เป็น initial ของฟอร์ม */
export function toCommercialFormInitial(docRow: DocumentRecord) {
  return {
    id: docRow.id,
    number: docRow.number,
    issueDate: docRow.issueDate.toISOString().slice(0, 10),
    clientId: docRow.clientId,
    lines: parseLinesJson(docRow.linesJson),
    meta: parseMetaJson<CommercialDocumentMeta>(docRow.metaJson, defaultCommercialMeta()),
    notes: docRow.notes,
  };
}

export async function assignDocumentNumberClient(
  documentId: string,
): Promise<{ ok: true; number: string } | { ok: false; message: string }> {
  const db = getFirestoreDb();
  if (!db) return { ok: false, message: "ยังไม่ได้ตั้งค่า Firebase" };
  const existing = await getDocumentClient(documentId);
  if (!existing) return { ok: false, message: "ไม่พบเอกสาร" };
  if (existing.number) return { ok: true, number: existing.number };
  try {
    const number = await nextDocumentNumberClient(existing.kind, existing.issueDate);
    await updateDoc(doc(db, firestoreCollections.documents, documentId), {
      number,
      updatedAt: serverTimestamp(),
    });
    await autoPostCashClient({
      documentId,
      kind: existing.kind,
      number,
      issueDate: existing.issueDate,
      totalAmount: parseAmount(existing.totalAmount),
      description: `${DOCUMENT_KIND_ROUTES[existing.kind].titleTh} ${number}`,
    });
    return { ok: true, number };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "ออกเลขไม่สำเร็จ" };
  }
}
