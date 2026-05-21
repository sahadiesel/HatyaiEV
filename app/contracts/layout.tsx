import { ContractSubnav } from "./ContractSubnav";

export default function ContractsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <header className="sticky top-0 z-30 -mx-6 border-b border-slate-200 bg-slate-50/95 px-6 pb-3 pt-1 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-slate-50/80">
        <h1 className="text-2xl font-bold text-slate-900">เอกสารสัญญา</h1>
        <p className="mt-1 text-sm text-slate-600">เลือกประเภทสัญญา — รายละเอียดและงวดเงินกำหนดได้ในหน้าแก้ไขสัญญา</p>
        <div className="mt-3">
          <ContractSubnav />
        </div>
      </header>
      {children}
    </div>
  );
}
