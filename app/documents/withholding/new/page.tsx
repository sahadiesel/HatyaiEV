import { WithholdingDocumentForm } from "@/components/documents/WithholdingDocumentForm";
import { loadContractorsForDocument } from "../../document-page-data";

export const metadata = { title: "สร้างใบหักภาษี ณ ที่จ่าย — HYEV" };

export default async function NewWithholdingPage() {
  const contractors = await loadContractorsForDocument();
  return (
    <WithholdingDocumentForm
      contractors={contractors.map((c) => ({
        ...c,
        defaultWhtPercent: String(c.defaultWhtPercent),
      }))}
    />
  );
}
