/** ชื่อคอลเลกชัน Firestore — ใช้ไฟล์นี้บน server; ห้าม import จาก lib/firestore.ts ("use client") */
export const firestoreCollections = {
  companySettings: "companySettings",
  clients: "clients",
  contractors: "contractors",
  hiringContracts: "hiringContracts",
  subcontractAgreements: "subcontractAgreements",
  documents: "documents",
} as const;

export const companySettingsDocId = "main";
