import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { nextHiringContractCode } from "@/lib/contractCodes";
import { createHiringContractDraft } from "../actions";

export default async function NewHiringContractPage() {
  const [clients, previewCode] = await Promise.all([
    prisma.client.findMany({ orderBy: { name: "asc" } }),
    nextHiringContractCode(),
  ]);

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">สร้างสัญญารับจ้าง</h1>
        <p className="mt-1 text-sm text-slate-600">
          เลขที่สัญญาสร้างอัตโนมัติ (รูปแบบ HC-ปี-ลำดับ) จากนั้นไปหน้าแก้ไขเพื่อใส่รถและงวดเงิน
        </p>
        <p className="mt-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          เลขที่ถัดไปโดยประมาณ: <code className="rounded bg-white px-1.5 py-0.5 font-mono text-slate-900">{previewCode}</code>
          <span className="block text-xs text-slate-500">หากมีการสร้างพร้อมกัน ระบบจะข้ามเลขซ้ำให้</span>
        </p>
      </div>

      {clients.length === 0 ? (
        <p className="text-sm text-amber-800">
          ยังไม่มีผู้ว่าจ้าง —{" "}
          <Link href="/clients" className="underline">
            เพิ่มที่เมนูผู้ว่าจ้าง
          </Link>
        </p>
      ) : (
        <form action={createHiringContractDraft} className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <label className="block text-sm">
            <span className="font-medium text-slate-700">ชื่อเรื่องสัญญา (ไม่บังคับ)</span>
            <input name="title" placeholder="เช่น รับซ่อมรถบริษัท …" className={inp} />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-700">ผู้ว่าจ้าง *</span>
            <select required name="clientId" className={inp} defaultValue="">
              <option value="" disabled>
                เลือกผู้ว่าจ้าง
              </option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className={btn}>
            สร้างและไปแก้ไขรายละเอียด
          </button>
        </form>
      )}
      <Link href="/contracts/hiring-contracts" className="text-sm text-blue-800 hover:underline">
        ← กลับรายการสัญญารับจ้าง
      </Link>
    </div>
  );
}

const inp =
  "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";
const btn = "w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800";
