import Link from "next/link";

export const metadata = { title: "สร้างใบกำกับภาษี — HYEV" };

export default function NewTaxInvoicePage() {
  return (
    <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">สร้างใบกำกับภาษี</h2>
      <p className="text-sm text-slate-600">
        ฟอร์มกรอกและบันทึก <strong>ใบกำกับภาษี (TAX_INVOICE)</strong> ลงฐานข้อมูลจะเพิ่มในขั้นถัดไป
      </p>
      <Link href="/documents/tax-invoice" className="inline-block text-sm text-blue-800 hover:underline">
        ← กลับรายการ
      </Link>
    </section>
  );
}
