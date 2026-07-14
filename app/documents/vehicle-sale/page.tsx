import { LegalDocsListClient } from "@/components/documents/LegalDocsListClient";

export default function VehicleSaleDocsPage() {
  return (
    <LegalDocsListClient
      kind="VEHICLE_SALE_CONTRACT"
      title="สัญญาซื้อขายรถยนต์"
      newHref="/documents/vehicle-sale/new"
      emptyHint="ยังไม่มีสัญญาซื้อขายรถยนต์ — กด สร้างสัญญา (ต้องเลือกรถที่มีในระบบ)"
    />
  );
}
