import { DocumentTable } from "../document-table";

export const metadata = { title: "ใบหักภาษี ณ ที่จ่าย — HYEV" };

export default function WithholdingDocumentsPage() {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-slate-900">ใบหักภาษี ณ ที่จ่าย (WITHHOLDING_TAX)</h2>
      <DocumentTable kind="WITHHOLDING_TAX" />
    </section>
  );
}
