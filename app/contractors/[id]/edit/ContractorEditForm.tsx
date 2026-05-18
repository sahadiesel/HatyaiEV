"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateContractor } from "../../actions";

/** ค่าที่ส่งจาก Server Component ได้ — ห้ามมี Decimal / BigInt ฯลฯ */
export type ContractorFormValues = {
  id: string;
  code: string | null;
  name: string;
  taxId: string;
  address: string;
  phone: string;
  email: string;
  bankName: string;
  bankAccount: string;
  defaultWhtPercent: string;
  notes: string;
};

const inp =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

export function ContractorEditForm({ contractor }: { contractor: ContractorFormValues }) {  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const r = await updateContractor(fd);
      if (!r.ok) {
        setMsg(r.message);
        return;
      }
      router.push("/contractors");
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <input type="hidden" name="id" value={contractor.id} />
      {msg && <p className="text-sm text-red-700">{msg}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          required
          name="name"
          defaultValue={contractor.name}
          placeholder="ชื่อ / บริษัท *"
          className={inp}
          disabled={pending}
        />
        <input name="taxId" defaultValue={contractor.taxId} placeholder="เลขผู้เสียภาษี" className={inp} disabled={pending} />
        <input
          name="defaultWhtPercent"
          defaultValue={contractor.defaultWhtPercent}
          placeholder="หัก ณ ที่จ่าย %"
          className={inp}
          disabled={pending}
        />
        <input name="phone" defaultValue={contractor.phone} placeholder="โทรศัพท์" className={inp} disabled={pending} />
        <input name="email" defaultValue={contractor.email} placeholder="อีเมล" className={inp} disabled={pending} />
        <input name="bankName" defaultValue={contractor.bankName} placeholder="ธนาคาร" className={inp} disabled={pending} />
        <input name="bankAccount" defaultValue={contractor.bankAccount} placeholder="เลขบัญชี" className={inp} disabled={pending} />
      </div>
      <textarea name="address" defaultValue={contractor.address} placeholder="ที่อยู่" rows={2} className={inp} disabled={pending} />
      <textarea name="notes" defaultValue={contractor.notes} placeholder="หมายเหตุ" rows={2} className={inp} disabled={pending} />
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {pending ? "กำลังบันทึก…" : "บันทึก"}
        </button>
        <Link href="/contractors" className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-800 hover:bg-slate-50">
          ยกเลิก
        </Link>
      </div>
    </form>
  );
}
