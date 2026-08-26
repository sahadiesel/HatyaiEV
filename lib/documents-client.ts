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
import { postCashbookEntryClient, syncCashbookForDocumentClient, syncCashbookDateForDocumentClient } from "@/lib/cashbook-client";
import {
  calcCommercialTotals,
  calcVehicleSaleVatTotals,
  calcWithholdingTotals,
  parseAmount,
  recalcLineAmount,
  roundMoney2,
  withholdingVatRatePercent,
} from "@/lib/documents/calc";
import { toYmdLocal } from "@/lib/format-date-th";
import {
  effectivePaymentVoucherWithholdingAmount,
} from "@/lib/documents/payment-voucher-wht";
import { listEntitiesClient } from "@/lib/entities-client";
import { loadCompanyBrandClient, openPrintHtml } from "@/lib/documents/print-client";
import {
  buildCommercialPrintHtml,
  buildPaymentVoucherPrintHtml,
  buildWithholdingPrintHtml,
  type HyevWhtCopyVariant,
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
    const all = snap.docs.map((d) => parseDocumentClient(d.id, d.data() as Record<string, unknown>));
    const whtByNumber = new Map(
      all
        .filter((r) => r.kind === "WITHHOLDING_TAX" && r.number)
        .map((r) => [r.number, r] as const),
    );
    const receiptByTaxInvoiceId = new Map<string, { id: string; number: string }>();
    for (const r of all) {
      if (r.kind !== "RECEIPT") continue;
      try {
        const m = JSON.parse(r.metaJson || "{}") as { taxInvoiceId?: string };
        if (m.taxInvoiceId && !receiptByTaxInvoiceId.has(m.taxInvoiceId)) {
          receiptByTaxInvoiceId.set(m.taxInvoiceId, {
            id: r.id,
            number: r.number || "—",
          });
        }
      } catch {
        /* ignore */
      }
    }
    let rows = kind ? all.filter((r) => r.kind === kind) : all;
    rows.sort((a, b) => b.issueDate.getTime() - a.issueDate.getTime());
    return rows.slice(0, 200).map((r) => {
      const metaName =
        r.kind === "PAYMENT_VOUCHER"
          ? parseMetaJson<PaymentVoucherMeta>(r.metaJson, defaultPaymentVoucherMeta()).payeeName
          : r.kind === "WITHHOLDING_TAX"
            ? parseMetaJson<WithholdingDocumentMeta>(r.metaJson, defaultWithholdingMeta()).payeeName
            : parseMetaJson<CommercialDocumentMeta>(r.metaJson, defaultCommercialMeta())
                .counterpartyName;
      const withholdingAmount =
        r.kind === "PAYMENT_VOUCHER"
          ? String(effectivePaymentVoucherWithholdingAmount(r, whtByNumber))
          : r.withholdingAmount;
      const linkedReceipt =
        r.kind === "TAX_INVOICE" ? receiptByTaxInvoiceId.get(r.id) : undefined;
      return {
        ...r,
        withholdingAmount,
        clientName: (r.clientId && nameById.get(r.clientId)) || metaName || null,
        contractorName: (r.contractorId && nameById.get(r.contractorId)) || null,
        receiptNumber: linkedReceipt?.number ?? null,
        receiptId: linkedReceipt?.id ?? null,
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
  vehicleId?: string | null;
  entityId?: string | null;
  vatType?: "NO_VAT" | "FULL_VAT" | "MARGIN_VAT" | null;
  taxBasisAmount?: string | number | null;
  customerVatAmount?: string | number | null;
  remittanceVatAmount?: string | number | null;
  channel?: "CASH" | "BANK";
  bankAccountId?: string | null;
  withholdingDocumentId?: string | null;
  withholdingDocumentNumber?: string | null;
  paymentVoucherDocumentId?: string | null;
  paymentVoucherDocumentNumber?: string | null;
}) {
  if (opts.totalAmount <= 0) return;
  if (opts.kind !== "RECEIPT" && opts.kind !== "PAYMENT_VOUCHER") return;
  const primary = await ensurePrimaryBankAccount();
  /** เงินสด → CASH · โอน/เช็ค/ไม่ระบุ → BANK (บัญชีหลัก) */
  const channel: "CASH" | "BANK" =
    opts.channel ?? (opts.bankAccountId ? "BANK" : "BANK");
  const bankAccountId =
    channel === "CASH"
      ? null
      : opts.bankAccountId !== undefined && opts.bankAccountId !== null
        ? opts.bankAccountId
        : primary?.id ?? null;
  const entryType =
    opts.kind === "RECEIPT" && opts.vehicleId ? "VEHICLE_SALE" : "DOCUMENT_AUTO";
  await postCashbookEntryClient({
    entryDate: toYmdLocal(opts.issueDate) || toYmdLocal(new Date()),
    direction: opts.kind === "RECEIPT" ? "IN" : "OUT",
    entryType,
    amount: opts.totalAmount,
    description: opts.description,
    documentId: opts.documentId,
    documentKind: opts.kind,
    documentNumber: opts.number,
    createdByName: opts.issuedByName,
    channel,
    bankAccountId,
    vehicleId: opts.vehicleId ?? null,
    entityId: opts.entityId ?? null,
    vatType: opts.vatType ?? null,
    taxBasisAmount: opts.taxBasisAmount ?? null,
    customerVatAmount: opts.customerVatAmount ?? null,
    remittanceVatAmount: opts.remittanceVatAmount ?? null,
    withholdingDocumentId: opts.withholdingDocumentId ?? null,
    withholdingDocumentNumber: opts.withholdingDocumentNumber ?? null,
    paymentVoucherDocumentId:
      opts.paymentVoucherDocumentId ??
      (opts.kind === "PAYMENT_VOUCHER" ? opts.documentId : null),
    paymentVoucherDocumentNumber:
      opts.paymentVoucherDocumentNumber ??
      (opts.kind === "PAYMENT_VOUCHER" ? opts.number : null),
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
  const issueYmd = toYmdLocal(input.issueDate) || toYmdLocal(issueDate);
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
    const whtAmt =
      kind === "RECEIPT" && meta.withholdingEnabled
        ? parseAmount(meta.withholdingAmount ?? "")
        : 0;
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
          withholdingAmount: String(whtAmt),
          notes: input.notes ?? "",
          linesJson: JSON.stringify(lines),
          metaJson: JSON.stringify(meta),
          clientId: input.clientId || null,
          contractorId: null,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      if (kind === "RECEIPT" || kind === "PAYMENT_VOUCHER") {
        await syncCashbookDateForDocumentClient(existingId, issueYmd);
      }
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
      withholdingAmount: String(whtAmt),
      notes: input.notes ?? "",
      linesJson: JSON.stringify(lines),
      metaJson: JSON.stringify(meta),
      clientId: input.clientId || null,
      contractorId: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    if (number) {
      const vatType =
        meta.vatScheme === "MARGIN"
          ? ("MARGIN_VAT" as const)
          : meta.vatScheme === "FULL_SALE"
            ? ("FULL_VAT" as const)
            : meta.vatScheme === "STANDARD"
              ? ("FULL_VAT" as const)
              : null;
      const invRef = meta.taxInvoiceNumber ? ` อ้างอิงใบกำกับ ${meta.taxInvoiceNumber}` : "";
      const netCash = Math.max(0, roundMoney2(totalAmount - whtAmt));
      const receiveChannel =
        kind === "RECEIPT"
          ? meta.paymentMethod === "CASH"
            ? ("CASH" as const)
            : ("BANK" as const)
          : undefined;
      const whtNote =
        whtAmt > 0
          ? ` (หัก ณ ที่จ่าย ${meta.withholdingTaxRatePercent || ""}% = ${whtAmt.toLocaleString("th-TH", { minimumFractionDigits: 2 })} · เข้าบัญชี ${netCash.toLocaleString("th-TH", { minimumFractionDigits: 2 })})`
          : "";
      await autoPostCashClient({
        documentId: id,
        kind,
        number,
        issueDate,
        totalAmount: kind === "RECEIPT" ? netCash : totalAmount,
        description:
          `${DOCUMENT_KIND_ROUTES[kind].titleTh} ${number}${invRef} — ${meta.counterpartyName || meta.vehicleLabel || ""}`.trim() +
          whtNote,
        issuedByName,
        vehicleId: meta.vehicleId || null,
        entityId: input.clientId || null,
        vatType,
        taxBasisAmount: meta.marginSnapshot ?? meta.totalCostSnapshot ?? null,
        customerVatAmount: vatAmount,
        remittanceVatAmount: vatAmount,
        channel: receiveChannel,
        bankAccountId:
          kind === "RECEIPT"
            ? meta.paymentMethod === "TRANSFER"
              ? meta.receiveBankAccountId || null
              : null
            : undefined,
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
    vatRatePercent: withholdingVatRatePercent(meta),
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
}): Promise<
  | {
      ok: true;
      id: string;
      number: string | null;
      withholdingDocumentId: string | null;
      withholdingDocumentNumber: string | null;
    }
  | { ok: false; message: string }
> {
  const db = getFirestoreDb();
  if (!db) return { ok: false, message: "ยังไม่ได้ตั้งค่า Firebase (NEXT_PUBLIC_FIREBASE_*)" };

  const kind: DocumentKind = "PAYMENT_VOUCHER";
  const issueDate = input.issueDate ? new Date(input.issueDate) : new Date();
  const issueYmd = toYmdLocal(input.issueDate) || toYmdLocal(issueDate);
  const issuedByName = (input.issuedByName ?? "").trim();
  let notes = input.notes ?? "";
  let meta = {
    ...parseMetaJson<PaymentVoucherMeta>(input.metaJson, defaultPaymentVoucherMeta()),
    issuedByName,
  };
  const totalAmount = parseAmount(input.totalAmount);

  // ใบสำคัญจ่ายเป็นต้นทาง — คำนวณหัก ณ ที่จ่ายจากยอด PV แล้วสร้าง/อัปเดตใบหักอัตโนมัติ
  const withholdingEnabled = Boolean(meta.withholdingEnabled);
  let withholdingDocumentId: string | null = meta.withholdingDocumentId?.trim() || null;
  let withholdingDocumentNumber: string | null = meta.withholdingDocumentNumber?.trim() || null;
  let withholdingAmount = 0;

  if (withholdingEnabled) {
    const base = parseAmount(meta.withholdingTaxBase ?? "") || totalAmount;
    const rate = parseAmount(meta.withholdingTaxRatePercent ?? "") || 3;
    const entities = await listEntitiesClient();
    const payee =
      entities.find((e) => e.taxId && e.taxId === meta.payeeTaxId) ||
      entities.find((e) => e.name === meta.payeeName) ||
      null;
    const whtMetaBase = {
      ...defaultWithholdingMeta(),
      payeeName: meta.payeeName,
      payeeTaxId: meta.payeeTaxId,
      payeeAddress: meta.payeeAddress,
      payeeBranchHeadOffice: payee?.branchHeadOffice !== false,
      payeeBranchNo: payee?.branchNo || "",
      payeeEntityKind:
        payee?.entityKind === "COMPANY" ? ("COMPANY" as const) : ("INDIVIDUAL" as const),
      vatRatePercent: payee?.entityKind === "COMPANY" ? "7" : "0",
      incomeTypeLabel: "ค่าจ้างทำของ / ค่าแรง",
      jobDescription: meta.purpose || "จ่ายเงิน",
      withholdingTaxRatePercent: String(rate),
      withholdingTaxBase: String(base),
      paymentDate: issueYmd,
      paymentMethod: meta.paymentMethod || "TRANSFER",
      referenceNo: meta.vehicleLabel || "",
    };
    const totals = calcWithholdingTotals({
      base,
      vatRatePercent: withholdingVatRatePercent(whtMetaBase),
      whtRatePercent: rate,
    });
    withholdingAmount =
      parseAmount(meta.withholdingAmount ?? "") > 0
        ? parseAmount(meta.withholdingAmount ?? "")
        : totals.withholdingAmount;

    // หาใบหักเดิมที่ผูกไว้ (ถ้ามี) เพื่ออัปเดตแทนสร้างซ้ำ
    let existingWhtId = withholdingDocumentId;
    if (!existingWhtId && withholdingDocumentNumber) {
      const whtRows = await listDocumentsClient("WITHHOLDING_TAX");
      existingWhtId = whtRows.find((d) => d.number === withholdingDocumentNumber)?.id ?? null;
    }

    const wht = await saveWithholdingDocumentClient({
      id: existingWhtId,
      contractorId: payee?.id ?? null,
      issueDate: issueYmd,
      metaJson: JSON.stringify({ ...whtMetaBase, issuedByName }),
      assignNumber: true,
      issuedByName,
      notes: `จากใบสำคัญจ่าย — ${meta.purpose || meta.payeeName}`,
    });
    if (!wht.ok) return wht;
    withholdingDocumentId = wht.id;
    withholdingDocumentNumber = wht.number;

    meta = {
      ...meta,
      withholdingEnabled: true,
      withholdingDocumentId: withholdingDocumentId || undefined,
      withholdingDocumentNumber: withholdingDocumentNumber || undefined,
      withholdingTaxBase: String(base),
      withholdingTaxRatePercent: String(rate),
      withholdingAmount: String(withholdingAmount),
    };
    if (withholdingDocumentNumber && !notes.includes(withholdingDocumentNumber)) {
      notes = notes.trim()
        ? `${notes.trim()}\nสร้างหัก ณ ที่จ่าย ${withholdingDocumentNumber}`
        : `สร้างหัก ณ ที่จ่าย ${withholdingDocumentNumber}`;
    }
  } else {
    meta = {
      ...meta,
      withholdingEnabled: false,
      withholdingAmount: "0",
    };
    withholdingAmount = 0;
  }

  try {
    const existingId = input.id?.trim() || "";
    const payload = {
      kind,
      issueDate,
      subtotal: String(totalAmount),
      vatAmount: "0",
      totalAmount: String(totalAmount),
      withholdingAmount: String(withholdingAmount),
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
      const channel = meta.paymentMethod === "CASH" ? ("CASH" as const) : ("BANK" as const);
      const netOut =
        withholdingAmount > 0
          ? Math.max(0, roundMoney2(totalAmount - withholdingAmount))
          : totalAmount;
      const whtNote =
        withholdingAmount > 0
          ? ` (หัก ณ ที่จ่าย ${meta.withholdingTaxRatePercent || ""}% = ${withholdingAmount.toLocaleString("th-TH", { minimumFractionDigits: 2 })} · จ่ายสุทธิ ${netOut.toLocaleString("th-TH", { minimumFractionDigits: 2 })})`
          : "";
      await syncCashbookForDocumentClient(existingId, {
        entryDate: issueYmd,
        channel,
        bankAccountId: channel === "CASH" ? null : undefined,
        amount: netOut,
        description: `ใบสำคัญจ่าย — ${meta.purpose || meta.payeeName}${whtNote}`,
        paymentVoucherDocumentId: existingId,
        paymentVoucherDocumentNumber: existing.number || null,
        withholdingDocumentId: withholdingDocumentId,
        withholdingDocumentNumber: withholdingDocumentNumber,
      });
      return {
        ok: true,
        id: existingId,
        number: existing.number || null,
        withholdingDocumentId,
        withholdingDocumentNumber,
      };
    }

    const id = newId();
    const number = input.assignNumber ? await nextDocumentNumberClient(kind, issueDate) : "";
    await setDoc(doc(db, firestoreCollections.documents, id), {
      ...payload,
      number,
      createdAt: serverTimestamp(),
    });
    if (input.postCashbook !== false && number) {
      const channel = meta.paymentMethod === "CASH" ? ("CASH" as const) : ("BANK" as const);
      const netOut =
        withholdingAmount > 0
          ? Math.max(0, roundMoney2(totalAmount - withholdingAmount))
          : totalAmount;
      const whtNote =
        withholdingAmount > 0
          ? ` (หัก ณ ที่จ่าย ${meta.withholdingTaxRatePercent || ""}% = ${withholdingAmount.toLocaleString("th-TH", { minimumFractionDigits: 2 })} · จ่ายสุทธิ ${netOut.toLocaleString("th-TH", { minimumFractionDigits: 2 })})`
          : "";
      await autoPostCashClient({
        documentId: id,
        kind,
        number,
        issueDate,
        totalAmount: netOut,
        description: `ใบสำคัญจ่าย — ${meta.purpose || meta.payeeName}${whtNote}`,
        issuedByName,
        channel,
        bankAccountId: channel === "BANK" ? undefined : null,
        paymentVoucherDocumentId: id,
        paymentVoucherDocumentNumber: number,
        withholdingDocumentId,
        withholdingDocumentNumber,
      });
    }
    return {
      ok: true,
      id,
      number: number || null,
      withholdingDocumentId,
      withholdingDocumentNumber,
    };
  } catch (e) {
    console.error("[savePaymentVoucherClient]", e);
    return { ok: false, message: e instanceof Error ? e.message : "บันทึกไม่สำเร็จ" };
  }
}

export async function printDocumentClient(
  documentId: string,
  issuedByName?: string,
  printAssets?: {
    includeSignature?: boolean;
    includeStamp?: boolean;
    preview?: boolean;
    whtCopies?: HyevWhtCopyVariant[];
  },
): Promise<{ ok: true } | { ok: false; message: string }> {
  const docRow = await getDocumentClient(documentId);
  if (!docRow) return { ok: false, message: "ไม่พบเอกสาร" };
  const company = await loadCompanyBrandClient();
  const subtotal = Number(docRow.subtotal);
  const vatAmount = Number(docRow.vatAmount);
  const totalAmount = Number(docRow.totalAmount);
  const withholdingAmount = Number(docRow.withholdingAmount);
  const assets = {
    includeSignature: printAssets?.includeSignature !== false,
    includeStamp: printAssets?.includeStamp !== false,
  };

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
      copies: printAssets?.whtCopies,
      ...assets,
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
      ...assets,
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
      ...assets,
    });
  }
  if (printAssets?.preview) {
    html = html.replace(
      /<script>window\.onload=function\(\)\{window\.print\(\);\}<\/script>/g,
      `<div class="no-print" style="padding:8px;background:#f1f5f9;text-align:center;font-family:Sarabun,sans-serif;font-size:14px">
  <button type="button" onclick="window.print()" style="padding:6px 14px;cursor:pointer">พิมพ์ / บันทึก PDF</button>
</div>`,
    );
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
    const meta = parseMetaJson<CommercialDocumentMeta>(
      existing.metaJson,
      defaultCommercialMeta(),
    );
    const invRef = meta.taxInvoiceNumber ? ` อ้างอิงใบกำกับ ${meta.taxInvoiceNumber}` : "";
    const totalAmount = parseAmount(existing.totalAmount);
    const whtAmt =
      existing.kind === "RECEIPT" && meta.withholdingEnabled
        ? parseAmount(meta.withholdingAmount ?? existing.withholdingAmount)
        : 0;
    const netCash =
      existing.kind === "RECEIPT"
        ? Math.max(0, roundMoney2(totalAmount - whtAmt))
        : totalAmount;
    const receiveChannel =
      existing.kind === "RECEIPT"
        ? meta.paymentMethod === "CASH"
          ? ("CASH" as const)
          : ("BANK" as const)
        : undefined;
    const whtNote =
      whtAmt > 0
        ? ` (หัก ณ ที่จ่าย ${meta.withholdingTaxRatePercent || ""}% = ${whtAmt.toLocaleString("th-TH", { minimumFractionDigits: 2 })} · เข้าบัญชี ${netCash.toLocaleString("th-TH", { minimumFractionDigits: 2 })})`
        : "";
    await autoPostCashClient({
      documentId,
      kind: existing.kind,
      number,
      issueDate: existing.issueDate,
      totalAmount: netCash,
      description: `${DOCUMENT_KIND_ROUTES[existing.kind].titleTh} ${number}${invRef}${whtNote}`,
      vehicleId: meta.vehicleId || null,
      entityId: existing.clientId,
      vatType:
        meta.vatScheme === "MARGIN"
          ? "MARGIN_VAT"
          : meta.vatScheme === "FULL_SALE" || meta.vatScheme === "STANDARD"
            ? "FULL_VAT"
            : null,
      channel: receiveChannel,
      bankAccountId:
        existing.kind === "RECEIPT"
          ? meta.paymentMethod === "TRANSFER"
            ? meta.receiveBankAccountId || null
            : null
          : undefined,
    });
    return { ok: true, number };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "ออกเลขไม่สำเร็จ" };
  }
}
