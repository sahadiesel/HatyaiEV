import { CommercialDocumentForm } from "@/components/documents/CommercialDocumentForm";
import { loadClientsForDocument } from "../../document-page-data";

export const metadata = { title: "สร้างใบเสร็จรับเงิน — HYEV" };

export default async function NewReceiptPage() {
  const clients = await loadClientsForDocument();
  return (
    <CommercialDocumentForm kind="RECEIPT" listHref="/documents/receipt" clients={clients} />
  );
}
