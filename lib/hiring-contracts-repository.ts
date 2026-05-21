import type {
  ContractDocStatus,
  HiringContractFs,
  HiringContractInstallmentFs,
  HiringContractVehicleFs,
} from "./contracts-firestore-types";
import { canWriteFirestore, useFirestorePrimary } from "./data-primary";
import { getAdminFirestore } from "./firebase-admin";
import { firestoreCollections } from "./firestore";
import { newEntityId } from "./new-id";
import { nextHiringContractCode } from "./contractCodes";
import { getClient } from "./clients-repository";
import { prisma } from "./prisma";

function db() {
  return getAdminFirestore();
}

function asStatus(v: unknown): ContractDocStatus {
  if (v === "ACTIVE" || v === "COMPLETED" || v === "CANCELLED") return v;
  return "DRAFT";
}

function parseVehicle(raw: unknown, lineIndex: number): HiringContractVehicleFs {
  const d = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const et = d.engineType;
  const engineType =
    et === "DIESEL" || et === "ELECTRIC" ? et : "GASOLINE";
  return {
    id: String(d.id ?? newEntityId()),
    lineIndex: Number(d.lineIndex ?? lineIndex) || lineIndex,
    licensePlate: String(d.licensePlate ?? ""),
    brand: String(d.brand ?? ""),
    model: String(d.model ?? ""),
    year: String(d.year ?? ""),
    color: String(d.color ?? ""),
    engineType,
    engineSize: String(d.engineSize ?? ""),
    extraNotes: String(d.extraNotes ?? ""),
    contractPhotos: String(d.contractPhotos ?? "[]"),
    inspectionJson: String(d.inspectionJson ?? "[]"),
    billingJson: String(d.billingJson ?? "[]"),
  };
}

function parseInstallment(raw: unknown, sequence: number): HiringContractInstallmentFs {
  const d = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    sequence: Number(d.sequence ?? sequence) || sequence,
    label: String(d.label ?? ""),
    amount: String(d.amount ?? "0"),
    percent: String(d.percent ?? ""),
  };
}

function parseHiringDoc(id: string, d: Record<string, unknown>): HiringContractFs {
  const vehiclesRaw = Array.isArray(d.vehicles) ? d.vehicles : [];
  const instRaw = Array.isArray(d.installments) ? d.installments : [];
  return {
    id,
    code: String(d.code ?? ""),
    title: String(d.title ?? ""),
    clientId: String(d.clientId ?? ""),
    vehicleCount: Number(d.vehicleCount ?? 0) || 0,
    pricePerVehicleExVat: String(d.pricePerVehicleExVat ?? "0"),
    vatRate: String(d.vatRate ?? "7"),
    status: asStatus(d.status),
    notes: String(d.notes ?? ""),
    vehicles: vehiclesRaw.map((v, i) => parseVehicle(v, i + 1)),
    installments: instRaw.map((m, i) => parseInstallment(m, i + 1)),
  };
}

export async function listHiringContractsFromFirestore(): Promise<HiringContractFs[] | null> {
  const firestore = db();
  if (!firestore) return null;
  try {
    const snap = await firestore.collection(firestoreCollections.hiringContracts).get();
    return snap.docs.map((doc) => parseHiringDoc(doc.id, doc.data() as Record<string, unknown>));
  } catch {
    return null;
  }
}

export async function getHiringContractFirestore(id: string): Promise<HiringContractFs | null> {
  const firestore = db();
  if (!firestore) return null;
  try {
    const snap = await firestore.collection(firestoreCollections.hiringContracts).doc(id).get();
    if (!snap.exists) return null;
    return parseHiringDoc(snap.id, snap.data() as Record<string, unknown>);
  } catch {
    return null;
  }
}

export async function listHiringContractCodesFromFirestore(): Promise<string[]> {
  const rows = await listHiringContractsFromFirestore();
  if (!rows) return [];
  return rows.map((r) => r.code);
}

export async function countHiringContractsForClient(clientId: string): Promise<number> {
  const rows = await listHiringContractsFromFirestore();
  if (rows) return rows.filter((r) => r.clientId === clientId).length;
  try {
    return await prisma.hiringContract.count({ where: { clientId } });
  } catch {
    return 0;
  }
}

async function loadHiringFromPrisma(id: string): Promise<HiringContractFs | null> {
  const c = await prisma.hiringContract.findUnique({
    where: { id },
    include: { vehicles: { orderBy: { lineIndex: "asc" } }, installments: { orderBy: { sequence: "asc" } } },
  });
  if (!c) return null;
  return {
    id: c.id,
    code: c.code,
    title: c.title,
    clientId: c.clientId,
    vehicleCount: c.vehicleCount,
    pricePerVehicleExVat: c.pricePerVehicleExVat.toString(),
    vatRate: c.vatRate.toString(),
    status: c.status as ContractDocStatus,
    notes: c.notes,
    vehicles: c.vehicles.map((v) => ({
      id: v.id,
      lineIndex: v.lineIndex,
      licensePlate: v.licensePlate,
      brand: v.brand,
      model: v.model,
      year: v.year,
      color: v.color,
      engineType: v.engineType as HiringContractVehicleFs["engineType"],
      engineSize: v.engineSize,
      extraNotes: v.extraNotes,
      contractPhotos: v.contractPhotos,
      inspectionJson: v.inspectionJson,
      billingJson: v.billingJson,
    })),
    installments: c.installments.map((m) => ({
      sequence: m.sequence,
      label: m.label,
      amount: m.amount.toString(),
      percent: m.percent != null ? m.percent.toString() : "",
    })),
  };
}

export async function getHiringContract(id: string): Promise<HiringContractFs | null> {
  if (useFirestorePrimary()) {
    const fs = await getHiringContractFirestore(id);
    if (fs) return fs;
  }
  return loadHiringFromPrisma(id);
}

export type HiringContractListItem = HiringContractFs & { clientName: string };

export async function listHiringContracts(): Promise<HiringContractListItem[]> {
  let rows: HiringContractFs[] | null = null;
  if (useFirestorePrimary()) {
    rows = await listHiringContractsFromFirestore();
  }
  if (rows === null) {
    const prismaRows = await prisma.hiringContract.findMany({
      orderBy: { updatedAt: "desc" },
      include: { vehicles: true, installments: true },
    });
    rows = await Promise.all(
      prismaRows.map(async (c) => (await loadHiringFromPrisma(c.id))!),
    );
  }
  const out: HiringContractListItem[] = [];
  for (const r of rows) {
    const client = await getClient(r.clientId);
    out.push({ ...r, clientName: client?.name ?? "—" });
  }
  out.sort((a, b) => b.code.localeCompare(a.code));
  return out;
}

export async function saveHiringContractFirestore(doc: HiringContractFs): Promise<void> {
  const firestore = db();
  if (!firestore) throw new Error("Firestore Admin ไม่พร้อม");
  await firestore
    .collection(firestoreCollections.hiringContracts)
    .doc(doc.id)
    .set({ ...doc, updatedAt: new Date() }, { merge: true });
}

export async function createHiringContractDraft(input: { title: string; clientId: string }) {
  if (!canWriteFirestore()) {
    throw new Error("ไม่สามารถบันทึก Firestore ได้");
  }
  for (let attempt = 0; attempt < 12; attempt++) {
    const code = await nextHiringContractCode();
    const id = newEntityId();
    const doc: HiringContractFs = {
      id,
      code,
      title: input.title.trim() || code,
      clientId: input.clientId,
      vehicleCount: 0,
      pricePerVehicleExVat: "0",
      vatRate: "7",
      status: "DRAFT",
      notes: "",
      vehicles: [],
      installments: [],
    };
    const dup = (await listHiringContractsFromFirestore())?.some((c) => c.code === code);
    if (dup) continue;
    await saveHiringContractFirestore(doc);
    return doc;
  }
  throw new Error("ไม่สามารถสร้างเลขที่สัญญารับจ้างได้");
}

export type SaveHiringContractInput = {
  id: string;
  title: string;
  clientId: string;
  vehicleCount: number;
  pricePerVehicleExVat: string;
  vatRate: string;
  notes: string;
  status: ContractDocStatus;
  vehicles: Omit<HiringContractVehicleFs, "inspectionJson" | "billingJson"> & {
    inspectionJson?: string;
    billingJson?: string;
  }[];
  installments: HiringContractInstallmentFs[];
};

export async function saveHiringContract(input: SaveHiringContractInput) {
  const existing = await getHiringContract(input.id);
  if (!existing) return { ok: false as const, message: "ไม่พบสัญญา" };
  if (!input.clientId) return { ok: false as const, message: "เลือกผู้ว่าจ้าง" };

  const oldByLine = new Map(existing.vehicles.map((v) => [v.lineIndex, v]));
  const vehicles: HiringContractVehicleFs[] = [];
  for (let lineIndex = 1; lineIndex <= input.vehicleCount; lineIndex++) {
    const incoming = input.vehicles.find((v) => Number(v.lineIndex) === lineIndex);
    const prev = oldByLine.get(lineIndex);
    const engineType =
      incoming?.engineType === "DIESEL" || incoming?.engineType === "ELECTRIC"
        ? incoming.engineType
        : "GASOLINE";
    vehicles.push({
      id: incoming?.id || prev?.id || newEntityId(),
      lineIndex,
      licensePlate: String(incoming?.licensePlate ?? prev?.licensePlate ?? ""),
      brand: String(incoming?.brand ?? prev?.brand ?? ""),
      model: String(incoming?.model ?? prev?.model ?? ""),
      year: String(incoming?.year ?? prev?.year ?? ""),
      color: String(incoming?.color ?? prev?.color ?? ""),
      engineType,
      engineSize: String(incoming?.engineSize ?? prev?.engineSize ?? ""),
      extraNotes: String(incoming?.extraNotes ?? prev?.extraNotes ?? ""),
      contractPhotos: String(incoming?.contractPhotos ?? prev?.contractPhotos ?? "[]"),
      inspectionJson: prev?.inspectionJson ?? "[]",
      billingJson: prev?.billingJson ?? "[]",
    });
  }

  const doc: HiringContractFs = {
    ...existing,
    title: input.title.trim(),
    clientId: input.clientId,
    vehicleCount: input.vehicleCount,
    pricePerVehicleExVat: input.pricePerVehicleExVat,
    vatRate: input.vatRate,
    notes: input.notes,
    status: input.status,
    vehicles,
    installments: input.installments,
  };

  if (!canWriteFirestore()) {
    return { ok: false as const, message: "ไม่สามารถบันทึก Firestore ได้" };
  }

  await saveHiringContractFirestore(doc);
  const totalExVat =
    parseFloat(doc.pricePerVehicleExVat.replace(/,/g, "") || "0") * doc.vehicleCount;
  return { ok: true as const, totalExVat: String(totalExVat) };
}

export async function updateHiringVehicleJson(
  contractId: string,
  lineIndex: number,
  patch: { inspectionJson?: string; billingJson?: string },
) {
  const doc = await getHiringContract(contractId);
  if (!doc) return { ok: false as const, message: "ไม่พบสัญญา" };
  const v = doc.vehicles.find((x) => x.lineIndex === lineIndex);
  if (!v) return { ok: false as const, message: "ไม่พบรายการรถ" };
  if (patch.inspectionJson !== undefined) v.inspectionJson = patch.inspectionJson;
  if (patch.billingJson !== undefined) v.billingJson = patch.billingJson;
  if (!canWriteFirestore()) return { ok: false as const, message: "บันทึก Firestore ไม่ได้" };
  await saveHiringContractFirestore(doc);
  return { ok: true as const };
}

export async function getHiringContractVehicle(contractId: string, lineIndex: number) {
  const doc = await getHiringContract(contractId);
  if (!doc) return null;
  const vehicle = doc.vehicles.find((v) => v.lineIndex === lineIndex);
  if (!vehicle) return null;
  return {
    ...vehicle,
    hiringContract: {
      id: doc.id,
      code: doc.code,
      title: doc.title,
      pricePerVehicleExVat: doc.pricePerVehicleExVat,
      vatRate: doc.vatRate,
    },
  };
}
