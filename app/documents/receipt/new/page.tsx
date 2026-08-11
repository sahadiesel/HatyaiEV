import { ReceiptFromInvoiceClient } from "../ReceiptFromInvoiceClient";
import { loadClientsForDocument } from "../../document-page-data";

export const metadata = { title: "สร้างใบเสร็จรับเงิน — HYEV" };
export const dynamic = "force-dynamic";

export default async function NewReceiptPage({
  searchParams,
}: {
  searchParams: Promise<{ taxInvoiceId?: string; vehicleId?: string }>;
}) {
  const sp = await searchParams;
  const clients = await loadClientsForDocument();
  return (
    <ReceiptFromInvoiceClient
      clients={clients}
      taxInvoiceId={sp.taxInvoiceId}
      vehicleId={sp.vehicleId}
    />
  );
}
