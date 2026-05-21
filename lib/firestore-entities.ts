import { getAdminFirestore } from "./firebase-admin";
import { firestoreCollections } from "./firestore";

export type ClientRecord = {
  id: string;
  code: string | null;
  name: string;
  taxId: string;
  address: string;
  phone: string;
  email: string;
  notes: string;
};

export type ContractorRecord = {
  id: string;
  code: string | null;
  name: string;
  taxId: string;
  address: string;
  phone: string;
  email: string;
  bankName: string;
  bankAccount: string;
  defaultWhtPercent: string;
  notes: string;
};

function hasAdminFirestore() {
  return Boolean(getAdminFirestore());
}

export async function countFirestoreCollection(name: string): Promise<number | null> {
  const db = getAdminFirestore();
  if (!db) return null;
  try {
    const snap = await db.collection(name).count().get();
    return snap.data().count;
  } catch {
    try {
      const snap = await db.collection(name).get();
      return snap.size;
    } catch {
      return null;
    }
  }
}

export async function listClientsFromFirestore(): Promise<ClientRecord[] | null> {
  const db = getAdminFirestore();
  if (!db) return null;
  try {
    const snap = await db.collection(firestoreCollections.clients).orderBy("name").get();
    return snap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        code: typeof d.code === "string" ? d.code : null,
        name: String(d.name ?? ""),
        taxId: String(d.taxId ?? ""),
        address: String(d.address ?? ""),
        phone: String(d.phone ?? ""),
        email: String(d.email ?? ""),
        notes: String(d.notes ?? ""),
      };
    });
  } catch {
    return null;
  }
}

export async function listContractorsFromFirestore(): Promise<ContractorRecord[] | null> {
  const db = getAdminFirestore();
  if (!db) return null;
  try {
    const snap = await db.collection(firestoreCollections.contractors).orderBy("name").get();
    return snap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        code: typeof d.code === "string" ? d.code : null,
        name: String(d.name ?? ""),
        taxId: String(d.taxId ?? ""),
        address: String(d.address ?? ""),
        phone: String(d.phone ?? ""),
        email: String(d.email ?? ""),
        bankName: String(d.bankName ?? ""),
        bankAccount: String(d.bankAccount ?? ""),
        defaultWhtPercent: String(d.defaultWhtPercent ?? "1"),
        notes: String(d.notes ?? ""),
      };
    });
  } catch {
    return null;
  }
}

export async function upsertClientFirestore(data: ClientRecord) {
  const db = getAdminFirestore();
  if (!db) return;
  await db.collection(firestoreCollections.clients).doc(data.id).set(data, { merge: true });
}

export async function upsertContractorFirestore(data: ContractorRecord) {
  const db = getAdminFirestore();
  if (!db) return;
  await db.collection(firestoreCollections.contractors).doc(data.id).set(data, { merge: true });
}

export async function deleteClientFirestore(id: string) {
  const db = getAdminFirestore();
  if (!db) return;
  await db.collection(firestoreCollections.clients).doc(id).delete();
}

export async function deleteContractorFirestore(id: string) {
  const db = getAdminFirestore();
  if (!db) return;
  await db.collection(firestoreCollections.contractors).doc(id).delete();
}

export { hasAdminFirestore };
