import Link from "next/link";

export const metadata = { title: "สร้างใบแจ้งหนี้ — HYEV" };

export default function NewInvoicePage() {
  return (
    <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">สร้างใบแจ้งหนี้</h2>
      <p className="text-sm text-slate-600">
        ฟอร์มกรอกและบันทึก <strong>ใบแจ้งหนี้ (INVOICE)</strong> ลงฐานข้อมูลจะเพิ่มในขั้นถัดไป
      </p>
      <Link href="/documents/invoice" className="inline-block text-sm text-blue-800 hover:underline">
        ← กลับรายการ
      </Link>
    </section>
  );
}
