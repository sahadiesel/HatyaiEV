"use client";

import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import type { BankAccountKind, BankAccountRecord, CashChannel } from "@/lib/domain-types";
import { parseAmount, roundMoney2 } from "@/lib/documents/calc";
import { getFirestoreDb } from "@/lib/firebase";
import { firestoreCollections } from "@/lib/firestore-collections";

/** id คงที่ของบัญชีหลักเริ่มต้น — กันสร้างซ้ำคนละ id */
export const DEFAULT_PRIMARY_BANK_ID = "primary-kbank-2158416282";

/** บัญชีหลักเริ่มต้นตามพิมพ์เขียว */
export const DEFAULT_PRIMARY_BANK: Omit<BankAccountRecord, "id"> = {
  kind: "BANK",
  accountName: "บริษัท หาดใหญ่ อี วี จำกัด",
  bankName: "กสิกรไทย",
  accountNumber: "215-8-41628-2",
  openingBalance: "0",
  isPrimary: true,
  active: true,
  notes: "บัญชีหลักรับ-จ่าย",
};

/** รหัสช่องทางเงินสดหน้าร้านเริ่มต้น (ไม่ใช่เอกสารใน bankAccounts) */
export const CASH_ACCOUNT_ID = "__CASH__";

function newId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, "").slice(0, 20);
  }
  return `ba${Date.now().toString(36)}`;
}

export function parseBankAccount(id: string, d: Record<string, unknown>): BankAccountRecord {
  const kindRaw = String(d.kind ?? "").toUpperCase();
  const kind: BankAccountKind =
    kindRaw === "CASH" || String(d.bankName ?? "").trim() === "เงินสด" ? "CASH" : "BANK";
  return {
    id,
    kind,
    accountName: String(d.accountName ?? ""),
    bankName: String(d.bankName ?? (kind === "CASH" ? "เงินสด" : "")),
    accountNumber: String(d.accountNumber ?? ""),
    openingBalance: String(d.openingBalance ?? "0"),
    isPrimary: d.isPrimary === true && kind === "BANK",
    active: d.active !== false,
    notes: String(d.notes ?? ""),
  };
}

export async function listBankAccountsClient(): Promise<BankAccountRecord[]> {
  const db = getFirestoreDb();
  if (!db) return [];
  try {
    const snap = await getDocs(collection(db, firestoreCollections.bankAccounts));
    return snap.docs
      .map((d) => parseBankAccount(d.id, d.data() as Record<string, unknown>))
      .filter((b) => b.active)
      .sort(
        (a, b) =>
          Number(a.kind === "BANK") - Number(b.kind === "BANK") ||
          Number(b.isPrimary) - Number(a.isPrimary) ||
          a.accountName.localeCompare(b.accountName, "th"),
      );
  } catch (e) {
    console.error("[listBankAccountsClient]", e);
    return [];
  }
}

export function normalizeAccountNumber(n: string): string {
  return String(n ?? "").replace(/[\s-]/g, "");
}

export function channelForAccountId(
  accountId: string,
  banks: BankAccountRecord[],
): CashChannel {
  if (accountId === CASH_ACCOUNT_ID) return "CASH";
  const b = banks.find((x) => x.id === accountId);
  return b?.kind === "CASH" ? "CASH" : "BANK";
}

/** หาบัญชีหลัก (เฉพาะธนาคาร) — ใช้ id คงที่ / เลขบัญชีเดิม ถ้ามีอยู่แล้วไม่สร้างซ้ำ */
export async function ensurePrimaryBankAccount(): Promise<BankAccountRecord | null> {
  const existing = await listBankAccountsClient();
  const banksOnly = existing.filter((b) => b.kind === "BANK");
  const defaultNo = normalizeAccountNumber(DEFAULT_PRIMARY_BANK.accountNumber);

  const byFixedId = banksOnly.find((b) => b.id === DEFAULT_PRIMARY_BANK_ID);
  const byPrimary = banksOnly.find((b) => b.isPrimary);
  const byDefaultNo = banksOnly.find(
    (b) => normalizeAccountNumber(b.accountNumber) === defaultNo,
  );
  const found = byFixedId || byPrimary || byDefaultNo || banksOnly[0];

  if (found) {
    if (!found.isPrimary) {
      const db = getFirestoreDb();
      if (db) {
        try {
          await Promise.all(
            existing
              .filter((b) => b.id !== found.id && b.isPrimary)
              .map((b) =>
                updateDoc(doc(db, firestoreCollections.bankAccounts, b.id), { isPrimary: false }),
              ),
          );
          await updateDoc(doc(db, firestoreCollections.bankAccounts, found.id), {
            isPrimary: true,
            updatedAt: serverTimestamp(),
          });
          return { ...found, isPrimary: true };
        } catch (e) {
          console.error("[ensurePrimaryBankAccount] mark primary", e);
        }
      }
    }
    return found;
  }

  const db = getFirestoreDb();
  if (!db) return null;
  const id = DEFAULT_PRIMARY_BANK_ID;
  const row: BankAccountRecord = { id, ...DEFAULT_PRIMARY_BANK };
  try {
    await setDoc(
      doc(db, firestoreCollections.bankAccounts, id),
      {
        ...row,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
    return row;
  } catch (e) {
    console.error("[ensurePrimaryBankAccount]", e);
    return null;
  }
}

/** รวมยอดบัญชีที่เลขบัญชีเดียวกัน (กันกรณีสร้างบัญชีซ้ำคนละ id) */
export function sumBalanceForAccountNumber(
  banks: BankAccountRecord[],
  bankBalances: Record<string, number>,
  accountNumber: string,
): number {
  const key = normalizeAccountNumber(accountNumber);
  let sum = 0;
  let matched = false;
  for (const b of banks) {
    if (normalizeAccountNumber(b.accountNumber) !== key) continue;
    matched = true;
    sum += bankBalances[b.id] ?? 0;
  }
  if (!matched) {
    for (const [id, bal] of Object.entries(bankBalances)) {
      if (!banks.some((b) => b.id === id)) sum += bal;
    }
  }
  return Math.round(sum * 100) / 100;
}

export async function saveBankAccountClient(
  input: Omit<BankAccountRecord, "id"> & { id?: string | null },
): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const db = getFirestoreDb();
  if (!db) return { ok: false, message: "ยังไม่ได้ตั้งค่า Firebase" };

  const kind: BankAccountKind = input.kind === "CASH" ? "CASH" : "BANK";
  const accountName = input.accountName.trim();
  if (!accountName) {
    return { ok: false, message: "กรอกชื่อบัญชี" };
  }

  let bankName = input.bankName.trim();
  let accountNumber = input.accountNumber.trim();
  if (kind === "CASH") {
    bankName = bankName || "เงินสด";
    accountNumber = accountNumber || `CASH-${Date.now().toString(36).toUpperCase()}`;
  } else if (!bankName || !accountNumber) {
    return { ok: false, message: "กรอกชื่อบัญชี ธนาคาร และเลขบัญชี" };
  }

  try {
    const all = await listBankAccountsClient();
    const norm = normalizeAccountNumber(accountNumber);
    const dup = all.find(
      (b) =>
        b.id !== (input.id || "") &&
        normalizeAccountNumber(b.accountNumber) === norm,
    );
    if (dup && !input.id) {
      return {
        ok: false,
        message:
          kind === "CASH"
            ? `รหัสบัญชีเงินสดซ้ำ (${dup.accountName})`
            : `เลขบัญชีนี้มีอยู่แล้ว (${dup.bankName} ${dup.accountNumber})`,
      };
    }

    const id = input.id || newId();
    const wantPrimary = kind === "BANK" && input.isPrimary === true;
    if (wantPrimary) {
      await Promise.all(
        all
          .filter((b) => b.id !== id && b.isPrimary)
          .map((b) => updateDoc(doc(db, firestoreCollections.bankAccounts, b.id), { isPrimary: false })),
      );
    }
    await setDoc(
      doc(db, firestoreCollections.bankAccounts, id),
      {
        kind,
        accountName,
        bankName,
        accountNumber,
        openingBalance: input.openingBalance || "0",
        isPrimary: wantPrimary,
        active: input.active !== false,
        notes: input.notes ?? "",
        updatedAt: serverTimestamp(),
        ...(input.id ? {} : { createdAt: serverTimestamp() }),
      },
      { merge: true },
    );
    return { ok: true, id };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

export type BankAccountUsage = {
  entryCount: number;
  balance: number;
  hasMoney: boolean;
  isUsed: boolean;
  canDelete: boolean;
  reason?: string;
};

export async function getBankAccountsUsageMapClient(): Promise<{
  banks: BankAccountRecord[];
  cashBalance: number;
  bankBalances: Record<string, number>;
  usage: Record<string, BankAccountUsage>;
}> {
  const {
    calcBalancesFromEntries,
    listCashbookEntriesClient,
  } = await import("@/lib/cashbook-client");
  await ensurePrimaryBankAccount();
  const [banks, entries] = await Promise.all([
    listBankAccountsClient(),
    listCashbookEntriesClient(800),
  ]);
  const { bankBalances, cashBalance } = calcBalancesFromEntries(entries, banks, 0);

  const entryCountByBank: Record<string, number> = {};
  for (const e of entries) {
    if (e.bankAccountId) {
      entryCountByBank[e.bankAccountId] = (entryCountByBank[e.bankAccountId] || 0) + 1;
    }
  }

  const usage: Record<string, BankAccountUsage> = {};
  for (const b of banks) {
    const entryCount = entryCountByBank[b.id] || 0;
    const balance = roundMoney2(bankBalances[b.id] ?? parseAmount(b.openingBalance));
    const hasMoney = Math.abs(balance) > 0.009;
    const isUsed = entryCount > 0;
    let canDelete = true;
    let reason: string | undefined;
    if (b.isPrimary) {
      canDelete = false;
      reason = "เป็นบัญชีหลัก — ตั้งบัญชีอื่นเป็นหลักก่อน";
    } else if (hasMoney) {
      canDelete = false;
      reason = `มียอดคงเหลือ ฿${balance.toLocaleString("th-TH", { minimumFractionDigits: 2 })}`;
    } else if (isUsed) {
      canDelete = false;
      reason = `มีรายการในสมุดเงินสด ${entryCount} รายการ`;
    }
    usage[b.id] = { entryCount, balance, hasMoney, isUsed, canDelete, reason };
  }

  return { banks, cashBalance, bankBalances, usage };
}

/** ลบบัญชี — ห้ามลบถ้ามียอด / มีรายการ / เป็นบัญชีหลัก */
export async function deleteBankAccountClient(
  id: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const db = getFirestoreDb();
  if (!db) return { ok: false, message: "ยังไม่ได้ตั้งค่า Firebase" };
  if (id === CASH_ACCOUNT_ID) return { ok: false, message: "ลบบัญชีเงินสดไม่ได้" };

  const { banks, usage } = await getBankAccountsUsageMapClient();
  const row = banks.find((b) => b.id === id);
  if (!row) return { ok: false, message: "ไม่พบบัญชี" };
  const u = usage[id];
  if (!u?.canDelete) {
    return { ok: false, message: u?.reason || "ลบบัญชีนี้ไม่ได้" };
  }

  try {
    await deleteDoc(doc(db, firestoreCollections.bankAccounts, id));
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

function accountLabel(
  id: string,
  banks: BankAccountRecord[],
): string {
  if (id === CASH_ACCOUNT_ID) return "เงินสดหน้าร้าน";
  const b = banks.find((x) => x.id === id);
  if (!b) return id;
  if (b.kind === "CASH") return b.accountName || "เงินสด";
  return `${b.bankName} ${b.accountNumber}`;
}

/** โอนเงินข้ามบัญชี (เงินสด ↔ ธนาคาร / ธนาคาร ↔ ธนาคาร) */
export async function transferBetweenAccountsClient(input: {
  entryDate?: string;
  amount: string | number;
  fromAccountId: string;
  toAccountId: string;
  notes?: string;
  createdByName?: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const amount = roundMoney2(parseAmount(input.amount));
  if (amount <= 0) return { ok: false, message: "จำนวนเงินต้องมากกว่า 0" };
  if (!input.fromAccountId || !input.toAccountId) {
    return { ok: false, message: "เลือกบัญชีต้นทางและปลายทาง" };
  }
  if (input.fromAccountId === input.toAccountId) {
    return { ok: false, message: "บัญชีต้นทางและปลายทางต้องต่างกัน" };
  }

  const { banks, cashBalance, usage } = await getBankAccountsUsageMapClient();
  const fromBal =
    input.fromAccountId === CASH_ACCOUNT_ID
      ? cashBalance
      : usage[input.fromAccountId]?.balance;
  if (fromBal == null && input.fromAccountId !== CASH_ACCOUNT_ID) {
    return { ok: false, message: "ไม่พบบัญชีต้นทาง" };
  }
  if (input.toAccountId !== CASH_ACCOUNT_ID && !banks.some((b) => b.id === input.toAccountId)) {
    return { ok: false, message: "ไม่พบบัญชีปลายทาง" };
  }
  if ((fromBal ?? 0) + 0.009 < amount) {
    return {
      ok: false,
      message: `ยอดต้นทางไม่พอ (คงเหลือ ฿${(fromBal ?? 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })})`,
    };
  }

  const fromLabel = accountLabel(input.fromAccountId, banks);
  const toLabel = accountLabel(input.toAccountId, banks);
  const note = (input.notes ?? "").trim();
  const descBase = `โอนเงิน: ${fromLabel} → ${toLabel}${note ? ` — ${note}` : ""}`;
  const ymd = input.entryDate || new Date().toISOString().slice(0, 10);

  const { postCashbookEntryClient } = await import("@/lib/cashbook-client");

  const fromChannel = channelForAccountId(input.fromAccountId, banks);
  const toChannel = channelForAccountId(input.toAccountId, banks);
  const fromBankId =
    input.fromAccountId === CASH_ACCOUNT_ID ? null : input.fromAccountId;
  const toBankId = input.toAccountId === CASH_ACCOUNT_ID ? null : input.toAccountId;

  const out = await postCashbookEntryClient({
    entryDate: ymd,
    direction: "OUT",
    entryType: "TRANSFER",
    amount,
    description: `${descBase} (จ่ายออก)`,
    channel: fromChannel,
    bankAccountId: fromBankId,
    createdByName: input.createdByName,
  });
  if (!out.ok) return out;

  const inn = await postCashbookEntryClient({
    entryDate: ymd,
    direction: "IN",
    entryType: "TRANSFER",
    amount,
    description: `${descBase} (รับเข้า)`,
    channel: toChannel,
    bankAccountId: toBankId,
    createdByName: input.createdByName,
  });
  if (!inn.ok) return inn;

  return { ok: true };
}
