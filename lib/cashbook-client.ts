"use client";

import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import type {
  BankAccountRecord,
  CashbookEntry,
  CashChannel,
  CashDirection,
  CashbookEntryType,
  CashVatType,
} from "@/lib/domain-types";
import { parseAmount, roundMoney2 } from "@/lib/documents/calc";
import { getFirestoreDb } from "@/lib/firebase";
import { firestoreCollections } from "@/lib/firestore-collections";
import {
  ensurePrimaryBankAccount,
  listBankAccountsClient,
} from "@/lib/bank-accounts-client";

function newId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, "").slice(0, 25);
  }
  return `c${Date.now().toString(36)}`;
}

/** แปลงวันที่จาก Firestore / string ให้เป็น YYYY-MM-DD */
function normalizeEntryDate(raw: unknown): string {
  if (!raw) return "";
  if (typeof raw === "string") {
    const s = raw.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    // DD/MM/YYYY หรือ DD-MM-YYYY
    const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
    if (m) {
      return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    }
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    return s.slice(0, 10);
  }
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return raw.toISOString().slice(0, 10);
  }
  if (typeof raw === "object" && raw !== null && "toDate" in raw) {
    try {
      const d = (raw as { toDate: () => Date }).toDate();
      if (d instanceof Date && !Number.isNaN(d.getTime())) {
        return d.toISOString().slice(0, 10);
      }
    } catch {
      /* ignore */
    }
  }
  if (typeof raw === "object" && raw !== null && "seconds" in raw) {
    const sec = Number((raw as { seconds: number }).seconds);
    if (Number.isFinite(sec)) return new Date(sec * 1000).toISOString().slice(0, 10);
  }
  return String(raw).slice(0, 10);
}

export function parseCashbookEntryClient(id: string, d: Record<string, unknown>): CashbookEntry {
  const channel: CashChannel =
    d.channel === "BANK" || d.bankAccountId ? "BANK" : "CASH";
  return {
    id,
    entryNo: String(d.entryNo ?? ""),
    entryDate: normalizeEntryDate(d.entryDate),
    direction: (d.direction as CashDirection) || "OUT",
    entryType: (d.entryType as CashbookEntryType) || "MANUAL",
    amount: String(d.amount ?? "0"),
    description: String(d.description ?? ""),
    documentId: d.documentId ? String(d.documentId) : null,
    documentKind: d.documentKind ? String(d.documentKind) : null,
    documentNumber: d.documentNumber ? String(d.documentNumber) : null,
    withholdingDocumentId: d.withholdingDocumentId ? String(d.withholdingDocumentId) : null,
    withholdingDocumentNumber: d.withholdingDocumentNumber
      ? String(d.withholdingDocumentNumber)
      : null,
    paymentVoucherDocumentId: d.paymentVoucherDocumentId
      ? String(d.paymentVoucherDocumentId)
      : null,
    paymentVoucherDocumentNumber: d.paymentVoucherDocumentNumber
      ? String(d.paymentVoucherDocumentNumber)
      : null,
    billNo: d.billNo ? String(d.billNo) : null,
    vehicleId: d.vehicleId ? String(d.vehicleId) : null,
    entityId: d.entityId ? String(d.entityId) : null,
    channel,
    bankAccountId: d.bankAccountId ? String(d.bankAccountId) : null,
    taxBasisAmount: d.taxBasisAmount != null ? String(d.taxBasisAmount) : null,
    vatType: (d.vatType as CashVatType) || null,
    customerVatAmount: d.customerVatAmount != null ? String(d.customerVatAmount) : null,
    remittanceVatAmount: d.remittanceVatAmount != null ? String(d.remittanceVatAmount) : null,
    createdByName: String(d.createdByName ?? ""),
    createdAt: String(d.createdAt ?? ""),
  };
}

export async function listCashbookEntriesClient(limit = 300): Promise<CashbookEntry[]> {
  const db = getFirestoreDb();
  if (!db) return [];
  try {
    const snap = await getDocs(collection(db, firestoreCollections.cashbookEntries));
    return snap.docs
      .map((d) => parseCashbookEntryClient(d.id, d.data() as Record<string, unknown>))
      .sort((a, b) => b.entryDate.localeCompare(a.entryDate) || b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  } catch (e) {
    console.error("[listCashbookEntriesClient]", e);
    return [];
  }
}

export type PostCashbookClientInput = {
  entryDate?: string;
  direction: CashDirection;
  entryType: CashbookEntryType;
  amount: string | number;
  description: string;
  channel?: CashChannel;
  bankAccountId?: string | null;
  vatType?: CashVatType | null;
  taxBasisAmount?: string | number | null;
  customerVatAmount?: string | number | null;
  remittanceVatAmount?: string | number | null;
  vehicleId?: string | null;
  entityId?: string | null;
  documentId?: string | null;
  documentKind?: string | null;
  documentNumber?: string | null;
  withholdingDocumentId?: string | null;
  withholdingDocumentNumber?: string | null;
  paymentVoucherDocumentId?: string | null;
  paymentVoucherDocumentNumber?: string | null;
  billNo?: string | null;
  createdByName?: string;
};

export async function postCashbookEntryClient(
  input: PostCashbookClientInput,
): Promise<{ ok: true; id: string; entryNo: string } | { ok: false; message: string }> {
  const db = getFirestoreDb();
  if (!db) return { ok: false, message: "ยังไม่ได้ตั้งค่า Firebase" };
  const amount = roundMoney2(parseAmount(input.amount));
  if (amount <= 0) return { ok: false, message: "จำนวนเงินต้องมากกว่า 0" };

  try {
    const existing = await listCashbookEntriesClient(500);
    if (input.documentId) {
      const dup = existing.find((e) => e.documentId === input.documentId);
      if (dup) return { ok: true, id: dup.id, entryNo: dup.entryNo };
    }

    const entryDate = input.entryDate || new Date().toISOString().slice(0, 10);
    const ymd = entryDate.replace(/-/g, "").slice(0, 8);
    const prefix = `CB-${ymd}-`;
    let max = 0;
    for (const r of existing) {
      if (!r.entryNo.startsWith(prefix)) continue;
      const n = parseInt(r.entryNo.slice(prefix.length), 10);
      if (Number.isFinite(n) && n > max) max = n;
    }
    const entryNo = `${prefix}${String(max + 1).padStart(3, "0")}`;
    const id = newId();
    const channel: CashChannel =
      input.channel ?? (input.bankAccountId ? "BANK" : "CASH");

    const row: CashbookEntry = {
      id,
      entryNo,
      entryDate,
      direction: input.direction,
      entryType: input.entryType,
      amount: amount.toFixed(2),
      description: input.description.trim() || "รายการเงินสด",
      documentId: input.documentId ?? null,
      documentKind: input.documentKind ?? null,
      documentNumber: input.documentNumber ?? null,
      withholdingDocumentId: input.withholdingDocumentId ?? null,
      withholdingDocumentNumber: input.withholdingDocumentNumber ?? null,
      paymentVoucherDocumentId: input.paymentVoucherDocumentId ?? null,
      paymentVoucherDocumentNumber: input.paymentVoucherDocumentNumber ?? null,
      billNo: input.billNo?.trim() ? String(input.billNo).trim() : null,
      vehicleId: input.vehicleId ?? null,
      entityId: input.entityId ?? null,
      channel,
      bankAccountId: channel === "BANK" ? (input.bankAccountId ?? null) : null,
      taxBasisAmount:
        input.taxBasisAmount != null && input.taxBasisAmount !== ""
          ? roundMoney2(parseAmount(input.taxBasisAmount)).toFixed(2)
          : null,
      vatType: input.vatType ?? null,
      customerVatAmount:
        input.customerVatAmount != null && input.customerVatAmount !== ""
          ? roundMoney2(parseAmount(input.customerVatAmount)).toFixed(2)
          : null,
      remittanceVatAmount:
        input.remittanceVatAmount != null && input.remittanceVatAmount !== ""
          ? roundMoney2(parseAmount(input.remittanceVatAmount)).toFixed(2)
          : null,
      createdByName: input.createdByName ?? "",
      createdAt: new Date().toISOString(),
    };

    await setDoc(doc(db, firestoreCollections.cashbookEntries, id), {
      ...row,
      createdAtMs: Date.now(),
      updatedAt: serverTimestamp(),
    });
    return { ok: true, id, entryNo };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

export async function deleteCashbookEntryClient(id: string) {
  const db = getFirestoreDb();
  if (!db) return { ok: false as const, message: "ยังไม่ได้ตั้งค่า Firebase" };
  try {
    await deleteDoc(doc(db, firestoreCollections.cashbookEntries, id));
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, message: e instanceof Error ? e.message : String(e) };
  }
}

export function calcBalancesFromEntries(
  entries: CashbookEntry[],
  banks: BankAccountRecord[],
  cashOpening = 0,
) {
  let totalIn = 0;
  let totalOut = 0;
  let cashIn = 0;
  let cashOut = 0;
  const bankNet: Record<string, number> = {};
  for (const b of banks) bankNet[b.id] = parseAmount(b.openingBalance);

  const primary =
    banks.find((b) => b.isPrimary) ||
    banks.find((b) => b.accountNumber.includes("215")) ||
    banks[0];

  for (const e of entries) {
    const amt = parseAmount(e.amount);
    if (e.direction === "IN") totalIn += amt;
    else totalOut += amt;

    if (e.channel === "BANK") {
      // ถ้า id หาย/ไม่ตรงบัญชีหลัก ให้ลงที่ยอดบัญชีหลัก
      let bankId = e.bankAccountId;
      if (!bankId || !(banks.some((b) => b.id === bankId) || bankId in bankNet)) {
        bankId = primary?.id ?? bankId;
      }
      if (bankId) {
        if (!(bankId in bankNet)) bankNet[bankId] = 0;
        bankNet[bankId] += e.direction === "IN" ? amt : -amt;
      } else if (e.direction === "IN") {
        cashIn += amt;
      } else {
        cashOut += amt;
      }
    } else {
      if (e.direction === "IN") cashIn += amt;
      else cashOut += amt;
    }
  }

  for (const k of Object.keys(bankNet)) bankNet[k] = roundMoney2(bankNet[k]);
  return {
    totalIn: roundMoney2(totalIn),
    totalOut: roundMoney2(totalOut),
    balance: roundMoney2(cashOpening + totalIn - totalOut),
    cashBalance: roundMoney2(cashOpening + cashIn - cashOut),
    bankBalances: bankNet,
  };
}

export async function loadCashbookDashboard() {
  const [entries, primary] = await Promise.all([
    listCashbookEntriesClient(),
    ensurePrimaryBankAccount(),
  ]);
  const banks = await listBankAccountsClient();
  const balances = calcBalancesFromEntries(entries, banks, 0);
  return { entries, banks, primary, ...balances };
}
