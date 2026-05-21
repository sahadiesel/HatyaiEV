import {
  deleteClientFirestore,
  getClientFirestore,
  listClientsFromFirestore,
  upsertClientFirestore,
  type ClientRecord,
} from "./firestore-entities";
import { canWriteFirestore, FIRESTORE_WRITE_HINT } from "./data-primary";
import { countHiringContractsForClient } from "./hiring-contracts-repository";
import { newEntityId } from "./new-id";
import { nextClientCode } from "./partyCodes";

export type { ClientRecord };

export async function listClients(): Promise<ClientRecord[]> {
  return (await listClientsFromFirestore()) ?? [];
}

export async function getClient(id: string): Promise<ClientRecord | null> {
  return getClientFirestore(id);
}

export async function createClientRecord(input: Omit<ClientRecord, "id" | "code"> & { code?: string }) {
  const name = input.name.trim();
  if (!name) return { ok: false as const, message: "กรอกชื่อ / บริษัท" };
  if (!canWriteFirestore()) return { ok: false as const, message: FIRESTORE_WRITE_HINT };

  for (let attempt = 0; attempt < 12; attempt++) {
    const code = input.code ?? (await nextClientCode());
    const id = newEntityId();
    const record: ClientRecord = {
      id,
      code,
      name,
      taxId: input.taxId ?? "",
      address: input.address ?? "",
      phone: input.phone ?? "",
      email: input.email ?? "",
      notes: input.notes ?? "",
    };
    try {
      const dupCode = (await listClientsFromFirestore())?.some((c) => c.code === code);
      if (dupCode) continue;
      await upsertClientFirestore(record);
      return { ok: true as const, id };
    } catch (e) {
      if (attempt === 11) {
        return { ok: false as const, message: e instanceof Error ? e.message : "บันทึกไม่สำเร็จ" };
      }
    }
  }
  return { ok: false as const, message: "ไม่สามารถออกเลขที่ผู้ว่าจ้างได้" };
}

export async function updateClientRecord(
  id: string,
  input: Omit<ClientRecord, "id" | "code"> & { code?: string | null },
) {
  const existing = await getClient(id);
  if (!existing) return { ok: false as const, message: "ไม่พบข้อมูล" };
  const name = input.name.trim();
  if (!name) return { ok: false as const, message: "กรอกชื่อ / บริษัท" };
  if (!canWriteFirestore()) return { ok: false as const, message: FIRESTORE_WRITE_HINT };

  const record: ClientRecord = {
    id,
    code: input.code ?? existing.code,
    name,
    taxId: input.taxId ?? "",
    address: input.address ?? "",
    phone: input.phone ?? "",
    email: input.email ?? "",
    notes: input.notes ?? "",
  };
  await upsertClientFirestore(record);
  return { ok: true as const };
}

export async function deleteClientRecord(id: string) {
  const existing = await getClient(id);
  if (!existing) return { ok: false as const, message: "ไม่พบข้อมูล" };
  const hiringCount = await countHiringContractsForClient(id);
  if (hiringCount > 0) {
    return { ok: false as const, message: "ลบไม่ได้ — มีสัญญารับจ้างผูกกับผู้ว่าจ้างรายนี้" };
  }
  if (!canWriteFirestore()) return { ok: false as const, message: FIRESTORE_WRITE_HINT };
  await deleteClientFirestore(id);
  return { ok: true as const };
}
