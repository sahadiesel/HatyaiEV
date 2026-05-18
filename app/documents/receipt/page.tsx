import { DocumentTable } from "../document-table";

export const metadata = { title: "ใบเสร็จรับเงิน — HYEV" };

export default function ReceiptDocumentsPage() {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-slate-900">ใบเสร็จรับเงิน (RECEIPT)</h2>
      <DocumentTable kind="RECEIPT" />
    </section>
  );
}
