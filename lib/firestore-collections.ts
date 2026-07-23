/** ชื่อคอลเลกชัน Firestore — ใช้ไฟล์นี้บน server; ห้าม import จาก lib/firestore.ts ("use client") */
export const firestoreCollections = {
  companySettings: "companySettings",
  clients: "clients",
  contractors: "contractors",
  entities: "entities",
  vehicles: "vehicles",
  repairContracts: "repairContracts",
  legalDocuments: "legalDocuments",
  hiringContracts: "hiringContracts",
  subcontractAgreements: "subcontractAgreements",
  documents: "documents",
  cashbookEntries: "cashbookEntries",
  cashSettings: "cashSettings",
  vehicleBrands: "vehicleBrands",
  bankAccounts: "bankAccounts",
} as const;

export const companySettingsDocId = "main";
export const cashSettingsDocId = "main";
