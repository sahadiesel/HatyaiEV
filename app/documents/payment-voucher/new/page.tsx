import Link from "next/link";

export const metadata = { title: "สร้างใบสำคัญจ่าย — HYEV" };

export default function NewPaymentVoucherPage() {
  return (
    <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">สร้างใบสำคัญจ่าย</h2>
      <p className="text-sm text-slate-600">
        ฟอร์มกรอกและบันทึก <strong>ใบสำคัญจ่าย (PAYMENT_VOUCHER)</strong> ลงฐานข้อมูลจะเพิ่มในขั้นถัดไป
      </p>
      <Link href="/documents/payment-voucher" className="inline-block text-sm text-blue-800 hover:underline">
        ← กลับรายการ
      </Link>
    </section>
  );
}
