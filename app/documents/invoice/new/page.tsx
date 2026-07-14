import { CommercialDocumentForm } from "@/components/documents/CommercialDocumentForm";
import { loadClientsForDocument } from "../../document-page-data";

export const metadata = { title: "สร้างใบแจ้งหนี้ — HYEV" };

export default async function NewInvoicePage() {
  const clients = await loadClientsForDocument();
  return (
    <CommercialDocumentForm kind="INVOICE" listHref="/documents/invoice" clients={clients} />
  );
}
