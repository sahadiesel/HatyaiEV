import { ContractSubnav } from "./ContractSubnav";

export default function ContractsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">เอกสารสัญญา</h1>
        <p className="mt-1 text-sm text-slate-600">เลือกประเภทสัญญา — รายละเอียดและงวดเงินกำหนดได้ในหน้าแก้ไขสัญญา</p>
      </div>
      <ContractSubnav />
      {children}
    </div>
  );
}
