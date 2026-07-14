import { canWriteFirestore, FIRESTORE_WRITE_HINT } from "@/lib/data-primary";
import type {
  VehicleCostLine,
  VehiclePurchaseType,
  VehicleRecord,
  VehicleStatus,
} from "@/lib/domain-types";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { firestoreCollections } from "@/lib/firestore-collections";
import { newEntityId } from "@/lib/new-id";

function db() {
  return getAdminFirestore();
}

function parseCostLines(raw: unknown): VehicleCostLine[] {
  if (!Array.isArray(raw)) {
    if (typeof raw === "string" && raw.trim()) {
      try {
        return parseCostLines(JSON.parse(raw));
      } catch {
        return [];
      }
    }
    return [];
  }
  return raw.map((l) => {
    const row = l as Record<string, unknown>;
    return {
      id: String(row.id ?? newEntityId()),
      date: String(row.date ?? ""),
      category: (row.category as VehicleCostLine["category"]) || "OTHER",
      description: String(row.description ?? ""),
      amount: String(row.amount ?? "0"),
      documentId: row.documentId ? String(row.documentId) : null,
      createdAt: row.createdAt ? String(row.createdAt) : undefined,
    };
  });
}

function parseVehicle(id: string, d: Record<string, unknown>): VehicleRecord {
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
    costLines: parseCostLines(d.costLines ?? d.costLinesJson),
    expectedSalePrice: String(d.expectedSalePrice ?? "0"),
    commissionAmount: String(d.commissionAmount ?? "0"),
    soldDate: String(d.soldDate ?? ""),
    soldPrice: String(d.soldPrice ?? "0"),
    buyerEntityId: d.buyerEntityId ? String(d.buyerEntityId) : null,
    notes: String(d.notes ?? ""),
  };
}

function toPayload(v: VehicleRecord) {
  return {
    code: v.code,
    licensePlate: v.licensePlate,
    brand: v.brand,
    model: v.model,
    year: v.year,
    color: v.color,
    vin: v.vin,
    engineNo: v.engineNo,
    mileage: v.mileage,
    status: v.status,
    purchaseType: v.purchaseType,
    sellerEntityId: v.sellerEntityId,
    purchaseDate: v.purchaseDate,
    purchasePrice: v.purchasePrice,
    costLines: v.costLines,
    expectedSalePrice: v.expectedSalePrice,
    commissionAmount: v.commissionAmount,
    soldDate: v.soldDate,
    soldPrice: v.soldPrice,
    buyerEntityId: v.buyerEntityId,
    notes: v.notes,
    updatedAt: new Date(),
  };
}

export async function listVehicles(): Promise<VehicleRecord[]> {
  const firestore = db();
  if (!firestore) return [];
  try {
    const snap = await firestore.collection(firestoreCollections.vehicles).orderBy("code", "desc").get();
    return snap.docs.map((doc) => parseVehicle(doc.id, doc.data() as Record<string, unknown>));
  } catch {
    try {
      const snap = await firestore.collection(firestoreCollections.vehicles).get();
      return snap.docs
        .map((doc) => parseVehicle(doc.id, doc.data() as Record<string, unknown>))
        .sort((a, b) => String(b.code ?? "").localeCompare(String(a.code ?? "")));
    } catch (e) {
      console.error("[listVehicles]", e);
      return [];
    }
  }
}

export async function getVehicle(id: string): Promise<VehicleRecord | null> {
  const firestore = db();
  if (!firestore) return null;
  try {
    const snap = await firestore.collection(firestoreCollections.vehicles).doc(id).get();
    if (!snap.exists) return null;
    return parseVehicle(snap.id, snap.data() as Record<string, unknown>);
  } catch {
    return null;
  }
}

async function nextVehicleCode(): Promise<string> {
  const year = new Date().getFullYear();
  const rows = await listVehicles();
  const prefix = `VH-${year}-`;
  let max = 0;
  for (const r of rows) {
    if (!r.code?.startsWith(prefix)) continue;
    const n = parseInt(r.code.slice(prefix.length), 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}

export async function createVehicle(
  input: Omit<VehicleRecord, "id" | "code" | "costLines"> & { code?: string; costLines?: VehicleCostLine[] },
) {
  if (!canWriteFirestore()) return { ok: false as const, message: FIRESTORE_WRITE_HINT };
  const firestore = db();
  if (!firestore) return { ok: false as const, message: FIRESTORE_WRITE_HINT };

  for (let attempt = 0; attempt < 12; attempt++) {
    const code = input.code ?? (await nextVehicleCode());
    const id = newEntityId();
    const record: VehicleRecord = {
      id,
      code,
      licensePlate: input.licensePlate ?? "",
      brand: input.brand ?? "",
      model: input.model ?? "",
      year: input.year ?? "",
      color: input.color ?? "",
      vin: input.vin ?? "",
      engineNo: input.engineNo ?? "",
      mileage: input.mileage ?? "",
      status: input.status ?? "IN_STOCK",
      purchaseType: input.purchaseType ?? "INDIVIDUAL_NO_VAT",
      sellerEntityId: input.sellerEntityId ?? null,
      purchaseDate: input.purchaseDate ?? new Date().toISOString().slice(0, 10),
      purchasePrice: input.purchasePrice ?? "0",
      costLines: input.costLines ?? [],
      expectedSalePrice: input.expectedSalePrice ?? "0",
      commissionAmount: input.commissionAmount ?? "0",
      soldDate: input.soldDate ?? "",
      soldPrice: input.soldPrice ?? "0",
      buyerEntityId: input.buyerEntityId ?? null,
      notes: input.notes ?? "",
    };
    try {
      const dup = (await listVehicles()).some((v) => v.code === code);
      if (dup) continue;
      await firestore.collection(firestoreCollections.vehicles).doc(id).set({
        ...toPayload(record),
        createdAt: new Date(),
      });
      return { ok: true as const, id };
    } catch (e) {
      if (attempt === 11) {
        return { ok: false as const, message: e instanceof Error ? e.message : "บันทึกไม่สำเร็จ" };
      }
    }
  }
  return { ok: false as const, message: "ไม่สามารถออกรหัสรถได้" };
}

export async function updateVehicle(id: string, patch: Partial<Omit<VehicleRecord, "id">>) {
  const existing = await getVehicle(id);
  if (!existing) return { ok: false as const, message: "ไม่พบรถคันนี้" };
  if (!canWriteFirestore()) return { ok: false as const, message: FIRESTORE_WRITE_HINT };
  const firestore = db();
  if (!firestore) return { ok: false as const, message: FIRESTORE_WRITE_HINT };

  const next: VehicleRecord = { ...existing, ...patch, id };
  await firestore.collection(firestoreCollections.vehicles).doc(id).set(toPayload(next), { merge: true });
  return { ok: true as const };
}

export async function addVehicleCostLine(
  vehicleId: string,
  line: Omit<VehicleCostLine, "id" | "createdAt">,
) {
  const existing = await getVehicle(vehicleId);
  if (!existing) return { ok: false as const, message: "ไม่พบรถคันนี้" };
  if (!canWriteFirestore()) return { ok: false as const, message: FIRESTORE_WRITE_HINT };

  const newLine: VehicleCostLine = {
    id: newEntityId(),
    date: line.date || new Date().toISOString().slice(0, 10),
    category: line.category || "OTHER",
    description: line.description || "",
    amount: String(line.amount || "0"),
    documentId: line.documentId ?? null,
    createdAt: new Date().toISOString(),
  };
  const costLines = [...existing.costLines, newLine];
  const result = await updateVehicle(vehicleId, { costLines });
  if (!result.ok) return result;
  return { ok: true as const, line: newLine };
}

export async function removeVehicleCostLine(vehicleId: string, lineId: string) {
  const existing = await getVehicle(vehicleId);
  if (!existing) return { ok: false as const, message: "ไม่พบรถคันนี้" };
  const costLines = existing.costLines.filter((l) => l.id !== lineId);
  return updateVehicle(vehicleId, { costLines });
}

export async function deleteVehicle(id: string) {
  if (!canWriteFirestore()) return { ok: false as const, message: FIRESTORE_WRITE_HINT };
  const firestore = db();
  if (!firestore) return { ok: false as const, message: FIRESTORE_WRITE_HINT };
  await firestore.collection(firestoreCollections.vehicles).doc(id).delete();
  return { ok: true as const };
}
