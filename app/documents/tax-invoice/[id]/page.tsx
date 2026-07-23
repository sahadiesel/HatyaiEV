import { CommercialDocumentForm } from "@/components/documents/CommercialDocumentForm";
import { loadClientsForDocument } from "../../document-page-data";

export const metadata = { title: "แก้ไขใบกำกับภาษี — HYEV" };

export default async function EditTaxInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const clients = await loadClientsForDocument();
  return (
    <CommercialDocumentForm
      kind="TAX_INVOICE"
      listHref="/documents/tax-invoice"
      clients={clients}
      documentId={id}
    />
  );
}
