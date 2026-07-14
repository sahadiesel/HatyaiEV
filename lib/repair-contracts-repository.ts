import { canWriteFirestore, FIRESTORE_WRITE_HINT } from "@/lib/data-primary";
import type {
  RepairContractKind,
  RepairContractRecord,
  RepairContractStatus,
} from "@/lib/domain-types";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { firestoreCollections } from "@/lib/firestore-collections";
import { newEntityId } from "@/lib/new-id";

function db() {
  return getAdminFirestore();
}

function parse(id: string, d: Record<string, unknown>): RepairContractRecord {
  return {
    id,
    code: typeof d.code === "string" ? d.code : null,
    kind: (d.kind as RepairContractKind) || "SERVICE_TO_CUSTOMER",
    title: String(d.title ?? ""),
    status: (d.status as RepairContractStatus) || "DRAFT",
    counterpartyEntityId: d.counterpartyEntityId ? String(d.counterpartyEntityId) : null,
    vehicleId: d.vehicleId ? String(d.vehicleId) : null,
    customerVehicleLabel: String(d.customerVehicleLabel ?? ""),
    symptoms: String(d.symptoms ?? ""),
    agreedPriceExVat: String(d.agreedPriceExVat ?? "0"),
    vatRate: String(d.vatRate ?? "7"),
    notes: String(d.notes ?? ""),
    issueDate: String(d.issueDate ?? ""),
  };
}

export async function listRepairContracts(): Promise<RepairContractRecord[]> {
  const firestore = db();
  if (!firestore) return [];
  try {
    const snap = await firestore.collection(firestoreCollections.repairContracts).orderBy("code", "desc").get();
    return snap.docs.map((doc) => parse(doc.id, doc.data() as Record<string, unknown>));
  } catch {
    try {
      const snap = await firestore.collection(firestoreCollections.repairContracts).get();
      return snap.docs
        .map((doc) => parse(doc.id, doc.data() as Record<string, unknown>))
        .sort((a, b) => String(b.code ?? "").localeCompare(String(a.code ?? "")));
    } catch (e) {
      console.error("[listRepairContracts]", e);
      return [];
    }
  }
}

export async function getRepairContract(id: string): Promise<RepairContractRecord | null> {
  const firestore = db();
  if (!firestore) return null;
  try {
    const snap = await firestore.collection(firestoreCollections.repairContracts).doc(id).get();
    if (!snap.exists) return null;
    return parse(snap.id, snap.data() as Record<string, unknown>);
  } catch {
    return null;
  }
}

async function nextCode(kind: RepairContractKind): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = kind === "SERVICE_TO_CUSTOMER" ? `RC-${year}-` : `OS-${year}-`;
  const rows = await listRepairContracts();
  let max = 0;
  for (const r of rows) {
    if (!r.code?.startsWith(prefix)) continue;
    const n = parseInt(r.code.slice(prefix.length), 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}

export async function createRepairContract(
  input: Omit<RepairContractRecord, "id" | "code"> & { code?: string },
) {
  if (!canWriteFirestore()) return { ok: false as const, message: FIRESTORE_WRITE_HINT };
  const firestore = db();
  if (!firestore) return { ok: false as const, message: FIRESTORE_WRITE_HINT };

  const code = input.code ?? (await nextCode(input.kind));
  const id = newEntityId();
  const record: RepairContractRecord = {
    id,
    code,
    kind: input.kind,
    title: input.title?.trim() || (input.kind === "SERVICE_TO_CUSTOMER" ? "สัญญารับจ้างซ่อม" : "สัญญาจ้างต่อ"),
    status: input.status || "DRAFT",
    counterpartyEntityId: input.counterpartyEntityId ?? null,
    vehicleId: input.vehicleId ?? null,
    customerVehicleLabel: input.customerVehicleLabel ?? "",
    symptoms: input.symptoms ?? "",
    agreedPriceExVat: input.agreedPriceExVat ?? "0",
    vatRate: input.vatRate ?? "7",
    notes: input.notes ?? "",
    issueDate: input.issueDate || new Date().toISOString().slice(0, 10),
  };

  await firestore.collection(firestoreCollections.repairContracts).doc(id).set({
    ...record,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return { ok: true as const, id };
}

export async function updateRepairContract(id: string, patch: Partial<Omit<RepairContractRecord, "id">>) {
  const existing = await getRepairContract(id);
  if (!existing) return { ok: false as const, message: "ไม่พบสัญญา" };
  if (!canWriteFirestore()) return { ok: false as const, message: FIRESTORE_WRITE_HINT };
  const firestore = db();
  if (!firestore) return { ok: false as const, message: FIRESTORE_WRITE_HINT };
  const next = { ...existing, ...patch, id };
  await firestore.collection(firestoreCollections.repairContracts).doc(id).set(
    { ...next, updatedAt: new Date() },
    { merge: true },
  );
  return { ok: true as const };
}

export async function deleteRepairContract(id: string) {
  if (!canWriteFirestore()) return { ok: false as const, message: FIRESTORE_WRITE_HINT };
  const firestore = db();
  if (!firestore) return { ok: false as const, message: FIRESTORE_WRITE_HINT };
  await firestore.collection(firestoreCollections.repairContracts).doc(id).delete();
  return { ok: true as const };
}
