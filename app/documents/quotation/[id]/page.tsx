import { CommercialDocumentForm } from "@/components/documents/CommercialDocumentForm";
import { loadClientsForDocument } from "../../document-page-data";

export const metadata = { title: "แก้ไขใบเสนอราคา — HYEV" };

export default async function EditQuotationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const clients = await loadClientsForDocument();
  return (
    <CommercialDocumentForm
      kind="QUOTATION"
      listHref="/documents/quotation"
      clients={clients}
      documentId={id}
    />
  );
}
