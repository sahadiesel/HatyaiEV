import { LegalDocsListClient } from "@/components/documents/LegalDocsListClient";

export default function PurchaseContractDocsPage() {
  return (
    <LegalDocsListClient
      kind="PURCHASE_CONTRACT"
      title="สัญญาซื้อ"
      newHref="/documents/purchase-contract/new"
      emptyHint="ยังไม่มีสัญญาซื้อ — กด สร้างสัญญา (เลือกรถจากระบบ)"
      editMode="purchase"
      printKind="purchase"
    />
  );
}
