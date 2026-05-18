"use client";

import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  type Timestamp,
} from "firebase/firestore";
import { getFirestoreDb } from "./firebase";

/** ชื่อคอลเลกชัน — ใช้ค่าคงที่เดียวกันทั้งแอปเพื่อไม่ให้สะกดผิด */
export const firestoreCollections = {
  companySettings: "companySettings",
  clients: "clients",
  contractors: "contractors",
  hiringContracts: "hiringContracts",
  subcontractAgreements: "subcontractAgreements",
} as const;

export const companySettingsDocId = "main";

export type CompanySettingsFirestorePayload = {
  companyName: string;
  address: string;
  taxId: string;
  phone: string;
  email: string;
  docPrefixInvoice: string;
  docPrefixTaxInvoice: string;
  docPrefixReceipt: string;
  docPrefixPo: string;
  docPrefixWht: string;
};

export type CompanySettingsFirestoreSnapshot = CompanySettingsFirestorePayload & {
  updatedAt?: Timestamp | null;
};

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

/**
 * บันทึกการตั้งค่าร้านลง Firestore เอกสารเดียว (mirror จาก SQLite)
 * ต้องเรียกจาก Client Component และตั้งค่า NEXT_PUBLIC_FIREBASE_* ครบแล้ว
 */
export async function writeCompanySettingsToFirestore(
  payload: CompanySettingsFirestorePayload,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const db = getFirestoreDb();
  if (!db) {
    return { ok: false, message: "ยังไม่ได้ตั้งค่า Firebase (NEXT_PUBLIC_FIREBASE_*)" };
  }
  try {
    await setDoc(doc(db, firestoreCollections.companySettings, companySettingsDocId), {
      ...payload,
      updatedAt: serverTimestamp(),
    });
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, message };
  }
}

/** อ่านการตั้งค่าร้านจาก Firestore (ถ้าไม่มีเอกสารหรือยังไม่ตั้งค่า Firebase จะได้ null) */
export async function readCompanySettingsFromFirestore(): Promise<CompanySettingsFirestoreSnapshot | null> {
  const db = getFirestoreDb();
  if (!db) return null;
  const snap = await getDoc(doc(db, firestoreCollections.companySettings, companySettingsDocId));
  if (!snap.exists()) return null;
  const d = snap.data();
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
    updatedAt: d.updatedAt as Timestamp | undefined,
  };
}
