import Link from "next/link";
import { listContractors } from "@/lib/contractors-repository";
import { listHiringContracts } from "@/lib/hiring-contracts-repository";
import { nextSubcontractAgreementCode } from "@/lib/contractCodes";
import { createSubcontractAgreementDraft } from "../actions";

export default async function NewSubcontractAgreementPage() {
  const [contractors, hiring, previewCode] = await Promise.all([
    listContractors(),
    listHiringContracts(),
    nextSubcontractAgreementCode(),
  ]);

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">สร้างสัญญาว่าจ้าง</h1>
        <p className="mt-1 text-sm text-slate-600">
          เลขที่สัญญาสร้างอัตโนมัติ (รูปแบบ SA-ปี-ลำดับ) — เลือกผู้รับเหมาและสัญญารับจ้างอ้างอิง
        </p>
        <p className="mt-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          เลขที่ถัดไปโดยประมาณ: <code className="rounded bg-white px-1.5 py-0.5 font-mono text-slate-900">{previewCode}</code>
          <span className="block text-xs text-slate-500">หากมีการสร้างพร้อมกัน ระบบจะข้ามเลขซ้ำให้</span>
        </p>
      </div>

      {contractors.length === 0 ? (
        <p className="text-sm text-amber-800">
          ยังไม่มีผู้รับเหมา —{" "}
          <Link href="/contractors" className="underline">
            เพิ่มที่เมนูผู้รับเหมา
          </Link>
        </p>
      ) : hiring.length === 0 ? (
        <p className="text-sm text-amber-800">
          ยังไม่มีสัญญารับจ้าง —{" "}
          <Link href="/contracts/hiring-contracts/new" className="underline">
            สร้างสัญญารับจ้างก่อน
          </Link>
        </p>
      ) : (
        <form action={createSubcontractAgreementDraft} className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <label className="block text-sm">
            <span className="font-medium text-slate-700">ชื่อเรื่อง (ไม่บังคับ)</span>
            <input name="title" placeholder="เช่น เหมาซ่อมรถ …" className={inp} />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-700">ผู้รับเหมา *</span>
            <select required name="contractorId" className={inp} defaultValue="">
              <option value="" disabled>
                เลือกผู้รับเหมา
              </option>
              {contractors.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-700">อ้างอิงสัญญารับจ้าง *</span>
            <select required name="hiringContractId" className={inp} defaultValue="">
              <option value="" disabled>
                เลือกสัญญารับจ้าง
              </option>
              {hiring.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.code} — {h.clientName}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className={btn}>
            สร้างและไปแก้ไขรายละเอียด
          </button>
        </form>
      )}
      <Link href="/contracts/subcontract-agreements" className="text-sm text-blue-800 hover:underline">
        ← กลับรายการสัญญาว่าจ้าง
      </Link>
    </div>
  );
}

const inp =
  "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";
const btn = "w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800";
