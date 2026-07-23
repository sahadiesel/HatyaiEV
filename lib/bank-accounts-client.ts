"use client";

import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import type { BankAccountRecord } from "@/lib/domain-types";
import { getFirestoreDb } from "@/lib/firebase";
import { firestoreCollections } from "@/lib/firestore-collections";

/** บัญชีหลักเริ่มต้นตามพิมพ์เขียว */
export const DEFAULT_PRIMARY_BANK: Omit<BankAccountRecord, "id"> = {
  accountName: "บริษัท หาดใหญ่ อี วี จำกัด",
  bankName: "กสิกรไทย",
  accountNumber: "215-8-41628-2",
  openingBalance: "0",
  isPrimary: true,
  active: true,
  notes: "บัญชีหลักรับ-จ่าย",
};

function newId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, "").slice(0, 20);
  }
  return `ba${Date.now().toString(36)}`;
}

export function parseBankAccount(id: string, d: Record<string, unknown>): BankAccountRecord {
  return {
    id,
    accountName: String(d.accountName ?? ""),
    bankName: String(d.bankName ?? ""),
    accountNumber: String(d.accountNumber ?? ""),
    openingBalance: String(d.openingBalance ?? "0"),
    isPrimary: d.isPrimary === true,
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
      .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.bankName.localeCompare(b.bankName, "th"));
  } catch (e) {
    console.error("[listBankAccountsClient]", e);
    return [];
  }
}

export function normalizeAccountNumber(n: string): string {
  return String(n ?? "").replace(/[\s-]/g, "");
}

/** หาบัญชีหลัก — ถ้ามีเลขบัญชีกสิกรอยู่แล้ว ไม่สร้างซ้ำ */
export async function ensurePrimaryBankAccount(): Promise<BankAccountRecord | null> {
  const existing = await listBankAccountsClient();
  const defaultNo = normalizeAccountNumber(DEFAULT_PRIMARY_BANK.accountNumber);

  const byPrimary = existing.find((b) => b.isPrimary);
  const byDefaultNo = existing.find(
    (b) => normalizeAccountNumber(b.accountNumber) === defaultNo,
  );
  const found = byPrimary || byDefaultNo || existing[0];

  if (found) {
    // ให้บัญชีที่เจอเป็น primary ถ้ายังไม่ใช่ (โดยเฉพาะกรณีซ้ำ)
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
  const id = newId();
  const row: BankAccountRecord = { id, ...DEFAULT_PRIMARY_BANK };
  try {
    await setDoc(doc(db, firestoreCollections.bankAccounts, id), {
      ...row,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
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
    // รายการที่ bankAccountId ไม่อยู่ในรายการ banks แล้ว
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
  if (!input.accountName.trim() || !input.bankName.trim() || !input.accountNumber.trim()) {
    return { ok: false, message: "กรอกชื่อบัญชี ธนาคาร และเลขบัญชี" };
  }
  try {
    const id = input.id || newId();
    if (input.isPrimary) {
      const all = await listBankAccountsClient();
      await Promise.all(
        all
          .filter((b) => b.id !== id && b.isPrimary)
          .map((b) => updateDoc(doc(db, firestoreCollections.bankAccounts, b.id), { isPrimary: false })),
      );
    }
    await setDoc(
      doc(db, firestoreCollections.bankAccounts, id),
      {
        accountName: input.accountName.trim(),
        bankName: input.bankName.trim(),
        accountNumber: input.accountNumber.trim(),
        openingBalance: input.openingBalance || "0",
        isPrimary: input.isPrimary === true,
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
