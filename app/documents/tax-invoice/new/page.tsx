import { CommercialDocumentForm } from "@/components/documents/CommercialDocumentForm";
import { loadClientsForDocument } from "../../document-page-data";

export const metadata = { title: "สร้างใบกำกับภาษี — HYEV" };

export default async function NewTaxInvoicePage() {
  const clients = await loadClientsForDocument();
  return (
    <CommercialDocumentForm kind="TAX_INVOICE" listHref="/documents/tax-invoice" clients={clients} />
  );
}
