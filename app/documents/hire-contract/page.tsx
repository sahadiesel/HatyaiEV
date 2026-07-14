import { LegalDocsListClient } from "@/components/documents/LegalDocsListClient";

export default function HireContractDocsPage() {
  return (
    <LegalDocsListClient
      kind="HIRE_CONTRACT"
      title="สัญญาว่าจ้าง"
      newHref="/documents/hire-contract/new"
      emptyHint="ยังไม่มีสัญญาว่าจ้าง — กด สร้างสัญญา"
    />
  );
}
