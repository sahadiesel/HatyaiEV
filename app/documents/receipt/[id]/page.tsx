import { CommercialDocumentForm } from "@/components/documents/CommercialDocumentForm";
import { loadClientsForDocument } from "../../document-page-data";

export const metadata = { title: "แก้ไขใบเสร็จรับเงิน — HYEV" };

export default async function EditReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const clients = await loadClientsForDocument();
  return (
    <CommercialDocumentForm
      kind="RECEIPT"
      listHref="/documents/receipt"
      clients={clients}
      documentId={id}
    />
  );
}
