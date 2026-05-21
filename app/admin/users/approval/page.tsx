"use client";

import { useCallback, useEffect, useState } from "react";
import type { UserProfile } from "@/lib/auth-utils";
import { approveUser, listPendingUsers, rejectUser } from "@/lib/users-firestore";
import { useAuth } from "@/components/AuthProvider";

export default function UserApprovalPage() {
  const { refreshProfile } = useAuth();
  const [rows, setRows] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const list = await listPendingUsers();
    setRows(list.filter((u) => u.role !== "admin"));
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleApprove(uid: string) {
    const res = await approveUser(uid);
    if (res.ok) {
      setMessage("อนุมัติแล้ว");
      await load();
      await refreshProfile();
    } else {
      setMessage(res.message);
    }
  }

  async function handleReject(uid: string) {
    const res = await rejectUser(uid);
    if (res.ok) {
      setMessage("ปฏิเสธแล้ว");
      await load();
    } else {
      setMessage(res.message);
    }
  }

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-900">การอนุมัติผู้ใช้งาน</h2>
      {message && (
        <p className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900">{message}</p>
      )}
      {loading ? (
        <p className="text-sm text-slate-500">กำลังโหลด…</p>
      ) : rows.length === 0 ? (
        <p className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500">ไม่มีคำขอรออนุมัติ</p>
      ) : (
        <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white shadow-sm">
          {rows.map((u) => (
            <li key={u.uid} className="flex flex-wrap items-start justify-between gap-3 p-4">
              <div>
                <p className="font-medium text-slate-900">{u.name}</p>
                <p className="text-sm text-slate-600">บัตรประชาชน: {u.nationalId}</p>
                <p className="text-sm text-slate-600">โทร: {u.phone}</p>
                <p className="text-sm text-slate-500">{u.address}</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleApprove(u.uid)}
                  className="rounded-md bg-green-700 px-3 py-1.5 text-sm text-white hover:bg-green-800"
                >
                  อนุมัติ
                </button>
                <button
                  type="button"
                  onClick={() => handleReject(u.uid)}
                  className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-800 hover:bg-red-50"
                >
                  ปฏิเสธ
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
