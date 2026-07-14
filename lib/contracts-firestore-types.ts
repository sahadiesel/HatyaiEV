export type ContractDocStatus = "DRAFT" | "ACTIVE" | "COMPLETED" | "CANCELLED";

export type VehicleEngineType = "GASOLINE" | "DIESEL" | "ELECTRIC";

export type HiringContractVehicleFs = {
  id: string;
  lineIndex: number;
  licensePlate: string;
  brand: string;
  model: string;
  year: string;
  color: string;
  engineType: VehicleEngineType;
  engineSize: string;
  extraNotes: string;
  contractPhotos: string;
  inspectionJson: string;
  billingJson: string;
};

export type HiringContractInstallmentFs = {
  sequence: number;
  label: string;
  amount: string;
  percent: string;
};

/** ข้อมูลรถตอนบันทึก — ไม่บังคับ inspection/billing (คงค่าเดิมจาก Firestore) */
export type HiringContractVehicleSaveFs = Omit<
  HiringContractVehicleFs,
  "inspectionJson" | "billingJson" | "id"
> & {
  id?: string;
  inspectionJson?: string;
  billingJson?: string;
};

export type HiringContractFs = {
  id: string;
  code: string;
  title: string;
  clientId: string;
  vehicleCount: number;
  pricePerVehicleExVat: string;
  vatRate: string;
  status: ContractDocStatus;
  notes: string;
  vehicles: HiringContractVehicleFs[];
  installments: HiringContractInstallmentFs[];
};

export type SubcontractInstallmentFs = HiringContractInstallmentFs;

export type SubcontractAgreementFs = {
  id: string;
  code: string;
  title: string;
  contractorId: string;
  hiringContractId: string;
  vehicleCount: number;
  pricePerVehicleExVat: string;
  vatRate: string;
  status: ContractDocStatus;
  notes: string;
  selectedVehicleIds: string[];
  installments: SubcontractInstallmentFs[];
};
