import { companySettingsDocId, firestoreCollections } from "./firestore-collections";
import { getAdminFirestore } from "./firebase-admin";
import { prisma } from "./prisma";

export type CompanySettingsData = {
  companyName: string;
  address: string;
  taxId: string;
  phone: string;
  email: string;
};

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

/** อ่านตั้งค่าร้าน — Firestore ก่อน (production) แล้ว fallback SQLite */
export async function loadCompanySettingsForDisplay(): Promise<CompanySettingsData | null> {
  const db = getAdminFirestore();
  if (db) {
    try {
      const snap = await db
        .collection(firestoreCollections.companySettings)
        .doc(companySettingsDocId)
        .get();
      if (snap.exists) {
        const d = snap.data()!;
        const name = asString(d.companyName).trim();
        if (name) {
          return {
            companyName: name,
            address: asString(d.address),
            taxId: asString(d.taxId),
            phone: asString(d.phone),
            email: asString(d.email),
          };
        }
      }
    } catch (e) {
      console.error("[loadCompanySettingsForDisplay] firestore", e);
    }
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
