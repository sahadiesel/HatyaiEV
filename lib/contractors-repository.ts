import {
  deleteContractorFirestore,
  getContractorFirestore,
  listContractorsFromFirestore,
  upsertContractorFirestore,
  type ContractorRecord,
} from "./firestore-entities";
import { canWriteFirestore, FIRESTORE_WRITE_HINT } from "./data-primary";
import { countSubcontractAgreementsForContractor } from "./subcontract-agreements-repository";
import { newEntityId } from "./new-id";
import { nextContractorCode } from "./partyCodes";

export type { ContractorRecord };

export async function listContractors(): Promise<ContractorRecord[]> {
  return (await listContractorsFromFirestore()) ?? [];
}

export async function getContractor(id: string): Promise<ContractorRecord | null> {
  return getContractorFirestore(id);
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
  if (!canWriteFirestore()) return { ok: false as const, message: FIRESTORE_WRITE_HINT };

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
      return { ok: true as const, id };
    } catch (e) {
      if (attempt === 11) {
        return { ok: false as const, message: e instanceof Error ? e.message : "บันทึกไม่สำเร็จ" };
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
  if (!canWriteFirestore()) return { ok: false as const, message: FIRESTORE_WRITE_HINT };

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
  await upsertContractorFirestore(record);
  return { ok: true as const };
}

export async function deleteContractorRecord(id: string) {
  const existing = await getContractor(id);
  if (!existing) return { ok: false as const, message: "ไม่พบข้อมูล" };
  const subCount = await countSubcontractAgreementsForContractor(id);
  if (subCount > 0) {
    return { ok: false as const, message: "ลบไม่ได้ — มีสัญญาว่าจ้างผูกกับผู้รับเหมารายนี้" };
  }
  if (!canWriteFirestore()) return { ok: false as const, message: FIRESTORE_WRITE_HINT };
  await deleteContractorFirestore(id);
  return { ok: true as const };
}
