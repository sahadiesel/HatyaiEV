"use client";

import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import type { EntityKind, EntityRecord, EntityRole } from "@/lib/domain-types";
import { getFirestoreDb } from "@/lib/firebase";
import { firestoreCollections } from "@/lib/firestore-collections";

function newClientId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, "").slice(0, 25);
  }
  return `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

export function parseEntityRecord(id: string, d: Record<string, unknown>): EntityRecord {
  const rolesRaw = d.roles;
  const roles = Array.isArray(rolesRaw)
    ? (rolesRaw.map(String) as EntityRole[])
    : (["CUSTOMER"] as EntityRole[]);
  return {
    id,
    code: typeof d.code === "string" ? d.code : null,
    name: String(d.name ?? ""),
    entityKind: (d.entityKind === "COMPANY" ? "COMPANY" : "INDIVIDUAL") as EntityKind,
    roles,
    taxId: String(d.taxId ?? ""),
    address: String(d.address ?? ""),
    phone: String(d.phone ?? ""),
    email: String(d.email ?? ""),
    branchHeadOffice: d.branchHeadOffice !== false,
    branchNo: String(d.branchNo ?? ""),
    bankName: String(d.bankName ?? ""),
    bankAccount: String(d.bankAccount ?? ""),
    defaultWhtPercent: String(d.defaultWhtPercent ?? "3"),
    notes: String(d.notes ?? ""),
  };
}

export async function listEntitiesClient(): Promise<EntityRecord[]> {
  const db = getFirestoreDb();
  if (!db) return [];
  try {
    const snap = await getDocs(collection(db, firestoreCollections.entities));
    return snap.docs
      .map((d) => parseEntityRecord(d.id, d.data() as Record<string, unknown>))
      .sort((a, b) => a.name.localeCompare(b.name, "th"));
  } catch (e) {
    console.error("[listEntitiesClient]", e);
    return [];
  }
}

function nextCodeFromList(rows: EntityRecord[]): string {
  const year = new Date().getFullYear();
  const prefix = `EN-${year}-`;
  let max = 0;
  for (const r of rows) {
    if (!r.code?.startsWith(prefix)) continue;
    const n = parseInt(r.code.slice(prefix.length), 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}

export type EntityWriteInput = Omit<EntityRecord, "id" | "code"> & { code?: string | null };

export async function saveEntityClient(
  id: string | null,
  input: EntityWriteInput,
): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const db = getFirestoreDb();
  if (!db) {
    return { ok: false, message: "ยังไม่ได้ตั้งค่า Firebase (NEXT_PUBLIC_FIREBASE_*)" };
  }

  const name = input.name.trim();
  if (!name) return { ok: false, message: "กรอกชื่อ / ชื่อบริษัท" };
  if (!input.roles?.length) return { ok: false, message: "เลือกบทบาทอย่างน้อย 1 รายการ" };

  try {
    const existing = await listEntitiesClient();
    const entityId = id || newClientId();
    const code =
      input.code ??
      (id ? existing.find((e) => e.id === id)?.code : null) ??
      nextCodeFromList(existing);

    const record: EntityRecord = {
      id: entityId,
      code,
      name,
      entityKind: input.entityKind,
      roles: input.roles,
      taxId: input.taxId ?? "",
      address: input.address ?? "",
      phone: input.phone ?? "",
      email: input.email ?? "",
      branchHeadOffice: input.branchHeadOffice !== false,
      branchNo: input.branchNo ?? "",
      bankName: input.bankName ?? "",
      bankAccount: input.bankAccount ?? "",
      defaultWhtPercent: input.defaultWhtPercent ?? "3",
      notes: input.notes ?? "",
    };

    await setDoc(
      doc(db, firestoreCollections.entities, entityId),
      {
        ...record,
        updatedAt: serverTimestamp(),
        ...(id ? {} : { createdAt: serverTimestamp() }),
      },
      { merge: true },
    );

    return { ok: true, id: entityId };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (message.includes("permission") || message.includes("Permission")) {
      return {
        ok: false,
        message: "ไม่มีสิทธิ์บันทึก — ต้องเป็นผู้ดูแลระบบที่อนุมัติแล้ว",
      };
    }
    return { ok: false, message };
  }
}

export async function deleteEntityClient(
  id: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const db = getFirestoreDb();
  if (!db) {
    return { ok: false, message: "ยังไม่ได้ตั้งค่า Firebase" };
  }
  try {
    await deleteDoc(doc(db, firestoreCollections.entities, id));
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}
