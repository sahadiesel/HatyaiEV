import { companySettingsDocId, firestoreCollections } from "./firestore-collections";
import { canWriteFirestore, FIRESTORE_WRITE_HINT } from "./data-primary";
import { getAdminFirestore } from "./firebase-admin";

export type CompanySettingsData = {
  companyName: string;
  address: string;
  taxId: string;
  phone: string;
  email: string;
};

export type CompanySettingsFull = CompanySettingsData & {
  docPrefixInvoice: string;
  docPrefixTaxInvoice: string;
  docPrefixReceipt: string;
  docPrefixPo: string;
  docPrefixWht: string;
};

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function parseFirestoreSettings(d: Record<string, unknown>): CompanySettingsFull {
  return {
    companyName: asString(d.companyName),
    address: asString(d.address),
    taxId: asString(d.taxId),
    phone: asString(d.phone),
    email: asString(d.email),
    docPrefixInvoice: asString(d.docPrefixInvoice, "INV"),
    docPrefixTaxInvoice: asString(d.docPrefixTaxInvoice, "TAX"),
    docPrefixReceipt: asString(d.docPrefixReceipt, "RC"),
    docPrefixPo: asString(d.docPrefixPo, "PO"),
    docPrefixWht: asString(d.docPrefixWht, "WHT"),
  };
}

async function readCompanySettingsFromAdmin(): Promise<CompanySettingsFull | null> {
  const db = getAdminFirestore();
  if (!db) return null;
  try {
    const snap = await db
      .collection(firestoreCollections.companySettings)
      .doc(companySettingsDocId)
      .get();
    if (!snap.exists) return null;
    return parseFirestoreSettings(snap.data() as Record<string, unknown>);
  } catch (e) {
    console.error("[readCompanySettingsFromAdmin]", e);
    return null;
  }
}

export async function loadCompanySettingsForDisplay(): Promise<CompanySettingsData | null> {
  const fs = await readCompanySettingsFromAdmin();
  if (fs?.companyName.trim()) {
    return {
      companyName: fs.companyName,
      address: fs.address,
      taxId: fs.taxId,
      phone: fs.phone,
      email: fs.email,
    };
  }
  return null;
}

export async function loadCompanySettingsFull(): Promise<CompanySettingsFull | null> {
  return readCompanySettingsFromAdmin();
}

export async function saveCompanySettingsAdmin(payload: CompanySettingsFull): Promise<void> {
  if (!canWriteFirestore()) throw new Error(FIRESTORE_WRITE_HINT);
  const db = getAdminFirestore();
  if (!db) throw new Error(FIRESTORE_WRITE_HINT);
  await db
    .collection(firestoreCollections.companySettings)
    .doc(companySettingsDocId)
    .set({ ...payload, updatedAt: new Date() }, { merge: true });
}
