import { WithholdingDocumentForm } from "@/components/documents/WithholdingDocumentForm";
import { loadContractorsForDocument } from "../../document-page-data";

export const metadata = { title: "แก้ไขใบหักภาษี ณ ที่จ่าย — HYEV" };

export default async function EditWithholdingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const contractors = await loadContractorsForDocument();
  return (
    <WithholdingDocumentForm
      contractors={contractors.map((c) => ({
        ...c,
        defaultWhtPercent: String(c.defaultWhtPercent),
      }))}
      documentId={id}
    />
  );
}
