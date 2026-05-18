import { DocumentsSubnav } from "./DocumentsSubnav";

export default function DocumentsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">การจัดการเอกสาร</h1>
        <p className="mt-1 text-sm text-slate-600">เลือกประเภทเอกสารจากแท็บด้านล่าง แล้วกดสร้างเอกสารเมื่อต้องการเพิ่มรายการใหม่</p>
      </div>
      <DocumentsSubnav />
      {children}
    </div>
  );
}
