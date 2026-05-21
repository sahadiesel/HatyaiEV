import { Timestamp } from "firebase-admin/firestore";
import type {
  DocumentKind,
  DocumentListItem,
  DocumentRecord,
  DocumentWriteInput,
} from "./documents-firestore-types";
import { canWriteFirestore, FIRESTORE_WRITE_HINT } from "./data-primary";
import { getAdminFirestore } from "./firebase-admin";
import { firestoreCollections } from "./firestore-collections";
import { getClientFirestore, getContractorFirestore } from "./firestore-entities";
import { newEntityId } from "./new-id";

function db() {
  return getAdminFirestore();
}

function toDate(v: unknown): Date {
  if (v instanceof Date) return v;
  if (v instanceof Timestamp) return v.toDate();
  if (typeof v === "string" || typeof v === "number") return new Date(v);
  return new Date();
}

function parseDoc(id: string, d: Record<string, unknown>): DocumentRecord {
  return {
    id,
    kind: String(d.kind ?? "INVOICE") as DocumentKind,
    number: String(d.number ?? ""),
    issueDate: toDate(d.issueDate),
    subtotal: String(d.subtotal ?? "0"),
    vatAmount: String(d.vatAmount ?? "0"),
    totalAmount: String(d.totalAmount ?? "0"),
    withholdingAmount: String(d.withholdingAmount ?? "0"),
    notes: String(d.notes ?? ""),
    linesJson: String(d.linesJson ?? "[]"),
    metaJson: String(d.metaJson ?? "{}"),
    clientId: d.clientId ? String(d.clientId) : null,
    contractorId: d.contractorId ? String(d.contractorId) : null,
  };
}

function toFirestorePayload(input: DocumentWriteInput & { number: string }) {
  return {
    kind: input.kind,
    number: input.number,
    issueDate: input.issueDate,
    subtotal: input.subtotal,
    vatAmount: input.vatAmount,
    totalAmount: input.totalAmount,
    withholdingAmount: input.withholdingAmount,
    notes: input.notes,
    linesJson: input.linesJson,
    metaJson: input.metaJson,
    clientId: input.clientId,
    contractorId: input.contractorId,
    updatedAt: new Date(),
  };
}

async function enrichListItem(doc: DocumentRecord): Promise<DocumentListItem> {
  const [client, contractor] = await Promise.all([
    doc.clientId ? getClientFirestore(doc.clientId) : null,
    doc.contractorId ? getContractorFirestore(doc.contractorId) : null,
  ]);
  return {
    ...doc,
    clientName: client?.name ?? null,
    contractorName: contractor?.name ?? null,
  };
}

export async function listDocuments(kind: DocumentKind): Promise<DocumentListItem[]> {
  const firestore = db();
  if (!firestore) return [];
  try {
    const snap = await firestore
      .collection(firestoreCollections.documents)
      .where("kind", "==", kind)
      .orderBy("issueDate", "desc")
      .limit(200)
      .get();
    const docs = snap.docs.map((doc) => parseDoc(doc.id, doc.data() as Record<string, unknown>));
    return Promise.all(docs.map(enrichListItem));
  } catch (indexError) {
    try {
      const snap = await firestore
        .collection(firestoreCollections.documents)
        .where("kind", "==", kind)
        .get();
      const docs = snap.docs
        .map((doc) => parseDoc(doc.id, doc.data() as Record<string, unknown>))
        .sort((a, b) => b.issueDate.getTime() - a.issueDate.getTime())
        .slice(0, 200);
      return Promise.all(docs.map(enrichListItem));
    } catch (e) {
      console.error("[listDocuments]", indexError, e);
      return [];
    }
  }
}

export async function getDocument(id: string): Promise<DocumentRecord | null> {
  const firestore = db();
  if (!firestore) return null;
  try {
    const snap = await firestore.collection(firestoreCollections.documents).doc(id).get();
    if (!snap.exists) return null;
    return parseDoc(snap.id, snap.data() as Record<string, unknown>);
  } catch {
    return null;
  }
}

export async function listDocumentNumbers(kind: DocumentKind, head: string): Promise<string[]> {
  const firestore = db();
  if (!firestore) return [];
  try {
    const snap = await firestore
      .collection(firestoreCollections.documents)
      .where("kind", "==", kind)
      .get();
    return snap.docs
      .map((d) => String((d.data() as Record<string, unknown>).number ?? ""))
      .filter((n) => n.startsWith(head));
  } catch {
    return [];
  }
}

export async function createDocument(input: DocumentWriteInput & { number: string }): Promise<DocumentRecord> {
  if (!canWriteFirestore()) throw new Error(FIRESTORE_WRITE_HINT);
  const firestore = db();
  if (!firestore) throw new Error(FIRESTORE_WRITE_HINT);
  const id = newEntityId();
  const now = new Date();
  await firestore
    .collection(firestoreCollections.documents)
    .doc(id)
    .set({ ...toFirestorePayload(input), createdAt: now });
  return { id, ...input, number: input.number };
}

export async function updateDocument(
  id: string,
  input: DocumentWriteInput & { number?: string },
): Promise<DocumentRecord> {
  if (!canWriteFirestore()) throw new Error(FIRESTORE_WRITE_HINT);
  const existing = await getDocument(id);
  if (!existing) throw new Error("ไม่พบเอกสาร");
  const firestore = db();
  if (!firestore) throw new Error(FIRESTORE_WRITE_HINT);
  const number = input.number ?? existing.number;
  await firestore
    .collection(firestoreCollections.documents)
    .doc(id)
    .set(toFirestorePayload({ ...input, number }), { merge: true });
  return { ...existing, ...input, number };
}

export async function assignDocumentNumber(id: string, number: string): Promise<DocumentRecord> {
  if (!canWriteFirestore()) throw new Error(FIRESTORE_WRITE_HINT);
  const existing = await getDocument(id);
  if (!existing) throw new Error("ไม่พบเอกสาร");
  const firestore = db();
  if (!firestore) throw new Error(FIRESTORE_WRITE_HINT);
  await firestore.collection(firestoreCollections.documents).doc(id).update({ number, updatedAt: new Date() });
  return { ...existing, number };
}
