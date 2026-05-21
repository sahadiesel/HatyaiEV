import type {
  ContractDocStatus,
  SubcontractAgreementFs,
  SubcontractInstallmentFs,
} from "./contracts-firestore-types";
import { canWriteFirestore, useFirestorePrimary } from "./data-primary";
import { getAdminFirestore } from "./firebase-admin";
import { firestoreCollections } from "./firestore";
import { newEntityId } from "./new-id";
import { nextSubcontractAgreementCode } from "./contractCodes";
import { getContractor } from "./contractors-repository";
import { getHiringContract, listHiringContracts } from "./hiring-contracts-repository";
import { prisma } from "./prisma";

function db() {
  return getAdminFirestore();
}

function asStatus(v: unknown): ContractDocStatus {
  if (v === "ACTIVE" || v === "COMPLETED" || v === "CANCELLED") return v;
  return "DRAFT";
}

function parseInstallment(raw: unknown, sequence: number): SubcontractInstallmentFs {
  const d = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    sequence: Number(d.sequence ?? sequence) || sequence,
    label: String(d.label ?? ""),
    amount: String(d.amount ?? "0"),
    percent: String(d.percent ?? ""),
  };
}

function parseSubcontractDoc(id: string, d: Record<string, unknown>): SubcontractAgreementFs {
  const instRaw = Array.isArray(d.installments) ? d.installments : [];
  const selected = Array.isArray(d.selectedVehicleIds) ? d.selectedVehicleIds.map(String) : [];
  return {
    id,
    code: String(d.code ?? ""),
    title: String(d.title ?? ""),
    contractorId: String(d.contractorId ?? ""),
    hiringContractId: String(d.hiringContractId ?? ""),
    vehicleCount: Number(d.vehicleCount ?? 0) || 0,
    pricePerVehicleExVat: String(d.pricePerVehicleExVat ?? "0"),
    vatRate: String(d.vatRate ?? "7"),
    status: asStatus(d.status),
    notes: String(d.notes ?? ""),
    selectedVehicleIds: selected,
    installments: instRaw.map((m, i) => parseInstallment(m, i + 1)),
  };
}

export async function listSubcontractAgreementsFromFirestore(): Promise<SubcontractAgreementFs[] | null> {
  const firestore = db();
  if (!firestore) return null;
  try {
    const snap = await firestore.collection(firestoreCollections.subcontractAgreements).get();
    return snap.docs.map((doc) => parseSubcontractDoc(doc.id, doc.data() as Record<string, unknown>));
  } catch {
    return null;
  }
}

export async function getSubcontractAgreementFirestore(id: string): Promise<SubcontractAgreementFs | null> {
  const firestore = db();
  if (!firestore) return null;
  try {
    const snap = await firestore.collection(firestoreCollections.subcontractAgreements).doc(id).get();
    if (!snap.exists) return null;
    return parseSubcontractDoc(snap.id, snap.data() as Record<string, unknown>);
  } catch {
    return null;
  }
}

export async function listSubcontractAgreementCodesFromFirestore(): Promise<string[]> {
  const rows = await listSubcontractAgreementsFromFirestore();
  if (!rows) return [];
  return rows.map((r) => r.code);
}

async function loadSubcontractFromPrisma(id: string): Promise<SubcontractAgreementFs | null> {
  const a = await prisma.subcontractAgreement.findUnique({
    where: { id },
    include: {
      installments: { orderBy: { sequence: "asc" } },
      vehicles: true,
    },
  });
  if (!a) return null;
  return {
    id: a.id,
    code: a.code,
    title: a.title,
    contractorId: a.contractorId,
    hiringContractId: a.hiringContractId,
    vehicleCount: a.vehicleCount,
    pricePerVehicleExVat: a.pricePerVehicleExVat.toString(),
    vatRate: a.vatRate.toString(),
    status: a.status as ContractDocStatus,
    notes: a.notes,
    selectedVehicleIds: a.vehicles.map((v) => v.hiringContractVehicleId),
    installments: a.installments.map((m) => ({
      sequence: m.sequence,
      label: m.label,
      amount: m.amount.toString(),
      percent: m.percent != null ? m.percent.toString() : "",
    })),
  };
}

export async function getSubcontractAgreement(id: string): Promise<SubcontractAgreementFs | null> {
  if (useFirestorePrimary()) {
    const fs = await getSubcontractAgreementFirestore(id);
    if (fs) return fs;
  }
  return loadSubcontractFromPrisma(id);
}

export type SubcontractListItem = SubcontractAgreementFs & {
  contractorName: string;
  hiringContractCode: string;
};

export async function listSubcontractAgreements(): Promise<SubcontractListItem[]> {
  let rows: SubcontractAgreementFs[] | null = null;
  if (useFirestorePrimary()) {
    rows = await listSubcontractAgreementsFromFirestore();
  }
  if (rows === null) {
    const prismaRows = await prisma.subcontractAgreement.findMany({
      orderBy: { updatedAt: "desc" },
    });
    rows = (
      await Promise.all(prismaRows.map((r) => loadSubcontractFromPrisma(r.id)))
    ).filter((x): x is SubcontractAgreementFs => x != null);
  }

  const hiringList = await listHiringContracts();
  const hiringById = new Map(hiringList.map((h) => [h.id, h]));

  const out: SubcontractListItem[] = [];
  for (const r of rows) {
    const contractor = await getContractor(r.contractorId);
    const hiring = hiringById.get(r.hiringContractId);
    out.push({
      ...r,
      contractorName: contractor?.name ?? "—",
      hiringContractCode: hiring?.code ?? "—",
    });
  }
  out.sort((a, b) => b.code.localeCompare(a.code));
  return out;
}

async function saveSubcontractFirestore(doc: SubcontractAgreementFs): Promise<void> {
  const firestore = db();
  if (!firestore) throw new Error("Firestore Admin ไม่พร้อม");
  await firestore
    .collection(firestoreCollections.subcontractAgreements)
    .doc(doc.id)
    .set({ ...doc, updatedAt: new Date() }, { merge: true });
}

export async function createSubcontractAgreementDraft(input: {
  title: string;
  contractorId: string;
  hiringContractId: string;
}) {
  if (!canWriteFirestore()) throw new Error("ไม่สามารถบันทึก Firestore ได้");
  const hiring = await getHiringContract(input.hiringContractId);
  if (!hiring) throw new Error("ไม่พบสัญญารับจ้าง");

  for (let attempt = 0; attempt < 12; attempt++) {
    const code = await nextSubcontractAgreementCode();
    const id = newEntityId();
    const doc: SubcontractAgreementFs = {
      id,
      code,
      title: input.title.trim() || code,
      contractorId: input.contractorId,
      hiringContractId: input.hiringContractId,
      vehicleCount: 0,
      pricePerVehicleExVat: "0",
      vatRate: "7",
      status: "DRAFT",
      notes: "",
      selectedVehicleIds: [],
      installments: [],
    };
    const dup = (await listSubcontractAgreementsFromFirestore())?.some((c) => c.code === code);
    if (dup) continue;
    await saveSubcontractFirestore(doc);
    return doc;
  }
  throw new Error("ไม่สามารถสร้างเลขที่สัญญาว่าจ้างได้");
}

export type SaveSubcontractInput = {
  id: string;
  title: string;
  contractorId: string;
  hiringContractId: string;
  vehicleCount: number;
  pricePerVehicleExVat: string;
  vatRate: string;
  notes: string;
  status: ContractDocStatus;
  selectedVehicleIds: string[];
  installments: SubcontractInstallmentFs[];
};

export async function saveSubcontractAgreement(input: SaveSubcontractInput) {
  const existing = await getSubcontractAgreement(input.id);
  if (!existing) return { ok: false as const, message: "ไม่พบสัญญา" };
  if (!input.contractorId) return { ok: false as const, message: "เลือกผู้รับเหมา" };
  if (!input.hiringContractId) return { ok: false as const, message: "เลือกสัญญารับจ้าง" };

  const hiring = await getHiringContract(input.hiringContractId);
  if (!hiring) return { ok: false as const, message: "ไม่พบสัญญารับจ้าง" };

  const validIds = new Set(hiring.vehicles.map((v) => v.id));
  const selected = input.selectedVehicleIds.filter((id) => validIds.has(id));

  const doc: SubcontractAgreementFs = {
    ...existing,
    title: input.title.trim(),
    contractorId: input.contractorId,
    hiringContractId: input.hiringContractId,
    vehicleCount: input.vehicleCount,
    pricePerVehicleExVat: input.pricePerVehicleExVat,
    vatRate: input.vatRate,
    notes: input.notes,
    status: input.status,
    selectedVehicleIds: selected,
    installments: input.installments,
  };

  if (!canWriteFirestore()) {
    return { ok: false as const, message: "ไม่สามารถบันทึก Firestore ได้" };
  }

  await saveSubcontractFirestore(doc);
  const totalExVat =
    parseFloat(doc.pricePerVehicleExVat.replace(/,/g, "") || "0") * doc.vehicleCount;
  return { ok: true as const, totalExVat: String(totalExVat) };
}
