import { DocumentTable } from "../document-table";

export const metadata = { title: "ใบกำกับภาษี — HYEV" };

export default function TaxInvoiceDocumentsPage() {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-slate-900">ใบกำกับภาษี (TAX_INVOICE)</h2>
      <DocumentTable kind="TAX_INVOICE" />
    </section>
  );
}
