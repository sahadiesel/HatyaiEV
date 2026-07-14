import { CommercialDocumentForm } from "@/components/documents/CommercialDocumentForm";
import { loadClientsForDocument, loadCommercialDocument } from "../../document-page-data";

export const metadata = { title: "แก้ไขใบเสร็จรับเงิน — HYEV" };

export default async function EditReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [clients, initial] = await Promise.all([
    loadClientsForDocument(),
    loadCommercialDocument(id, "RECEIPT"),
  ]);
  return (
    <CommercialDocumentForm
      kind="RECEIPT"
      listHref="/documents/receipt"
      clients={clients}
      initial={initial}
    />
  );
}
