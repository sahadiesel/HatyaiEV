import { ReceiptForm } from "@/components/documents/ReceiptForm";
import { loadClientsForDocument } from "../../document-page-data";

export const metadata = { title: "แก้ไขใบเสร็จรับเงิน — HYEV" };

export default async function EditReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const clients = await loadClientsForDocument();
  return <ReceiptForm clients={clients} documentId={id} />;
}
