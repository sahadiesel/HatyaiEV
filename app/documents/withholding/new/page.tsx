import Link from "next/link";

export const metadata = { title: "สร้างใบหักภาษี ณ ที่จ่าย — HYEV" };

export default function NewWithholdingPage() {
  return (
    <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">สร้างใบหักภาษี ณ ที่จ่าย</h2>
      <p className="text-sm text-slate-600">
        ฟอร์มกรอกและบันทึก <strong>หัก ณ ที่จ่าย (WITHHOLDING_TAX)</strong> ลงฐานข้อมูลจะเพิ่มในขั้นถัดไป
      </p>
      <Link href="/documents/withholding" className="inline-block text-sm text-blue-800 hover:underline">
        ← กลับรายการ
      </Link>
    </section>
  );
}
