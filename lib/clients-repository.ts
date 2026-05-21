import {
  deleteClientFirestore,
  getClientFirestore,
  listClientsFromFirestore,
  upsertClientFirestore,
  type ClientRecord,
} from "./firestore-entities";
import { canWriteFirestore, useFirestorePrimary } from "./data-primary";
import { countHiringContractsForClient } from "./hiring-contracts-repository";
import { newEntityId } from "./new-id";
import { nextClientCode } from "./partyCodes";
import { prisma } from "./prisma";

export type { ClientRecord };

export async function listClients(): Promise<ClientRecord[]> {
  if (useFirestorePrimary()) {
    const fs = await listClientsFromFirestore();
    if (fs !== null) return fs;
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
  if (useFirestorePrimary()) {
    const fs = await getClientFirestore(id);
    if (fs) return fs;
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

  if (!canWriteFirestore()) {
    return { ok: false as const, message: "ไม่สามารถบันทึก Firestore ได้ — ตรวจสอบการตั้งค่า Firebase" };
  }

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
      try {
        await prisma.client.create({ data: record });
      } catch {
        /* mirror local sqlite เท่านั้น */
      }
      return { ok: true as const, id };
    } catch (e) {
      if (attempt === 11) {
        const message = e instanceof Error ? e.message : "บันทึกไม่สำเร็จ";
        return { ok: false as const, message };
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

  if (canWriteFirestore()) {
    await upsertClientFirestore(record);
  }
  try {
    await prisma.client.upsert({
      where: { id },
      create: record,
      update: record,
    });
  } catch {
    if (!canWriteFirestore()) {
      return { ok: false as const, message: "บันทึกไม่สำเร็จ" };
    }
  }
  return { ok: true as const };
}

export async function deleteClientRecord(id: string) {
  const existing = await getClient(id);
  if (!existing) return { ok: false as const, message: "ไม่พบข้อมูล" };

  const hiringCount = await countHiringContractsForClient(id);
  if (hiringCount > 0) {
    return { ok: false as const, message: "ลบไม่ได้ — มีสัญญารับจ้างผูกกับผู้ว่าจ้างรายนี้" };
  }

  if (canWriteFirestore()) {
    await deleteClientFirestore(id);
  }
  try {
    await prisma.client.delete({ where: { id } });
  } catch {
    /* ignore */
  }
  return { ok: true as const };
}
