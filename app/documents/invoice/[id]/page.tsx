import { CommercialDocumentForm } from "@/components/documents/CommercialDocumentForm";
import { loadClientsForDocument, loadCommercialDocument } from "../../document-page-data";

export const metadata = { title: "แก้ไขใบแจ้งหนี้ — HYEV" };

export default async function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [clients, initial] = await Promise.all([
    loadClientsForDocument(),
    loadCommercialDocument(id, "INVOICE"),
  ]);
  return (
    <CommercialDocumentForm
      kind="INVOICE"
      listHref="/documents/invoice"
      clients={clients}
      initial={initial}
    />
  );
}
