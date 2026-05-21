import {
  deleteContractorFirestore,
  getContractorFirestore,
  listContractorsFromFirestore,
  upsertContractorFirestore,
  type ContractorRecord,
} from "./firestore-entities";
import { Prisma } from "@prisma/client";
import { canWriteFirestore, useFirestorePrimary } from "./data-primary";
import { newEntityId } from "./new-id";
import { nextContractorCode } from "./partyCodes";
import { prisma } from "./prisma";

export type { ContractorRecord };

export async function listContractors(): Promise<ContractorRecord[]> {
  if (useFirestorePrimary()) {
    const fs = await listContractorsFromFirestore();
    if (fs !== null) return fs;
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
  if (useFirestorePrimary()) {
    const fs = await getContractorFirestore(id);
    if (fs) return fs;
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

  if (!canWriteFirestore()) {
    return { ok: false as const, message: "ไม่สามารถบันทึก Firestore ได้ — ตรวจสอบการตั้งค่า Firebase" };
  }

  const wht = (input.defaultWhtPercent ?? "1").replace(",", ".");

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
      try {
        await prisma.contractor.create({
          data: {
            ...record,
            defaultWhtPercent: new Prisma.Decimal(wht || "1"),
          },
        });
      } catch {
        /* mirror local */
      }
      return { ok: true as const, id };
    } catch (e) {
      if (attempt === 11) {
        const message = e instanceof Error ? e.message : "บันทึกไม่สำเร็จ";
        return { ok: false as const, message };
      }
    }
  }
  return { ok: false as const, message: "ไม่สามารถออกเลขที่ผู้รับเหมาได้" };
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

  if (canWriteFirestore()) {
    await upsertContractorFirestore(record);
  }
  try {
    await prisma.contractor.upsert({
      where: { id },
      create: { ...record, defaultWhtPercent: new Prisma.Decimal(wht || "1") },
      update: { ...record, defaultWhtPercent: new Prisma.Decimal(wht || "1") },
    });
  } catch {
    if (!canWriteFirestore()) {
      return { ok: false as const, message: "บันทึกไม่สำเร็จ" };
    }
  }
  return { ok: true as const };
}

export async function deleteContractorRecord(id: string) {
  const existing = await getContractor(id);
  if (!existing) return { ok: false as const, message: "ไม่พบข้อมูล" };

  try {
    const row = await prisma.contractor.findUnique({
      where: { id },
      include: { _count: { select: { subcontractAgreements: true } } },
    });
    if (row && row._count.subcontractAgreements > 0) {
      return {
        ok: false as const,
        message: "ลบไม่ได้ — มีสัญญาว่าจ้างผูกกับผู้รับเหมารายนี้",
      };
    }
  } catch {
    /* ignore */
  }

  if (canWriteFirestore()) {
    await deleteContractorFirestore(id);
  }
  try {
    await prisma.contractor.delete({ where: { id } });
  } catch {
    /* ignore */
  }
  return { ok: true as const };
}
