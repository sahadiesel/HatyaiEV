import {
  deleteContractorFirestore,
  getContractorFirestore,
  listContractorsFromFirestore,
  upsertContractorFirestore,
  type ContractorRecord,
} from "./firestore-entities";
import { Prisma } from "@prisma/client";
import {
  canWriteFirestore,
  FIRESTORE_WRITE_HINT,
  isFirestorePrimary,
} from "./data-primary";
import { countSubcontractAgreementsForContractor } from "./subcontract-agreements-repository";
import { newEntityId } from "./new-id";
import { nextContractorCode } from "./partyCodes";
import { prisma } from "./prisma";

export type { ContractorRecord };

export async function listContractors(): Promise<ContractorRecord[]> {
  if (isFirestorePrimary()) {
    return (await listContractorsFromFirestore()) ?? [];
  }
  const rows = await prisma.contractor.findMany({ orderBy: { name: "asc" } });
  return rows.map((c) => ({
    id: c.id,
    code: c.code,
    name: c.name,
    taxId: c.taxId,
    address: c.address,
    phone: c.phone,
    email: c.email,
    bankName: c.bankName,
    bankAccount: c.bankAccount,
    defaultWhtPercent: String(c.defaultWhtPercent),
    notes: c.notes,
  }));
}

export async function getContractor(id: string): Promise<ContractorRecord | null> {
  if (isFirestorePrimary()) {
    return getContractorFirestore(id);
  }
  const row = await prisma.contractor.findUnique({ where: { id } });
  if (!row) return null;
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    taxId: row.taxId,
    address: row.address,
    phone: row.phone,
    email: row.email,
    bankName: row.bankName,
    bankAccount: row.bankAccount,
    defaultWhtPercent: String(row.defaultWhtPercent),
    notes: row.notes,
  };
}

export async function createContractorRecord(input: {
  name: string;
  taxId?: string;
  address?: string;
  phone?: string;
  email?: string;
  bankName?: string;
  bankAccount?: string;
  defaultWhtPercent?: string;
  notes?: string;
}) {
  const name = input.name.trim();
  if (!name) return { ok: false as const, message: "กรอกชื่อ / บริษัท" };

  if (isFirestorePrimary() && !canWriteFirestore()) {
    return { ok: false as const, message: FIRESTORE_WRITE_HINT };
  }

  const wht = (input.defaultWhtPercent ?? "1").replace(",", ".");

  if (isFirestorePrimary()) {
    for (let attempt = 0; attempt < 12; attempt++) {
      const code = await nextContractorCode();
      const id = newEntityId();
      const record: ContractorRecord = {
        id,
        code,
        name,
        taxId: input.taxId ?? "",
        address: input.address ?? "",
        phone: input.phone ?? "",
        email: input.email ?? "",
        bankName: input.bankName ?? "",
        bankAccount: input.bankAccount ?? "",
        defaultWhtPercent: wht || "1",
        notes: input.notes ?? "",
      };
      try {
        const dupCode = (await listContractorsFromFirestore())?.some((c) => c.code === code);
        if (dupCode) continue;
        await upsertContractorFirestore(record);
        return { ok: true as const, id };
      } catch (e) {
        if (attempt === 11) {
          return { ok: false as const, message: e instanceof Error ? e.message : "บันทึกไม่สำเร็จ" };
        }
      }
    }
    return { ok: false as const, message: "ไม่สามารถออกเลขที่ผู้รับเหมาได้" };
  }

  const code = await nextContractorCode();
  const id = newEntityId();
  try {
    await prisma.contractor.create({
      data: {
        id,
        code,
        name,
        taxId: input.taxId ?? "",
        address: input.address ?? "",
        phone: input.phone ?? "",
        email: input.email ?? "",
        bankName: input.bankName ?? "",
        bankAccount: input.bankAccount ?? "",
        defaultWhtPercent: new Prisma.Decimal(wht || "1"),
        notes: input.notes ?? "",
      },
    });
    return { ok: true as const, id };
  } catch (e) {
    return { ok: false as const, message: e instanceof Error ? e.message : "บันทึกไม่สำเร็จ" };
  }
}

export async function updateContractorRecord(
  id: string,
  input: {
    name: string;
    taxId?: string;
    address?: string;
    phone?: string;
    email?: string;
    bankName?: string;
    bankAccount?: string;
    defaultWhtPercent?: string;
    notes?: string;
  },
) {
  const existing = await getContractor(id);
  if (!existing) return { ok: false as const, message: "ไม่พบข้อมูล" };
  const name = input.name.trim();
  if (!name) return { ok: false as const, message: "กรอกชื่อ / บริษัท" };

  const wht = (input.defaultWhtPercent ?? existing.defaultWhtPercent).replace(",", ".");

  const record: ContractorRecord = {
    id,
    code: existing.code,
    name,
    taxId: input.taxId ?? "",
    address: input.address ?? "",
    phone: input.phone ?? "",
    email: input.email ?? "",
    bankName: input.bankName ?? "",
    bankAccount: input.bankAccount ?? "",
    defaultWhtPercent: wht || "1",
    notes: input.notes ?? "",
  };

  if (isFirestorePrimary()) {
    if (!canWriteFirestore()) return { ok: false as const, message: FIRESTORE_WRITE_HINT };
    await upsertContractorFirestore(record);
    return { ok: true as const };
  }

  try {
    await prisma.contractor.upsert({
      where: { id },
      create: { ...record, defaultWhtPercent: new Prisma.Decimal(wht || "1") },
      update: { ...record, defaultWhtPercent: new Prisma.Decimal(wht || "1") },
    });
    return { ok: true as const };
  } catch {
    return { ok: false as const, message: "บันทึกไม่สำเร็จ" };
  }
}

export async function deleteContractorRecord(id: string) {
  const existing = await getContractor(id);
  if (!existing) return { ok: false as const, message: "ไม่พบข้อมูล" };

  const subCount = await countSubcontractAgreementsForContractor(id);
  if (subCount > 0) {
    return {
      ok: false as const,
      message: "ลบไม่ได้ — มีสัญญาว่าจ้างผูกกับผู้รับเหมารายนี้",
    };
  }

  if (isFirestorePrimary()) {
    if (!canWriteFirestore()) return { ok: false as const, message: FIRESTORE_WRITE_HINT };
    await deleteContractorFirestore(id);
    return { ok: true as const };
  }

  try {
    await prisma.contractor.delete({ where: { id } });
    return { ok: true as const };
  } catch {
    return { ok: false as const, message: "ลบไม่สำเร็จ" };
  }
}
