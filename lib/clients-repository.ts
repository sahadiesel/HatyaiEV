import {
  deleteClientFirestore,
  getClientFirestore,
  listClientsFromFirestore,
  upsertClientFirestore,
  type ClientRecord,
} from "./firestore-entities";
import {
  canWriteFirestore,
  FIRESTORE_WRITE_HINT,
  isFirestorePrimary,
} from "./data-primary";
import { countHiringContractsForClient } from "./hiring-contracts-repository";
import { newEntityId } from "./new-id";
import { nextClientCode } from "./partyCodes";
import { prisma } from "./prisma";

export type { ClientRecord };

export async function listClients(): Promise<ClientRecord[]> {
  if (isFirestorePrimary()) {
    return (await listClientsFromFirestore()) ?? [];
  }
  const rows = await prisma.client.findMany({ orderBy: { name: "asc" } });
  return rows.map((c) => ({
    id: c.id,
    code: c.code,
    name: c.name,
    taxId: c.taxId,
    address: c.address,
    phone: c.phone,
    email: c.email,
    notes: c.notes,
  }));
}

export async function getClient(id: string): Promise<ClientRecord | null> {
  if (isFirestorePrimary()) {
    return getClientFirestore(id);
  }
  const row = await prisma.client.findUnique({ where: { id } });
  if (!row) return null;
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    taxId: row.taxId,
    address: row.address,
    phone: row.phone,
    email: row.email,
    notes: row.notes,
  };
}

export async function createClientRecord(input: Omit<ClientRecord, "id" | "code"> & { code?: string }) {
  const name = input.name.trim();
  if (!name) return { ok: false as const, message: "กรอกชื่อ / บริษัท" };

  if (isFirestorePrimary() && !canWriteFirestore()) {
    return { ok: false as const, message: FIRESTORE_WRITE_HINT };
  }

  if (isFirestorePrimary()) {
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
    await prisma.client.create({ data: record });
    return { ok: true as const, id };
  } catch (e) {
    return { ok: false as const, message: e instanceof Error ? e.message : "บันทึกไม่สำเร็จ" };
  }
}

export async function updateClientRecord(
  id: string,
  input: Omit<ClientRecord, "id" | "code"> & { code?: string | null },
) {
  const existing = await getClient(id);
  if (!existing) return { ok: false as const, message: "ไม่พบข้อมูล" };
  const name = input.name.trim();
  if (!name) return { ok: false as const, message: "กรอกชื่อ / บริษัท" };

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

  if (isFirestorePrimary()) {
    if (!canWriteFirestore()) return { ok: false as const, message: FIRESTORE_WRITE_HINT };
    await upsertClientFirestore(record);
    return { ok: true as const };
  }

  try {
    await prisma.client.upsert({ where: { id }, create: record, update: record });
    return { ok: true as const };
  } catch {
    return { ok: false as const, message: "บันทึกไม่สำเร็จ" };
  }
}

export async function deleteClientRecord(id: string) {
  const existing = await getClient(id);
  if (!existing) return { ok: false as const, message: "ไม่พบข้อมูล" };

  const hiringCount = await countHiringContractsForClient(id);
  if (hiringCount > 0) {
    return { ok: false as const, message: "ลบไม่ได้ — มีสัญญารับจ้างผูกกับผู้ว่าจ้างรายนี้" };
  }

  if (isFirestorePrimary()) {
    if (!canWriteFirestore()) return { ok: false as const, message: FIRESTORE_WRITE_HINT };
    await deleteClientFirestore(id);
    return { ok: true as const };
  }

  try {
    await prisma.client.delete({ where: { id } });
    return { ok: true as const };
  } catch {
    return { ok: false as const, message: "ลบไม่สำเร็จ" };
  }
}
