"use client";

import { ReceiptForm } from "@/components/documents/ReceiptForm";
import type { ClientOption } from "@/components/documents/CommercialDocumentForm";

export function ReceiptFromInvoiceClient({
  clients,
  taxInvoiceId,
  vehicleId,
}: {
  clients: ClientOption[];
  taxInvoiceId?: string;
  vehicleId?: string;
}) {
  return (
    <ReceiptForm clients={clients} taxInvoiceId={taxInvoiceId} vehicleId={vehicleId} />
  );
}
