import { DocumentTable } from "../document-table";

export const metadata = { title: "ใบเสนอราคา — HYEV" };

export default function QuotationDocumentsPage() {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-slate-900">ใบเสนอราคา (QUOTATION)</h2>
      <DocumentTable kind="QUOTATION" />
    </section>
  );
}
