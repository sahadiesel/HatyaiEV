import { companySettingsDocId, firestoreCollections } from "./firestore-collections";
import { canWriteFirestore, isFirestorePrimary } from "./data-primary";
import { getAdminFirestore } from "./firebase-admin";
import { prisma } from "./prisma";

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

/** อ่านตั้งค่าร้าน — Firestore เมื่อมี Firebase config (local = production) */
export async function loadCompanySettingsForDisplay(): Promise<CompanySettingsData | null> {
  if (isFirestorePrimary()) {
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

  try {
    const row = await prisma.companySettings.findUnique({ where: { id: 1 } });
    if (row?.companyName?.trim()) {
      return {
        companyName: row.companyName,
        address: row.address,
        taxId: row.taxId,
        phone: row.phone,
        email: row.email,
      };
    }
  } catch (e) {
    console.error("[loadCompanySettingsForDisplay] prisma", e);
  }
  return null;
}

/** อ่านตั้งค่าร้าน + คำนำหน้าเอกสาร */
export async function loadCompanySettingsFull(): Promise<CompanySettingsFull | null> {
  if (isFirestorePrimary()) {
    return readCompanySettingsFromAdmin();
  }
  try {
    const row = await prisma.companySettings.findUnique({ where: { id: 1 } });
    if (!row) return null;
    return {
      companyName: row.companyName,
      address: row.address,
      taxId: row.taxId,
      phone: row.phone,
      email: row.email,
      docPrefixInvoice: row.docPrefixInvoice,
      docPrefixTaxInvoice: row.docPrefixTaxInvoice,
      docPrefixReceipt: row.docPrefixReceipt,
      docPrefixPo: row.docPrefixPo,
      docPrefixWht: row.docPrefixWht,
    };
  } catch {
    return null;
  }
}

export async function saveCompanySettingsAdmin(payload: CompanySettingsFull): Promise<void> {
  if (!canWriteFirestore()) throw new Error("Firestore Admin ไม่พร้อม");
  const db = getAdminFirestore();
  if (!db) throw new Error("Firestore Admin ไม่พร้อม");
  await db
    .collection(firestoreCollections.companySettings)
    .doc(companySettingsDocId)
    .set({ ...payload, updatedAt: new Date() }, { merge: true });
}
