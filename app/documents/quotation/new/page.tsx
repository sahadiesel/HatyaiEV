import { CommercialDocumentForm } from "@/components/documents/CommercialDocumentForm";
import { loadClientsForDocument } from "../../document-page-data";

export const metadata = { title: "สร้างใบเสนอราคา — HYEV" };

export default async function NewQuotationPage() {
  const clients = await loadClientsForDocument();
  return (
    <CommercialDocumentForm kind="QUOTATION" listHref="/documents/quotation" clients={clients} />
  );
}
