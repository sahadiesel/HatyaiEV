"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createContractor, deleteContractor } from "./actions";

export type ContractorRow = {
  id: string;
  code: string | null;
  name: string;
  taxId: string;
  defaultWhtPercent: string;
};

const inp =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

export function ContractorPageShell({ initialRows }: { initialRows: ContractorRow[] }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setMsg(null);
    const fd = new FormData(form);
    startTransition(async () => {
      const r = await createContractor(fd);
      if (!r.ok) {
        setMsg(r.message);
        return;
      }
      form.reset();
      setShowForm(false);
      router.refresh();
    });
  }

  function onDelete(id: string, name: string) {
    if (!window.confirm(`ลบผู้รับเหมา "${name}" ?\nการลบไม่สามารถย้อนกลับได้`)) return;
    startTransition(async () => {
      const r = await deleteContractor(id);
      if (!r.ok) {
        window.alert(r.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">ผู้รับเหมา</h1>
          <p className="mt-1 text-sm text-slate-600">
            ใช้ออกใบสั่งจ้าง และเอกสารหัก ณ ที่จ่าย · เลขที่อ้างอิงสร้างอัตโนมัติ (CR-ปี-ลำดับ)
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setShowForm((v) => !v);
            setMsg(null);
          }}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          {showForm ? "ปิดฟอร์ม" : "สร้าง"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={onCreate} className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="font-semibold text-slate-900">เพิ่มผู้รับเหมา</h2>
          {msg && <p className="text-sm text-red-700">{msg}</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            <input required name="name" placeholder="ชื่อ / บริษัท *" className={inp} disabled={pending} />
            <input name="taxId" placeholder="เลขผู้เสียภาษี" className={inp} disabled={pending} />
            <input name="defaultWhtPercent" placeholder="หัก ณ ที่จ่าย % (ค่าเริ่มต้น 1)" defaultValue="1" className={inp} disabled={pending} />
            <input name="phone" placeholder="โทรศัพท์" className={inp} disabled={pending} />
            <input name="email" placeholder="อีเมล" className={inp} disabled={pending} />
            <input name="bankName" placeholder="ธนาคาร" className={inp} disabled={pending} />
            <input name="bankAccount" placeholder="เลขบัญชี" className={inp} disabled={pending} />
          </div>
          <textarea name="address" placeholder="ที่อยู่" rows={2} className={inp} disabled={pending} />
          <textarea name="notes" placeholder="หมายเหตุ" rows={2} className={inp} disabled={pending} />
          <button type="submit" disabled={pending} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60">
            {pending ? "กำลังบันทึก…" : "บันทึก"}
          </button>
        </form>
      )}

      <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white shadow-sm">
        {initialRows.length === 0 ? (
          <li className="p-4 text-sm text-slate-500">ยังไม่มีข้อมูล — กดปุ่ม &quot;สร้าง&quot; เพื่อเพิ่ม</li>
        ) : (
          initialRows.map((c) => (
            <li key={c.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
              <div>
                <p className="font-mono text-xs text-slate-500">{c.code ?? "— (ข้อมูลเก่า)"}</p>
                <p className="font-medium text-slate-900">{c.name}</p>
                <p className="text-sm text-slate-600">
                  หัก ณ ที่จ่ายเริ่มต้น {c.defaultWhtPercent}%
                  {c.taxId && ` · เลขผู้เสียภาษี ${c.taxId}`}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Link
                  href={`/contractors/${c.id}/edit`}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-800 hover:bg-slate-50"
                >
                  แก้ไข
                </Link>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => onDelete(c.id, c.name)}
                  className="rounded-md border border-red-200 bg-white px-3 py-1.5 text-sm text-red-800 hover:bg-red-50 disabled:opacity-50"
                >
                  ลบ
                </button>
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
