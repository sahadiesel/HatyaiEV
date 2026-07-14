/** Domain types — Hatyai EV vehicle trading + service shop */

export type EntityKind = "INDIVIDUAL" | "COMPANY";

/** บทบาทคู่ค้า — ลูกค้า/ผู้ซื้อ และ ผู้ขาย/ซัพพลายเออร์ ใช้คู่กันใน UI */
export type EntityRole =
  | "CUSTOMER"
  | "BUYER"
  | "SELLER"
  | "SUPPLIER"
  | "CONTRACTOR"
  | "HIRER";

export type EntityRecord = {
  id: string;
  code: string | null;
  name: string;
  entityKind: EntityKind;
  roles: EntityRole[];
  taxId: string;
  address: string;
  phone: string;
  email: string;
  /** สำหรับนิติบุคคล */
  branchHeadOffice: boolean;
  branchNo: string;
  bankName: string;
  bankAccount: string;
  defaultWhtPercent: string;
  notes: string;
};

/** ซื้อจากบุคคลธรรมดา (ไม่มี VAT) vs บริษัทจด VAT 7% */
export type VehiclePurchaseType = "INDIVIDUAL_NO_VAT" | "COMPANY_VAT_7";

export type VehicleStatus = "IN_STOCK" | "RESERVED" | "SOLD" | "WRITTEN_OFF";

export type VehicleCostCategory = "PARTS" | "LABOR" | "REPAIR" | "OTHER";

export type VehicleCostLine = {
  id: string;
  date: string; // YYYY-MM-DD
  category: VehicleCostCategory;
  description: string;
  amount: string;
  /** อ้างอิงใบสำคัญจ่าย / เอกสาร (ถ้ามี) */
  documentId?: string | null;
  createdAt?: string;
};

export type VehicleRecord = {
  id: string;
  code: string | null;
  licensePlate: string;
  brand: string;
  model: string;
  year: string;
  color: string;
  vin: string;
  engineNo: string;
  mileage: string;
  status: VehicleStatus;
  /** ประเภทการซื้อเข้า — ใช้คำนวณ VAT ตอนขาย */
  purchaseType: VehiclePurchaseType;
  /** ผู้ขายที่ซื้อเข้า (entity) */
  sellerEntityId: string | null;
  purchaseDate: string;
  purchasePrice: string;
  /** ต้นทุนสะสม (อะไหล่/ค่าแรง) */
  costLines: VehicleCostLine[];
  /** ราคาตั้งขาย (ยังไม่ขาย) */
  expectedSalePrice: string;
  /** หักค่าคอมมิชชั่น */
  commissionAmount: string;
  /** เมื่อขายแล้ว */
  soldDate: string;
  soldPrice: string;
  buyerEntityId: string | null;
  notes: string;
};

export type RepairContractKind = "SERVICE_TO_CUSTOMER" | "OUTSOURCE_TO_SUPPLIER";

export type RepairContractStatus = "DRAFT" | "ACTIVE" | "COMPLETED" | "CANCELLED";

export type RepairContractRecord = {
  id: string;
  code: string | null;
  kind: RepairContractKind;
  title: string;
  status: RepairContractStatus;
  /** ลูกค้า (รับจ้างซ่อม) หรือ อู่ภายนอก (จ้างต่อ) */
  counterpartyEntityId: string | null;
  /** รถในสต็อกของบริษัท (ถ้าเป็นงานซ่อมรถตัวเอง) */
  vehicleId: string | null;
  /** รถลูกค้า — ทะเบียน/ยี่ห้อ ฯลฯ */
  customerVehicleLabel: string;
  symptoms: string;
  agreedPriceExVat: string;
  vatRate: string;
  notes: string;
  issueDate: string;
};

export type LegalDocKind =
  | "PURCHASE_CONTRACT"
  | "SALE_CONTRACT"
  | "VEHICLE_SALE_CONTRACT"
  | "HIRE_CONTRACT"
  | "REPAIR_CONTRACT"
  | "OUTSOURCE_REPAIR_CONTRACT"
  | "VEHICLE_RECEIVING";

export type LegalDocRecord = {
  id: string;
  kind: LegalDocKind;
  number: string;
  issueDate: string;
  vehicleId: string | null;
  repairContractId: string | null;
  sellerEntityId: string | null;
  buyerEntityId: string | null;
  hirerEntityId: string | null;
  contractorEntityId: string | null;
  /** เงื่อนไขการจ่าย เช่น มัดจำ 70% ส่งมอบ 30% */
  paymentTermsJson: string;
  amount: string;
  depositPercent: string;
  balancePercent: string;
  notes: string;
  metaJson: string;
};

/** ข้อมูลคู่สัญญาที่ snapshot ตอนสร้างสัญญา (รวมบัตร/ทะเบียน + โทร) */
export type ContractPartySnapshot = {
  entityId: string | null;
  name: string;
  address: string;
  /** เลขบัตรประชาชน หรือทะเบียนการค้า / เลขผู้เสียภาษี */
  idOrTaxNo: string;
  phone: string;
  entityKind: EntityKind;
};

export type CashDirection = "IN" | "OUT";

export type CashbookEntryType =
  | "DOCUMENT_AUTO"
  | "MANUAL"
  | "VEHICLE_PURCHASE"
  | "VEHICLE_SALE"
  | "PARTS"
  | "MISC";

export type CashbookEntry = {
  id: string;
  entryNo: string;
  entryDate: string;
  direction: CashDirection;
  entryType: CashbookEntryType;
  amount: string;
  description: string;
  /** อ้างอิงเอกสารระบบ */
  documentId: string | null;
  documentKind: string | null;
  documentNumber: string | null;
  vehicleId: string | null;
  entityId: string | null;
  createdByName: string;
  createdAt: string;
};

export type CashSettings = {
  openingBalance: string;
  updatedAt?: string;
};
