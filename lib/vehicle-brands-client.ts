"use client";

import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { getFirestoreDb } from "@/lib/firebase";
import { firestoreCollections } from "@/lib/firestore-collections";

export type VehicleBrandRecord = {
  id: string;
  name: string;
  /** รุ่นย่อย เช่น Altis, Vigo */
  models: string[];
  sortOrder: number;
};

function newClientId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, "").slice(0, 20);
  }
  return `b${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function parseBrand(id: string, d: Record<string, unknown>): VehicleBrandRecord {
  const modelsRaw = d.models;
  const models = Array.isArray(modelsRaw)
    ? modelsRaw.map(String).map((s) => s.trim()).filter(Boolean)
    : typeof modelsRaw === "string" && modelsRaw.trim()
      ? modelsRaw.split(/[\n,]/).map((s) => s.trim()).filter(Boolean)
      : [];
  return {
    id,
    name: String(d.name ?? "").trim(),
    models,
    sortOrder: typeof d.sortOrder === "number" ? d.sortOrder : 0,
  };
}

export async function listVehicleBrandsClient(): Promise<VehicleBrandRecord[]> {
  const db = getFirestoreDb();
  if (!db) return [];
  try {
    const snap = await getDocs(collection(db, firestoreCollections.vehicleBrands));
    return snap.docs
      .map((d) => parseBrand(d.id, d.data() as Record<string, unknown>))
      .filter((b) => b.name)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "th"));
  } catch (e) {
    console.error("[listVehicleBrandsClient]", e);
    return [];
  }
}

export async function saveVehicleBrandClient(
  input: { id?: string | null; name: string; models: string[]; sortOrder?: number },
): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const db = getFirestoreDb();
  if (!db) return { ok: false, message: "ยังไม่ได้ตั้งค่า Firebase" };
  const name = input.name.trim();
  if (!name) return { ok: false, message: "กรอกชื่อยี่ห้อ" };
  const models = input.models.map((m) => m.trim()).filter(Boolean);
  if (models.length === 0) return { ok: false, message: "เพิ่มรุ่นย่อยอย่างน้อย 1 รุ่น" };

  try {
    const existing = await listVehicleBrandsClient();
    const dup = existing.find(
      (b) => b.name.toLowerCase() === name.toLowerCase() && b.id !== input.id,
    );
    if (dup) return { ok: false, message: `ยี่ห้อ "${name}" มีอยู่แล้ว` };

    const id = input.id || newClientId();
    const sortOrder =
      input.sortOrder ??
      (input.id ? existing.find((b) => b.id === input.id)?.sortOrder : undefined) ??
      existing.length;

    await setDoc(
      doc(db, firestoreCollections.vehicleBrands, id),
      {
        name,
        models,
        sortOrder,
        updatedAt: serverTimestamp(),
        ...(input.id ? {} : { createdAt: serverTimestamp() }),
      },
      { merge: true },
    );
    return { ok: true, id };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (message.toLowerCase().includes("permission")) {
      return { ok: false, message: "ไม่มีสิทธิ์บันทึก — ต้องเป็นผู้ดูแลระบบ" };
    }
    return { ok: false, message };
  }
}

export async function deleteVehicleBrandClient(
  id: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const db = getFirestoreDb();
  if (!db) return { ok: false, message: "ยังไม่ได้ตั้งค่า Firebase" };
  try {
    await deleteDoc(doc(db, firestoreCollections.vehicleBrands, id));
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}
