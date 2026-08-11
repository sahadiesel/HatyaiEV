import { DocumentsSubnav } from "@/app/documents/DocumentsSubnav";

/** สัญญารับจ้าง / สัญญาว่าจ้าง แสดงภายใต้ศูนย์เอกสาร (ไม่ซ้ำเมนูไซด์บาร์) */
export default function ContractsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">ศูนย์เอกสารทางกฎหมายและบัญชี</h1>
        <p className="mt-1 text-sm text-slate-600">
          ใบแจ้งหนี้ · ใบกำกับภาษี · ใบเสร็จ · หัก ณ ที่จ่าย · ใบสำคัญจ่าย · สัญญาซื้อ · สัญญาขาย · สัญญารับจ้าง ·
          สัญญาว่าจ้าง
        </p>
      </div>
      <DocumentsSubnav />
      {children}
    </div>
  );
}
