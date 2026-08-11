"use client";

import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import type { LegalDocKind, LegalDocRecord } from "@/lib/domain-types";
import { getFirestoreDb } from "@/lib/firebase";
import { firestoreCollections } from "@/lib/firestore-collections";

function newClientId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, "").slice(0, 25);
  }
  return `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

function parseLegalDoc(id: string, d: Record<string, unknown>): LegalDocRecord {
  return {
    id,
    kind: (d.kind as LegalDocKind) || "VEHICLE_SALE_CONTRACT",
    number: String(d.number ?? ""),
    issueDate: String(d.issueDate ?? ""),
    vehicleId: d.vehicleId ? String(d.vehicleId) : null,
    repairContractId: d.repairContractId ? String(d.repairContractId) : null,
    sellerEntityId: d.sellerEntityId ? String(d.sellerEntityId) : null,
    buyerEntityId: d.buyerEntityId ? String(d.buyerEntityId) : null,
    hirerEntityId: d.hirerEntityId ? String(d.hirerEntityId) : null,
    contractorEntityId: d.contractorEntityId ? String(d.contractorEntityId) : null,
    paymentTermsJson: String(d.paymentTermsJson ?? "{}"),
    amount: String(d.amount ?? "0"),
    depositPercent: String(d.depositPercent ?? "70"),
    balancePercent: String(d.balancePercent ?? "30"),
    notes: String(d.notes ?? ""),
    metaJson: String(d.metaJson ?? "{}"),
  };
}

export async function listLegalDocsClient(kind?: LegalDocKind): Promise<LegalDocRecord[]> {
  const db = getFirestoreDb();
  if (!db) return [];
  try {
    const snap = await getDocs(collection(db, firestoreCollections.legalDocuments));
    let rows = snap.docs.map((d) => parseLegalDoc(d.id, d.data() as Record<string, unknown>));
    if (kind) rows = rows.filter((r) => r.kind === kind);
    return rows.sort((a, b) => (b.issueDate || "").localeCompare(a.issueDate || ""));
  } catch (e) {
    console.error("[listLegalDocsClient]", e);
    return [];
  }
}

function nextNumber(kind: LegalDocKind, rows: LegalDocRecord[]): string {
  const year = new Date().getFullYear();
  const prefixByKind: Partial<Record<LegalDocKind, string>> = {
    HIRE_CONTRACT: `HW-${year}-`,
    PURCHASE_CONTRACT: `PC-${year}-`,
    SALE_CONTRACT: `SC-${year}-`,
    VEHICLE_SALE_CONTRACT: `VS-${year}-`,
    VEHICLE_RECEIVING: `VR-${year}-`,
    REPAIR_CONTRACT: `RP-${year}-`,
    OUTSOURCE_REPAIR_CONTRACT: `OR-${year}-`,
  };
  const prefix = prefixByKind[kind] || `DOC-${year}-`;
  let max = 0;
  for (const r of rows) {
    if (!r.number?.startsWith(prefix)) continue;
    const n = parseInt(r.number.slice(prefix.length), 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}

export async function saveLegalDocClient(
  input: Omit<LegalDocRecord, "id" | "number"> & { id?: string | null; number?: string },
): Promise<{ ok: true; id: string; number: string } | { ok: false; message: string }> {
  const db = getFirestoreDb();
  if (!db) {
    return { ok: false, message: "ยังไม่ได้ตั้งค่า Firebase (NEXT_PUBLIC_FIREBASE_*)" };
  }
  try {
    const existing = await listLegalDocsClient(input.kind);
    const id = input.id || newClientId();
    const number = input.number || (input.id ? existing.find((e) => e.id === input.id)?.number : null) || nextNumber(input.kind, existing);
    const record: LegalDocRecord = {
      id,
      kind: input.kind,
      number,
      issueDate: input.issueDate,
      vehicleId: input.vehicleId,
      repairContractId: input.repairContractId,
      sellerEntityId: input.sellerEntityId,
      buyerEntityId: input.buyerEntityId,
      hirerEntityId: input.hirerEntityId ?? null,
      contractorEntityId: input.contractorEntityId ?? null,
      paymentTermsJson: input.paymentTermsJson,
      amount: input.amount,
      depositPercent: input.depositPercent,
      balancePercent: input.balancePercent,
      notes: input.notes,
      metaJson: input.metaJson,
    };
    await setDoc(
      doc(db, firestoreCollections.legalDocuments, id),
      { ...record, updatedAt: serverTimestamp(), createdAt: serverTimestamp() },
      { merge: true },
    );
    return { ok: true, id, number };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (message.toLowerCase().includes("permission")) {
      return { ok: false, message: "ไม่มีสิทธิ์บันทึก — ต้องเป็นผู้ดูแลระบบที่อนุมัติแล้ว" };
    }
    return { ok: false, message };
  }
}

export async function deleteLegalDocClient(
  id: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const db = getFirestoreDb();
  if (!db) return { ok: false, message: "ยังไม่ได้ตั้งค่า Firebase" };
  try {
    await deleteDoc(doc(db, firestoreCollections.legalDocuments, id));
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}
