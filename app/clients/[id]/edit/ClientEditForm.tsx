"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateClient } from "../../actions";

export type ClientFormValues = {
  id: string;
  name: string;
  taxId: string;
  address: string;
  phone: string;
  email: string;
  notes: string;
};

const inp =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

export function ClientEditForm({ client }: { client: ClientFormValues }) {  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const r = await updateClient(fd);
      if (!r.ok) {
        setMsg(r.message);
        return;
      }
      router.push("/clients");
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <input type="hidden" name="id" value={client.id} />
      {msg && <p className="text-sm text-red-700">{msg}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          required
          name="name"
          defaultValue={client.name}
          placeholder="ชื่อ / บริษัท *"
          className={inp}
          disabled={pending}
        />
        <input name="taxId" defaultValue={client.taxId} placeholder="เลขผู้เสียภาษี" className={inp} disabled={pending} />
        <input name="phone" defaultValue={client.phone} placeholder="โทรศัพท์" className={inp} disabled={pending} />
        <input name="email" defaultValue={client.email} placeholder="อีเมล" className={inp} disabled={pending} />
      </div>
      <textarea name="address" defaultValue={client.address} placeholder="ที่อยู่" rows={2} className={inp} disabled={pending} />
      <textarea name="notes" defaultValue={client.notes} placeholder="หมายเหตุ" rows={2} className={inp} disabled={pending} />
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {pending ? "กำลังบันทึก…" : "บันทึก"}
        </button>
        <Link href="/clients" className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-800 hover:bg-slate-50">
          ยกเลิก
        </Link>
      </div>
    </form>
  );
}
