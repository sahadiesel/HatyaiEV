import { canWriteFirestore, FIRESTORE_WRITE_HINT } from "@/lib/data-primary";
import type { EntityKind, EntityRecord, EntityRole } from "@/lib/domain-types";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { firestoreCollections } from "@/lib/firestore-collections";
import { newEntityId } from "@/lib/new-id";

function db() {
  return getAdminFirestore();
}

function parseEntity(id: string, d: Record<string, unknown>): EntityRecord {
  const rolesRaw = d.roles;
  const roles = Array.isArray(rolesRaw)
    ? (rolesRaw.map(String) as EntityRole[])
    : (["CUSTOMER"] as EntityRole[]);
  return {
    id,
    code: typeof d.code === "string" ? d.code : null,
    name: String(d.name ?? ""),
    entityKind: (d.entityKind === "COMPANY" ? "COMPANY" : "INDIVIDUAL") as EntityKind,
    roles,
    taxId: String(d.taxId ?? ""),
    address: String(d.address ?? ""),
    phone: String(d.phone ?? ""),
    email: String(d.email ?? ""),
    branchHeadOffice: d.branchHeadOffice !== false,
    branchNo: String(d.branchNo ?? ""),
    bankName: String(d.bankName ?? ""),
    bankAccount: String(d.bankAccount ?? ""),
    defaultWhtPercent: String(d.defaultWhtPercent ?? "3"),
    notes: String(d.notes ?? ""),
  };
}

export async function listEntities(): Promise<EntityRecord[]> {
  const firestore = db();
  if (!firestore) return [];
  try {
    const snap = await firestore.collection(firestoreCollections.entities).orderBy("name").get();
    return snap.docs.map((doc) => parseEntity(doc.id, doc.data() as Record<string, unknown>));
  } catch {
    try {
      const snap = await firestore.collection(firestoreCollections.entities).get();
      return snap.docs
        .map((doc) => parseEntity(doc.id, doc.data() as Record<string, unknown>))
        .sort((a, b) => a.name.localeCompare(b.name, "th"));
    } catch (e) {
      console.error("[listEntities]", e);
      return [];
    }
  }
}

export async function getEntity(id: string): Promise<EntityRecord | null> {
  const firestore = db();
  if (!firestore) return null;
  try {
    const snap = await firestore.collection(firestoreCollections.entities).doc(id).get();
    if (!snap.exists) return null;
    return parseEntity(snap.id, snap.data() as Record<string, unknown>);
  } catch {
    return null;
  }
}

async function nextEntityCode(): Promise<string> {
  const year = new Date().getFullYear();
  const rows = await listEntities();
  const prefix = `EN-${year}-`;
  let max = 0;
  for (const r of rows) {
    if (!r.code?.startsWith(prefix)) continue;
    const n = parseInt(r.code.slice(prefix.length), 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}

export async function createEntity(
  input: Omit<EntityRecord, "id" | "code"> & { code?: string },
) {
  const name = input.name.trim();
  if (!name) return { ok: false as const, message: "กรอกชื่อ / ชื่อบริษัท" };
  if (!canWriteFirestore()) return { ok: false as const, message: FIRESTORE_WRITE_HINT };

  const firestore = db();
  if (!firestore) return { ok: false as const, message: FIRESTORE_WRITE_HINT };

  for (let attempt = 0; attempt < 12; attempt++) {
    const code = input.code ?? (await nextEntityCode());
    const id = newEntityId();
    const record: EntityRecord = {
      id,
      code,
      name,
      entityKind: input.entityKind,
      roles: input.roles?.length ? input.roles : ["CUSTOMER"],
      taxId: input.taxId ?? "",
      address: input.address ?? "",
      phone: input.phone ?? "",
      email: input.email ?? "",
      branchHeadOffice: input.branchHeadOffice !== false,
      branchNo: input.branchNo ?? "",
      bankName: input.bankName ?? "",
      bankAccount: input.bankAccount ?? "",
      defaultWhtPercent: input.defaultWhtPercent ?? "3",
      notes: input.notes ?? "",
    };
    try {
      const dup = (await listEntities()).some((e) => e.code === code);
      if (dup) continue;
      await firestore.collection(firestoreCollections.entities).doc(id).set({
        ...record,
        updatedAt: new Date(),
        createdAt: new Date(),
      });
      return { ok: true as const, id };
    } catch (e) {
      if (attempt === 11) {
        return { ok: false as const, message: e instanceof Error ? e.message : "บันทึกไม่สำเร็จ" };
      }
    }
  }
  return { ok: false as const, message: "ไม่สามารถออกรหัสได้" };
}

export async function updateEntity(id: string, input: Omit<EntityRecord, "id" | "code"> & { code?: string | null }) {
  const existing = await getEntity(id);
  if (!existing) return { ok: false as const, message: "ไม่พบข้อมูล" };
  const name = input.name.trim();
  if (!name) return { ok: false as const, message: "กรอกชื่อ / ชื่อบริษัท" };
  if (!canWriteFirestore()) return { ok: false as const, message: FIRESTORE_WRITE_HINT };

  const firestore = db();
  if (!firestore) return { ok: false as const, message: FIRESTORE_WRITE_HINT };

  const record: EntityRecord = {
    id,
    code: input.code ?? existing.code,
    name,
    entityKind: input.entityKind,
    roles: input.roles?.length ? input.roles : existing.roles,
    taxId: input.taxId ?? "",
    address: input.address ?? "",
    phone: input.phone ?? "",
    email: input.email ?? "",
    branchHeadOffice: input.branchHeadOffice !== false,
    branchNo: input.branchNo ?? "",
    bankName: input.bankName ?? "",
    bankAccount: input.bankAccount ?? "",
    defaultWhtPercent: input.defaultWhtPercent ?? "3",
    notes: input.notes ?? "",
  };
  await firestore.collection(firestoreCollections.entities).doc(id).set(
    { ...record, updatedAt: new Date() },
    { merge: true },
  );
  return { ok: true as const };
}

export async function deleteEntity(id: string) {
  if (!canWriteFirestore()) return { ok: false as const, message: FIRESTORE_WRITE_HINT };
  const firestore = db();
  if (!firestore) return { ok: false as const, message: FIRESTORE_WRITE_HINT };
  await firestore.collection(firestoreCollections.entities).doc(id).delete();
  return { ok: true as const };
}
