"use client";

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
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
import { toYmdLocal } from "@/lib/format-date-th";
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
  const channelRaw = String(d.channel ?? "").toUpperCase();
  const channel: CashChannel =
    channelRaw === "BANK" ? "BANK" : channelRaw === "CASH" ? "CASH" : d.bankAccountId ? "BANK" : "CASH";
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

    const entryDate = toYmdLocal(input.entryDate) || toYmdLocal(new Date());
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
    const bankAccountId =
      input.bankAccountId && String(input.bankAccountId).trim()
        ? String(input.bankAccountId).trim()
        : null;

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
      bankAccountId,
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

/** อัปเดตรายการสมุดเงินสดที่ผูกกับเอกสาร (วันที่ + ช่องทาง + ยอด + ลิงก์เอกสาร) */
export async function syncCashbookForDocumentClient(
  documentId: string,
  patch: {
    entryDate?: string;
    channel?: CashChannel;
    bankAccountId?: string | null;
    amount?: string | number;
    description?: string;
    withholdingDocumentId?: string | null;
    withholdingDocumentNumber?: string | null;
    paymentVoucherDocumentId?: string | null;
    paymentVoucherDocumentNumber?: string | null;
  },
): Promise<{ ok: true; updated: number } | { ok: false; message: string }> {
  const db = getFirestoreDb();
  if (!db) return { ok: false, message: "ยังไม่ได้ตั้งค่า Firebase" };
  if (!documentId) return { ok: false, message: "เอกสารไม่ถูกต้อง" };
  try {
    const entries = await listCashbookEntriesClient(500);
    const linked = entries.filter(
      (e) =>
        e.documentId === documentId ||
        e.paymentVoucherDocumentId === documentId,
    );
    if (linked.length === 0) return { ok: true, updated: 0 };

    let bankAccountId = patch.bankAccountId;
    if (patch.channel === "BANK" && (bankAccountId === undefined || bankAccountId === null)) {
      const primary = await ensurePrimaryBankAccount();
      bankAccountId = primary?.id ?? null;
    }
    if (patch.channel === "CASH" && bankAccountId === undefined) {
      bankAccountId = null;
    }

    const ymd = patch.entryDate ? toYmdLocal(patch.entryDate) : null;
    const amountStr =
      patch.amount !== undefined ? String(roundMoney2(parseAmount(patch.amount))) : undefined;

    await Promise.all(
      linked.map((e) => {
        const data: Record<string, unknown> = { updatedAt: serverTimestamp() };
        if (ymd) data.entryDate = ymd;
        if (patch.channel) {
          data.channel = patch.channel;
          data.bankAccountId = bankAccountId ?? null;
        }
        if (amountStr !== undefined) data.amount = amountStr;
        if (patch.description !== undefined) data.description = patch.description;
        if (patch.withholdingDocumentId !== undefined) {
          data.withholdingDocumentId = patch.withholdingDocumentId;
        }
        if (patch.withholdingDocumentNumber !== undefined) {
          data.withholdingDocumentNumber = patch.withholdingDocumentNumber;
        }
        if (patch.paymentVoucherDocumentId !== undefined) {
          data.paymentVoucherDocumentId = patch.paymentVoucherDocumentId;
        }
        if (patch.paymentVoucherDocumentNumber !== undefined) {
          data.paymentVoucherDocumentNumber = patch.paymentVoucherDocumentNumber;
        }
        return updateDoc(doc(db, firestoreCollections.cashbookEntries, e.id), data);
      }),
    );
    return { ok: true, updated: linked.length };
  } catch (e) {
    console.error("[syncCashbookForDocumentClient]", e);
    return { ok: false, message: e instanceof Error ? e.message : "อัปเดตสมุดเงินสดไม่สำเร็จ" };
  }
}

/** @deprecated ใช้ syncCashbookForDocumentClient */
export async function syncCashbookDateForDocumentClient(
  documentId: string,
  entryDate: string,
): Promise<{ ok: true; updated: number } | { ok: false; message: string }> {
  return syncCashbookForDocumentClient(documentId, { entryDate });
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

  const banksOnly = banks.filter((b) => b.kind !== "CASH");
  const primary =
    banksOnly.find((b) => b.isPrimary) ||
    banksOnly.find((b) => b.accountNumber.includes("215")) ||
    banksOnly[0];

  for (const e of entries) {
    const amt = parseAmount(e.amount);
    if (e.direction === "IN") totalIn += amt;
    else totalOut += amt;

    if (e.channel === "BANK") {
      // ถ้า id หาย/ไม่ตรงบัญชีหลัก ให้ลงที่ยอดบัญชีหลัก
      let bankId = e.bankAccountId;
      const known =
        bankId &&
        (banksOnly.some((b) => b.id === bankId) || bankId in bankNet);
      if (!bankId || !known) {
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
      // เงินสดหน้าร้าน หรือกระเป๋าเงินสดที่มีชื่อ (kind=CASH + bankAccountId)
      const cashPotId = e.bankAccountId;
      const cashPot =
        cashPotId && banks.find((b) => b.id === cashPotId && b.kind === "CASH");
      if (cashPot && cashPotId) {
        if (!(cashPotId in bankNet)) bankNet[cashPotId] = 0;
        bankNet[cashPotId] += e.direction === "IN" ? amt : -amt;
      } else if (e.direction === "IN") {
        cashIn += amt;
      } else {
        cashOut += amt;
      }
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

/**
 * เติมลิงก์ใบหัก ณ ที่จ่ายในสมุดเงินสด จาก meta ของใบสำคัญจ่าย
 * (กรณีบันทึกเก่าที่ยังไม่ได้เก็บ withholdingDocumentId ไว้ในรายการเงินสด)
 */
export async function backfillCashbookWhtLinksClient(
  entries: CashbookEntry[],
): Promise<CashbookEntry[]> {
  const db = getFirestoreDb();
  if (!db) return entries;

  const need = entries.filter((e) => {
    const pvId =
      e.paymentVoucherDocumentId ||
      (e.documentKind === "PAYMENT_VOUCHER" ? e.documentId : null);
    return Boolean(pvId) && !e.withholdingDocumentId;
  });
  if (need.length === 0) return entries;

  let whtByNumber: Map<string, string> | null = null;
  const ensureWhtMap = async () => {
    if (whtByNumber) return whtByNumber;
    whtByNumber = new Map();
    const snap = await getDocs(collection(db, firestoreCollections.documents));
    for (const d of snap.docs) {
      const row = d.data() as Record<string, unknown>;
      if (String(row.kind) === "WITHHOLDING_TAX" && row.number) {
        whtByNumber.set(String(row.number), d.id);
      }
    }
    return whtByNumber;
  };

  const byId = new Map(entries.map((e) => [e.id, e]));

  await Promise.all(
    need.map(async (e) => {
      const pvId =
        e.paymentVoucherDocumentId ||
        (e.documentKind === "PAYMENT_VOUCHER" ? e.documentId : null);
      if (!pvId) return;
      try {
        const snap = await getDoc(doc(db, firestoreCollections.documents, pvId));
        if (!snap.exists()) return;
        const d = snap.data() as Record<string, unknown>;
        let meta: {
          withholdingDocumentId?: string;
          withholdingDocumentNumber?: string;
        } = {};
        try {
          meta = JSON.parse(String(d.metaJson ?? "{}")) as typeof meta;
        } catch {
          /* ignore */
        }
        let whtId = meta.withholdingDocumentId?.trim() || null;
        let whtNo = meta.withholdingDocumentNumber?.trim() || null;
        if (!whtNo) {
          const notes = String(d.notes ?? "");
          const m =
            notes.match(/สร้างหัก\s*ณ\s*ที่จ่าย\s*([A-Za-z0-9\-]+)/i) ||
            notes.match(/หัก\s*ณ\s*ที่จ่าย\s*([A-Za-z0-9\-]+)/i);
          if (m?.[1]) whtNo = m[1];
        }
        if (!whtId && whtNo) {
          const map = await ensureWhtMap();
          whtId = map.get(whtNo) ?? null;
        }
        if (!whtId && !whtNo) return;

        const pvNumber = String(d.number ?? e.documentNumber ?? "") || null;
        await updateDoc(doc(db, firestoreCollections.cashbookEntries, e.id), {
          withholdingDocumentId: whtId,
          withholdingDocumentNumber: whtNo,
          paymentVoucherDocumentId: pvId,
          paymentVoucherDocumentNumber: pvNumber || e.paymentVoucherDocumentNumber,
          updatedAt: serverTimestamp(),
        });
        byId.set(e.id, {
          ...e,
          withholdingDocumentId: whtId,
          withholdingDocumentNumber: whtNo,
          paymentVoucherDocumentId: pvId,
          paymentVoucherDocumentNumber: pvNumber || e.paymentVoucherDocumentNumber,
        });
      } catch (err) {
        console.error("[backfillCashbookWhtLinksClient]", e.id, err);
      }
    }),
  );

  return entries.map((e) => byId.get(e.id) ?? e);
}

export async function loadCashbookDashboard() {
  const [rawEntries, primary] = await Promise.all([
    listCashbookEntriesClient(),
    ensurePrimaryBankAccount(),
  ]);
  const entries = await backfillCashbookWhtLinksClient(rawEntries);
  const banks = await listBankAccountsClient();
  const balances = calcBalancesFromEntries(entries, banks, 0);
  return { entries, banks, primary, ...balances };
}
