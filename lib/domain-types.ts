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
  /** คู่ค้าที่จ่ายให้ (ผู้รับจ้าง / ซัพพลายเออร์) */
  entityId?: string | null;
  /** เลขที่บิลสินค้า (อะไหล่) */
  billNo?: string | null;
  /** อ้างอิงใบสำคัญจ่าย / เอกสาร (ถ้ามี) */
  documentId?: string | null;
  withholdingDocumentId?: string | null;
  paymentVoucherDocumentId?: string | null;
  cashbookEntryId?: string | null;
  createdAt?: string;
};

/** งวดจ่ายค่าซื้อรถ — แยกจากมูลค่าสัญญา (ตัด cashbook ตามยอดจ่ายจริง) */
export type VehiclePurchasePayment = {
  id: string;
  date: string;
  amount: string;
  /** เลขที่ใบกำกับภาษี / บิลจากผู้ขาย */
  billNo?: string | null;
  /** เลขที่ใบเสร็จรับเงิน */
  receiptNo?: string | null;
  paymentVoucherDocumentId?: string | null;
  paymentVoucherDocumentNumber?: string | null;
  cashbookEntryId?: string | null;
  notes?: string;
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
  /** มูลค่าซื้อ/ต้นทุนรถ (ไม่ใช่ยอดตัดเงินสด) */
  purchasePrice: string;
  /**
   * ราคาเต็มในสัญญาซื้อเข้า (ล็อกเป็นฐานคำนวณ Margin ป.111)
   * ถ้าว่าง ใช้ purchasePrice — ใช้เป็นยอดที่ต้องจ่ายทั้งหมด
   */
  purchaseContractAmount: string;
  /** ประวัติจ่ายค่าซื้อรถ (งวดย่อย) */
  purchasePayments: VehiclePurchasePayment[];
  /** ราคาเต็มในสัญญาขายออก */
  saleContractAmount: string;
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

export type CashChannel = "CASH" | "BANK";

export type CashVatType = "FULL_VAT" | "MARGIN_VAT" | "NO_VAT";

export type CashDirection = "IN" | "OUT";

export type CashbookEntryType =
  | "DOCUMENT_AUTO"
  | "MANUAL"
  | "VEHICLE_PURCHASE"
  | "VEHICLE_SALE"
  | "PARTS"
  | "LABOR"
  | "MISC"
  | "PURCHASE_DEPOSIT"
  | "SALE_DEPOSIT"
  | "TRANSFER";

export type CashbookEntry = {
  id: string;
  entryNo: string;
  entryDate: string;
  direction: CashDirection;
  entryType: CashbookEntryType;
  amount: string;
  description: string;
  documentId: string | null;
  documentKind: string | null;
  documentNumber: string | null;
  /** เอกสารหัก ณ ที่จ่ายที่ผูกกับรายจ่ายนี้ */
  withholdingDocumentId?: string | null;
  withholdingDocumentNumber?: string | null;
  /** ใบสำคัญจ่ายที่ผูกกับรายจ่ายนี้ */
  paymentVoucherDocumentId?: string | null;
  paymentVoucherDocumentNumber?: string | null;
  /** เลขที่บิลสินค้า */
  billNo?: string | null;
  vehicleId: string | null;
  entityId: string | null;
  channel: CashChannel;
  bankAccountId: string | null;
  taxBasisAmount: string | null;
  vatType: CashVatType | null;
  customerVatAmount: string | null;
  remittanceVatAmount: string | null;
  createdByName: string;
  createdAt: string;
};

export type CashSettings = {
  openingBalance: string;
  cashOpeningBalance: string;
  defaultBankAccountId: string | null;
  updatedAt?: string;
};

export type BankAccountKind = "CASH" | "BANK";

export type BankAccountRecord = {
  id: string;
  /** เงินสด หรือบัญชีธนาคาร */
  kind: BankAccountKind;
  accountName: string;
  bankName: string;
  accountNumber: string;
  openingBalance: string;
  isPrimary: boolean;
  active: boolean;
  notes: string;
};
