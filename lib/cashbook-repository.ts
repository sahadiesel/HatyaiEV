import { canWriteFirestore, FIRESTORE_WRITE_HINT } from "@/lib/data-primary";
import type { CashbookEntry, CashDirection, CashSettings, CashbookEntryType } from "@/lib/domain-types";
import { parseAmount, roundMoney2 } from "@/lib/documents/calc";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { cashSettingsDocId, firestoreCollections } from "@/lib/firestore-collections";
import { newEntityId } from "@/lib/new-id";

function db() {
  return getAdminFirestore();
}

function parseEntry(id: string, d: Record<string, unknown>): CashbookEntry {
  return {
    id,
    entryNo: String(d.entryNo ?? ""),
    entryDate: String(d.entryDate ?? ""),
    direction: (d.direction as CashDirection) || "OUT",
    entryType: (d.entryType as CashbookEntryType) || "MANUAL",
    amount: String(d.amount ?? "0"),
    description: String(d.description ?? ""),
    documentId: d.documentId ? String(d.documentId) : null,
    documentKind: d.documentKind ? String(d.documentKind) : null,
    documentNumber: d.documentNumber ? String(d.documentNumber) : null,
    vehicleId: d.vehicleId ? String(d.vehicleId) : null,
    entityId: d.entityId ? String(d.entityId) : null,
    createdByName: String(d.createdByName ?? ""),
    createdAt: String(d.createdAt ?? ""),
  };
}

export async function getCashSettings(): Promise<CashSettings> {
  const firestore = db();
  if (!firestore) return { openingBalance: "0" };
  try {
    const snap = await firestore
      .collection(firestoreCollections.cashSettings)
      .doc(cashSettingsDocId)
      .get();
    if (!snap.exists) return { openingBalance: "0" };
    const d = snap.data()!;
    return { openingBalance: String(d.openingBalance ?? "0"), updatedAt: d.updatedAt ? String(d.updatedAt) : undefined };
  } catch {
    return { openingBalance: "0" };
  }
}

export async function setOpeningBalance(amount: string) {
  if (!canWriteFirestore()) return { ok: false as const, message: FIRESTORE_WRITE_HINT };
  const firestore = db();
  if (!firestore) return { ok: false as const, message: FIRESTORE_WRITE_HINT };
  await firestore.collection(firestoreCollections.cashSettings).doc(cashSettingsDocId).set(
    { openingBalance: String(parseAmount(amount)), updatedAt: new Date().toISOString() },
    { merge: true },
  );
  return { ok: true as const };
}

export async function listCashbookEntries(limit = 300): Promise<CashbookEntry[]> {
  const firestore = db();
  if (!firestore) return [];
  try {
    const snap = await firestore
      .collection(firestoreCollections.cashbookEntries)
      .orderBy("entryDate", "desc")
      .limit(limit)
      .get();
    return snap.docs.map((doc) => parseEntry(doc.id, doc.data() as Record<string, unknown>));
  } catch {
    try {
      const snap = await firestore.collection(firestoreCollections.cashbookEntries).get();
      return snap.docs
        .map((doc) => parseEntry(doc.id, doc.data() as Record<string, unknown>))
        .sort((a, b) => b.entryDate.localeCompare(a.entryDate) || b.createdAt.localeCompare(a.createdAt))
        .slice(0, limit);
    } catch (e) {
      console.error("[listCashbookEntries]", e);
      return [];
    }
  }
}

async function nextCashbookNo(entryDate: string): Promise<string> {
  const ymd = entryDate.replace(/-/g, "").slice(0, 8) || new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const prefix = `CB-${ymd}-`;
  const rows = await listCashbookEntries(500);
  let max = 0;
  for (const r of rows) {
    if (!r.entryNo.startsWith(prefix)) continue;
    const n = parseInt(r.entryNo.slice(prefix.length), 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}

export type PostCashbookInput = {
  entryDate?: string;
  direction: CashDirection;
  entryType: CashbookEntryType;
  amount: string | number;
  description: string;
  documentId?: string | null;
  documentKind?: string | null;
  documentNumber?: string | null;
  vehicleId?: string | null;
  entityId?: string | null;
  createdByName?: string;
};

/**
 * บันทึกรายการสมุดเงินสด (ใช้ทั้ง Manual และ Automatic Sync จากเอกสาร)
 * ถ้ามี documentId อยู่แล้ว จะไม่ลงซ้ำ
 */
export async function postCashbookEntry(input: PostCashbookInput) {
  if (!canWriteFirestore()) return { ok: false as const, message: FIRESTORE_WRITE_HINT };
  const firestore = db();
  if (!firestore) return { ok: false as const, message: FIRESTORE_WRITE_HINT };

  const amount = roundMoney2(parseAmount(input.amount));
  if (amount <= 0) return { ok: false as const, message: "จำนวนเงินต้องมากกว่า 0" };

  if (input.documentId) {
    const existing = (await listCashbookEntries(500)).find((e) => e.documentId === input.documentId);
    if (existing) {
      return { ok: true as const, id: existing.id, entryNo: existing.entryNo, skippedDuplicate: true };
    }
  }

  const entryDate = input.entryDate || new Date().toISOString().slice(0, 10);
  const entryNo = await nextCashbookNo(entryDate);
  const id = newEntityId();
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
    vehicleId: input.vehicleId ?? null,
    entityId: input.entityId ?? null,
    createdByName: input.createdByName ?? "",
    createdAt: new Date().toISOString(),
  };

  await firestore.collection(firestoreCollections.cashbookEntries).doc(id).set({
    ...row,
    createdAtMs: Date.now(),
  });

  return { ok: true as const, id, entryNo, skippedDuplicate: false };
}

export async function deleteCashbookEntry(id: string) {
  if (!canWriteFirestore()) return { ok: false as const, message: FIRESTORE_WRITE_HINT };
  const firestore = db();
  if (!firestore) return { ok: false as const, message: FIRESTORE_WRITE_HINT };
  await firestore.collection(firestoreCollections.cashbookEntries).doc(id).delete();
  return { ok: true as const };
}

/** คำนวณยอดคงเหลือกระแสเงินสด = ยอดยกมา + รับ − จ่าย */
export async function calcCashflowBalance(): Promise<{
  openingBalance: number;
  totalIn: number;
  totalOut: number;
  balance: number;
  entries: CashbookEntry[];
}> {
  const [settings, entries] = await Promise.all([getCashSettings(), listCashbookEntries()]);
  const openingBalance = parseAmount(settings.openingBalance);
  let totalIn = 0;
  let totalOut = 0;
  for (const e of entries) {
    const amt = parseAmount(e.amount);
    if (e.direction === "IN") totalIn += amt;
    else totalOut += amt;
  }
  totalIn = roundMoney2(totalIn);
  totalOut = roundMoney2(totalOut);
  const balance = roundMoney2(openingBalance + totalIn - totalOut);
  return { openingBalance, totalIn, totalOut, balance, entries };
}
