import { DocumentTable } from "../document-table";

export const metadata = { title: "ใบแจ้งหนี้ — HYEV" };

export default function InvoiceDocumentsPage() {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-slate-900">ใบแจ้งหนี้ (INVOICE)</h2>
      <DocumentTable kind="INVOICE" />
    </section>
  );
}
