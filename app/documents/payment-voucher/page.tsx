import { DocumentTable } from "../document-table";

export const metadata = { title: "ใบสำคัญจ่าย — HYEV" };

export default function PaymentVoucherDocumentsPage() {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-slate-900">ใบสำคัญจ่าย (PAYMENT_VOUCHER)</h2>
      <DocumentTable kind="PAYMENT_VOUCHER" />
    </section>
  );
}
