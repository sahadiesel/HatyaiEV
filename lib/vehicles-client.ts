"use client";

import { collection, doc, getDocs, serverTimestamp, setDoc } from "firebase/firestore";
import type {
  VehicleCostLine,
  VehiclePurchaseType,
  VehicleRecord,
  VehicleStatus,
} from "@/lib/domain-types";
import { getFirestoreDb } from "@/lib/firebase";
import { firestoreCollections } from "@/lib/firestore-collections";

function parseCostLines(raw: unknown): VehicleCostLine[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((l) => {
    const row = l as Record<string, unknown>;
    return {
      id: String(row.id ?? ""),
      date: String(row.date ?? ""),
      category: (row.category as VehicleCostLine["category"]) || "OTHER",
      description: String(row.description ?? ""),
      amount: String(row.amount ?? "0"),
      documentId: row.documentId ? String(row.documentId) : null,
      createdAt: row.createdAt ? String(row.createdAt) : undefined,
    };
  });
}

export function parseVehicleRecord(id: string, d: Record<string, unknown>): VehicleRecord {
  return {
    id,
    code: typeof d.code === "string" ? d.code : null,
    licensePlate: String(d.licensePlate ?? ""),
    brand: String(d.brand ?? ""),
    model: String(d.model ?? ""),
    year: String(d.year ?? ""),
    color: String(d.color ?? ""),
    vin: String(d.vin ?? ""),
    engineNo: String(d.engineNo ?? ""),
    mileage: String(d.mileage ?? ""),
    status: (d.status as VehicleStatus) || "IN_STOCK",
    purchaseType: (d.purchaseType as VehiclePurchaseType) || "INDIVIDUAL_NO_VAT",
    sellerEntityId: d.sellerEntityId ? String(d.sellerEntityId) : null,
    purchaseDate: String(d.purchaseDate ?? ""),
    purchasePrice: String(d.purchasePrice ?? "0"),
    purchaseContractAmount: String(d.purchaseContractAmount ?? d.purchasePrice ?? "0"),
    saleContractAmount: String(d.saleContractAmount ?? d.expectedSalePrice ?? "0"),
    costLines: parseCostLines(d.costLines ?? d.costLinesJson),
    expectedSalePrice: String(d.expectedSalePrice ?? "0"),
    commissionAmount: String(d.commissionAmount ?? "0"),
    soldDate: String(d.soldDate ?? ""),
    soldPrice: String(d.soldPrice ?? "0"),
    buyerEntityId: d.buyerEntityId ? String(d.buyerEntityId) : null,
    notes: String(d.notes ?? ""),
  };
}

export async function listVehiclesClient(): Promise<VehicleRecord[]> {
  const db = getFirestoreDb();
  if (!db) return [];
  try {
    const snap = await getDocs(collection(db, firestoreCollections.vehicles));
    return snap.docs
      .map((d) => parseVehicleRecord(d.id, d.data() as Record<string, unknown>))
      .sort((a, b) => (a.licensePlate || a.code || "").localeCompare(b.licensePlate || b.code || "", "th"));
  } catch (e) {
    console.error("[listVehiclesClient]", e);
    return [];
  }
}

export async function updateVehicleFieldsClient(
  id: string,
  patch: Partial<
    Pick<
      VehicleRecord,
      "saleContractAmount" | "purchaseContractAmount" | "expectedSalePrice" | "soldPrice"
    >
  >,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const db = getFirestoreDb();
  if (!db) return { ok: false, message: "ยังไม่ได้ตั้งค่า Firebase" };
  try {
    await setDoc(
      doc(db, firestoreCollections.vehicles, id),
      { ...patch, updatedAt: serverTimestamp() },
      { merge: true },
    );
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}
