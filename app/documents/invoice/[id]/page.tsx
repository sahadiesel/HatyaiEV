import { CommercialDocumentForm } from "@/components/documents/CommercialDocumentForm";
import { loadClientsForDocument } from "../../document-page-data";

export const metadata = { title: "แก้ไขใบแจ้งหนี้ — HYEV" };

export default async function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const clients = await loadClientsForDocument();
  return (
    <CommercialDocumentForm
      kind="INVOICE"
      listHref="/documents/invoice"
      clients={clients}
      documentId={id}
    />
  );
}
