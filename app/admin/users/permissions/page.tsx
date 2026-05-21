"use client";

import { useCallback, useEffect, useState } from "react";
import type { UserProfile } from "@/lib/auth-utils";
import type { AppRoleDefinition } from "@/lib/menu-access";
import { listAppRoles } from "@/lib/roles-firestore";
import { listApprovedUsers, updateUserAppRoleId } from "@/lib/users-firestore";

export default function UserPermissionsPage() {
  const [rows, setRows] = useState<UserProfile[]>([]);
  const [roles, setRoles] = useState<AppRoleDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const [list, roleList] = await Promise.all([listApprovedUsers(), listAppRoles()]);
    const users = list.filter((u) => u.role !== "admin");
    setRows(users);
    setRoles(roleList);
    const next: Record<string, string> = {};
    for (const u of users) {
      next[u.uid] = u.appRoleId;
    }
    setDraft(next);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(uid: string) {
    const res = await updateUserAppRoleId(uid, draft[uid] ?? "");
    if (res.ok) {
      setMessage("บันทึกบทบาทผู้ใช้แล้ว");
      await load();
    } else {
      setMessage(res.message);
    }
  }

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-900">การกำหนดสิทธิ์ผู้ใช้งาน</h2>
      <p className="text-sm text-slate-600">
        ผู้ดูแลระบบมีสิทธิ์ครบทุกเมนูโดยอัตโนมัติ — กำหนดบทบาทให้ผู้ใช้ที่อนุมัติแล้ว (สิทธิ์ตามแท็บ role&amp;permission)
      </p>
      {message && (
        <p className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900">{message}</p>
      )}
      {loading ? (
        <p className="text-sm text-slate-500">กำลังโหลด…</p>
      ) : rows.length === 0 ? (
        <p className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500">ยังไม่มีผู้ใช้ที่อนุมัติแล้ว</p>
      ) : roles.length === 0 ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          ยังไม่มีบทบาท — สร้างบทบาทที่แท็บ role&amp;permission ก่อน
        </p>
      ) : (
        <ul className="space-y-4">
          {rows.map((u) => (
            <li key={u.uid} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <p className="font-medium text-slate-900">
                {u.name} <span className="text-sm font-normal text-slate-500">({u.nationalId})</span>
              </p>
              <label className="mt-3 block text-sm text-slate-700">
                บทบาท
                <select
                  value={draft[u.uid] ?? ""}
                  onChange={(e) => setDraft((prev) => ({ ...prev, [u.uid]: e.target.value }))}
                  className="mt-1 block w-full max-w-md rounded-md border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">— ยังไม่กำหนด —</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={() => save(u.uid)}
                className="mt-3 rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-800"
              >
                บันทึก
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
