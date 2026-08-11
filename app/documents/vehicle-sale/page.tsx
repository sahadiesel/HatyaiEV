import { LegalDocsListClient } from "@/components/documents/LegalDocsListClient";

export default function VehicleSaleDocsPage() {
  return (
    <LegalDocsListClient
      kind="VEHICLE_SALE_CONTRACT"
      title="สัญญาขาย"
      newHref="/documents/vehicle-sale/new"
      emptyHint="ยังไม่มีสัญญาขาย — กด สร้างสัญญา (ต้องเลือกรถที่มีในระบบ)"
      editMode="vehicle-sale"
      printKind="vehicle-sale"
    />
  );
}
