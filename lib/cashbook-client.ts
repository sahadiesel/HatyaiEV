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
import { firestoreCollections, cashSettingsDocId } from "@/lib/firestore-collections";
import {
  CASH_ACCOUNT_ID,
  ensurePrimaryBankAccount,
  listBankAccountsClient,
  normalizeAccountNumber,
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
    isSystemAuto: Boolean(d.isSystemAuto),
    createdByName: String(d.createdByName ?? ""),
    createdAt: String(d.createdAt ?? ""),
  };
}

/** รายการยอดยกมา (ประเภท หรือคำอธิบายแบบเดิม) */
export function isBalanceCarryEntry(e: Pick<CashbookEntry, "entryType" | "description">): boolean {
  if (e.entryType === "BALANCE_CARRY") return true;
  return String(e.description ?? "").trim().startsWith("ยอดยกมา");
}

/** รายการยอดยกมาที่ระบบสร้างผิด — ไม่นับเป็นรับ/จ่ายจริง */
export function isAutoCarryNoiseEntry(e: CashbookEntry): boolean {
  if (e.entryType === "BALANCE_CARRY") return true;
  if (e.isSystemAuto) return true;
  if (e.createdByName === "ระบบ" && isBalanceCarryEntry(e)) return true;
  if (e.entryNo === "AUTO" || e.id.startsWith("auto-carry-")) return true;
  return false;
}

export function isSystemAutoCarryEntry(e: CashbookEntry): boolean {
  return isAutoCarryNoiseEntry(e);
}

/** กลุ่ม id บัญชีที่ถือว่าเป็นบัญชีเดียวกัน (เลขบัญชีซ้ำ) */
export function resolveAccountGroupIds(
  accountKey: string,
  banks: BankAccountRecord[],
): string[] {
  if (accountKey === CASH_ACCOUNT_ID) return [CASH_ACCOUNT_ID];
  const bank = banks.find((b) => b.id === accountKey);
  if (!bank) return [accountKey];
  if (bank.kind === "CASH") return [accountKey];
  const norm = normalizeAccountNumber(bank.accountNumber);
  const ids = banks
    .filter((b) => b.kind !== "CASH" && normalizeAccountNumber(b.accountNumber) === norm)
    .map((b) => b.id);
  return ids.length > 0 ? ids : [accountKey];
}

/** คีย์บัญชีสำหรับจัดกลุ่มยอด (เงินสดหน้าร้าน = CASH_ACCOUNT_ID) */
export function cashbookAccountKey(
  e: Pick<CashbookEntry, "channel" | "bankAccountId">,
  banks: BankAccountRecord[],
  primaryId?: string,
): string {
  if (e.channel === "BANK") {
    return e.bankAccountId || primaryId || "__UNKNOWN_BANK__";
  }
  const pot =
    e.bankAccountId && banks.find((b) => b.id === e.bankAccountId && b.kind === "CASH");
  if (pot) return pot.id;
  return CASH_ACCOUNT_ID;
}

function entryMatchesAccountKey(
  e: CashbookEntry,
  accountKey: string,
  banks: BankAccountRecord[],
  primaryId?: string,
): boolean {
  const key = cashbookAccountKey(e, banks, primaryId);
  if (key === accountKey) return true;
  const group = new Set(resolveAccountGroupIds(accountKey, banks));
  if (group.has(key)) return true;
  // รายการ BANK ที่ไม่มี bankAccountId → ถือว่าเป็นบัญชีหลัก
  if (
    e.channel === "BANK" &&
    !e.bankAccountId &&
    primaryId &&
    group.has(primaryId)
  ) {
    return true;
  }
  return false;
}

/** ยอดคงเหลือของบัญชี ณ ก่อนวันที่ beforeYmd (ไม่รวมวันนั้น) */
export function balanceForAccountBefore(
  entries: CashbookEntry[],
  banks: BankAccountRecord[],
  accountKey: string,
  beforeYmd: string,
  cashOpening = 0,
): number {
  const primary =
    banks.find((b) => b.kind !== "CASH" && b.isPrimary) ||
    banks.find((b) => b.kind !== "CASH") ||
    banks[0];
  const relevant = entries.filter(
    (e) =>
      e.entryDate < beforeYmd &&
      entryMatchesAccountKey(e, accountKey, banks, primary?.id),
  );
  return roundMoney2(
    holdingsForAccountEntries(relevant, banks, accountKey, cashOpening),
  );
}

/** ยอดถือครองจากรายการของบัญชีเดียว — แบบ Saha: ยอดยกมาตั้งต้น + รับ − จ่าย */
function holdingsForAccountEntries(
  entries: CashbookEntry[],
  banks: BankAccountRecord[],
  accountKey: string,
  cashOpening: number,
): number {
  const real = entries.filter((e) => !isAutoCarryNoiseEntry(e));
  const sorted = [...real].sort(
    (a, b) =>
      a.entryDate.localeCompare(b.entryDate) ||
      a.createdAt.localeCompare(b.createdAt) ||
      a.entryNo.localeCompare(b.entryNo),
  );

  const groupIds = new Set(resolveAccountGroupIds(accountKey, banks));
  let bal =
    accountKey === CASH_ACCOUNT_ID
      ? cashOpening
      : parseAmount(
          (
            banks.find((b) => groupIds.has(b.id) && b.isPrimary) ||
            banks.find((b) => groupIds.has(b.id))
          )?.openingBalance ?? "0",
        );

  for (const e of sorted) {
    const amt = parseAmount(e.amount);
    bal += e.direction === "IN" ? amt : -amt;
  }
  return bal;
}

export async function listCashbookEntriesClient(limit = 300): Promise<CashbookEntry[]> {
  const db = getFirestoreDb();
  if (!db) return [];
  try {
    const snap = await getDocs(collection(db, firestoreCollections.cashbookEntries));
    const rows = snap.docs
      .map((d) => parseCashbookEntryClient(d.id, d.data() as Record<string, unknown>))
      .sort((a, b) => b.entryDate.localeCompare(a.entryDate) || b.createdAt.localeCompare(a.createdAt));
    // limit <= 0 = โหลดทั้งหมด (ใช้คำนวณยอดคงเหลือ)
    if (!limit || limit <= 0) return rows;
    return rows.slice(0, limit);
  } catch (e) {
    console.error("[listCashbookEntriesClient]", e);
    return [];
  }
}

/** ตั้งค่ายอดยกมาเงินสดหน้าร้าน */
export async function getCashSettingsClient(): Promise<{
  openingBalance: string;
  cashOpeningBalance: string;
}> {
  const db = getFirestoreDb();
  if (!db) return { openingBalance: "0", cashOpeningBalance: "0" };
  try {
    const snap = await getDoc(doc(db, firestoreCollections.cashSettings, cashSettingsDocId));
    if (!snap.exists()) return { openingBalance: "0", cashOpeningBalance: "0" };
    const d = snap.data() as Record<string, unknown>;
    return {
      openingBalance: String(d.openingBalance ?? "0"),
      cashOpeningBalance: String(d.cashOpeningBalance ?? d.openingBalance ?? "0"),
    };
  } catch (e) {
    console.error("[getCashSettingsClient]", e);
    return { openingBalance: "0", cashOpeningBalance: "0" };
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
  isSystemAuto?: boolean;
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
      isSystemAuto: Boolean(input.isSystemAuto),
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

/** อัปเดตรายการสมุดเงินสดตาม id (วันที่ / ยอด / บัญชี) */
export async function updateCashbookEntryClient(
  entryId: string,
  patch: {
    entryDate?: string;
    amount?: string | number;
    channel?: CashChannel;
    bankAccountId?: string | null;
    description?: string;
  },
): Promise<{ ok: true } | { ok: false; message: string }> {
  const db = getFirestoreDb();
  if (!db) return { ok: false, message: "ยังไม่ได้ตั้งค่า Firebase" };
  if (!entryId) return { ok: false, message: "ไม่พบรายการเงินสด" };
  try {
    const data: Record<string, unknown> = { updatedAt: serverTimestamp() };
    if (patch.entryDate) data.entryDate = toYmdLocal(patch.entryDate);
    if (patch.amount != null) {
      const amount = roundMoney2(parseAmount(patch.amount));
      if (amount <= 0) return { ok: false, message: "จำนวนเงินต้องมากกว่า 0" };
      data.amount = amount.toFixed(2);
    }
    if (patch.channel) data.channel = patch.channel;
    if (patch.bankAccountId !== undefined) data.bankAccountId = patch.bankAccountId;
    if (patch.description != null) data.description = patch.description.trim();
    await updateDoc(doc(db, firestoreCollections.cashbookEntries, entryId), data);
    return { ok: true };
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
  const real = entries.filter((e) => !isAutoCarryNoiseEntry(e));
  let totalIn = 0;
  let totalOut = 0;
  for (const e of real) {
    const amt = parseAmount(e.amount);
    if (e.direction === "IN") totalIn += amt;
    else totalOut += amt;
  }

  const banksOnly = banks.filter((b) => b.kind !== "CASH");
  const primary =
    banksOnly.find((b) => b.isPrimary) ||
    banksOnly.find((b) => b.accountNumber.includes("215")) ||
    banksOnly[0];

  const canonicalKeys: string[] = [CASH_ACCOUNT_ID];
  const seenNorm = new Set<string>();
  for (const b of banks) {
    if (b.kind === "CASH") {
      canonicalKeys.push(b.id);
      continue;
    }
    const norm = normalizeAccountNumber(b.accountNumber);
    if (seenNorm.has(norm)) continue;
    seenNorm.add(norm);
    const group = banks.filter(
      (x) => x.kind !== "CASH" && normalizeAccountNumber(x.accountNumber) === norm,
    );
    const canonical = group.find((x) => x.isPrimary) || group[0] || b;
    canonicalKeys.push(canonical.id);
  }

  const bankNet: Record<string, number> = {};
  for (const b of banks) bankNet[b.id] = parseAmount(b.openingBalance);

  let cashBalance = roundMoney2(cashOpening);
  for (const key of canonicalKeys) {
    const list = real.filter((e) =>
      entryMatchesAccountKey(e, key, banks, primary?.id),
    );
    const bal = roundMoney2(
      holdingsForAccountEntries(list, banks, key, cashOpening),
    );
    if (key === CASH_ACCOUNT_ID) {
      cashBalance = bal;
      continue;
    }
    const group = resolveAccountGroupIds(key, banks);
    for (const id of group) bankNet[id] = 0;
    bankNet[key] = bal;
  }

  const banksTotal = roundMoney2(
    Object.values(bankNet).reduce((s, v) => s + v, 0),
  );
  return {
    totalIn: roundMoney2(totalIn),
    totalOut: roundMoney2(totalOut),
    balance: roundMoney2(totalIn - totalOut),
    cashBalance,
    holdingsTotal: roundMoney2(cashBalance + banksTotal),
    bankBalances: bankNet,
  };
}

/**
 * ลบรายการยอดยกมาที่ระบบเคยสร้างผิด (AUTO / BALANCE_CARRY)
 * — ตามแบบ Saha_new: ยอดยกมาเป็นยอดคำนวณ ไม่ใช่รายการรับ/จ่ายในสมุด
 */
export async function cleanupAutoBalanceCarriesClient(
  entries: CashbookEntry[],
): Promise<{ entries: CashbookEntry[]; removed: number }> {
  const isAutoCarry = (e: CashbookEntry) =>
    e.entryType === "BALANCE_CARRY" ||
    Boolean(e.isSystemAuto) ||
    e.createdByName === "ระบบ" ||
    e.entryNo === "AUTO" ||
    e.id.startsWith("auto-carry-") ||
    (isBalanceCarryEntry(e) &&
      (Boolean(e.isSystemAuto) || e.createdByName === "ระบบ" || e.entryNo === "AUTO"));

  let removed = 0;
  const keep: CashbookEntry[] = [];
  for (const e of entries) {
    if (!isAutoCarry(e)) {
      keep.push(e);
      continue;
    }
    if (e.id.startsWith("auto-carry-")) continue;
    const del = await deleteCashbookEntryClient(e.id);
    if (del.ok) removed += 1;
  }
  return { entries: keep, removed };
}

/** @deprecated ใช้ cleanupAutoBalanceCarriesClient — ไม่สร้างยอดยกมาเป็นรายการรับ/จ่ายอีก */
export async function ensureMonthlyBalanceCarriesClient(
  entries: CashbookEntry[],
  _banks: BankAccountRecord[],
  _cashOpening = 0,
  _now = new Date(),
): Promise<{ entries: CashbookEntry[]; created: number; updated: number; removed: number }> {
  const { entries: next, removed } = await cleanupAutoBalanceCarriesClient(entries);
  return { entries: next, created: 0, updated: 0, removed };
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
  const [rawEntries, primary, settings] = await Promise.all([
    listCashbookEntriesClient(0),
    ensurePrimaryBankAccount(),
    getCashSettingsClient(),
  ]);
  const backfilled = await backfillCashbookWhtLinksClient(rawEntries);
  const banks = await listBankAccountsClient();
  const cashOpening = parseAmount(settings.cashOpeningBalance || settings.openingBalance);
  // ลบยอดยกมา AUTO ที่เคยสร้างผิด — ไม่สร้างใหม่ (ยอดยกมาเป็นยอดคำนวณแบบ Saha)
  const cleaned = await cleanupAutoBalanceCarriesClient(backfilled);
  const entries = cleaned.entries;
  const balances = calcBalancesFromEntries(entries, banks, cashOpening);
  return { entries, banks, primary, cashOpening, ...balances };
}
