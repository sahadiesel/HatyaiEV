"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { UserProfile } from "@/lib/auth-utils";
import { APP_MENUS, type AppRoleDefinition } from "@/lib/menu-access";
import { listAppRoles } from "@/lib/roles-firestore";
import { listAllUsers, updateUserProfileByAdmin } from "@/lib/users-firestore";

function accountStatusLabel(u: UserProfile): string {
  if (u.rejected) return "ปฏิเสธแล้ว";
  if (u.approved) return "อนุมัติแล้ว";
  return "รออนุมัติ";
}

function accountStatusClass(u: UserProfile): string {
  if (u.rejected) return "bg-red-100 text-red-800";
  if (u.approved) return "bg-green-100 text-green-800";
  return "bg-amber-100 text-amber-900";
}

function formatMenuRights(role: AppRoleDefinition | undefined): string {
  if (!role) return "—";
  const parts = APP_MENUS.filter((m) => {
    const level = role.menus[m.id];
    return level === "view" || level === "edit";
  }).map((m) => {
    const level = role.menus[m.id];
    return `${m.label} (${level === "edit" ? "แก้ไข" : "ดู"})`;
  });
  return parts.length > 0 ? parts.join(", ") : "ไม่มีสิทธิ์เมนู";
}

function systemRoleLabel(u: UserProfile, roleName: string | undefined): string {
  if (u.role === "admin") return "ผู้ดูแลระบบ (สิทธิ์ครบทุกเมนู)";
  if (roleName) return roleName;
  if (u.appRoleId) return `บทบาทไม่พบ (${u.appRoleId})`;
  return "ยังไม่กำหนดบทบาท";
}

export function UsersDirectoryPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [roles, setRoles] = useState<AppRoleDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<UserProfile | null>(null);
  const [form, setForm] = useState({ name: "", address: "", phone: "", recoveryEmail: "" });
  const [saving, setSaving] = useState(false);

  const roleById = useMemo(() => new Map(roles.map((r) => [r.id, r])), [roles]);

  const load = useCallback(async () => {
    setLoading(true);
    const [userList, roleList] = await Promise.all([listAllUsers(), listAppRoles()]);
    setUsers(userList);
    setRoles(roleList);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      const hay = [u.name, u.nationalId, u.phone, u.address, u.recoveryEmail ?? ""].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [users, search]);

  function openEdit(u: UserProfile) {
    setEditing(u);
    setForm({
      name: u.name,
      address: u.address,
      phone: u.phone,
      recoveryEmail: u.recoveryEmail ?? "",
    });
    setMessage(null);
  }

  function closeEdit() {
    setEditing(null);
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    setMessage(null);
    const res = await updateUserProfileByAdmin(editing.uid, form);
    setSaving(false);
    if (!res.ok) {
      setMessage(res.message);
      return;
    }
    setMessage("บันทึกรายละเอียดผู้ใช้แล้ว");
    closeEdit();
    await load();
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">ผู้ใช้งาน</h2>
          <p className="mt-1 text-sm text-slate-600">
            รายชื่อผู้สมัครทั้งหมด สถานะบัญชี บทบาท/สิทธิ์เมนู และข้อมูลที่ลงทะเบียน
          </p>
        </div>
        <label className="block text-sm">
          <span className="sr-only">ค้นหา</span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหา ชื่อ / เลขบัตร / โทร"
            className="w-56 rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:w-64"
          />
        </label>
      </div>

      {message && (
        <p className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900">{message}</p>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">กำลังโหลด…</p>
      ) : filtered.length === 0 ? (
        <p className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500">ไม่พบผู้ใช้</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-700">
                <th className="px-3 py-2 font-medium">ข้อมูลลงทะเบียน</th>
                <th className="px-3 py-2 font-medium">เลขบัตรประชาชน</th>
                <th className="px-3 py-2 font-medium">โทรศัพท์</th>
                <th className="px-3 py-2 font-medium">สถานะ</th>
                <th className="px-3 py-2 font-medium">บทบาท / สิทธิ์</th>
                <th className="px-3 py-2 font-medium">สิทธิ์เมนู (จากบทบาท)</th>
                <th className="px-3 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => {
                const appRole = u.appRoleId ? roleById.get(u.appRoleId) : undefined;
                return (
                  <tr key={u.uid} className="border-b border-slate-100 align-top">
                    <td className="px-3 py-3">
                      <p className="font-medium text-slate-900">{u.name || "—"}</p>
                      <p className="mt-0.5 text-xs text-slate-500 line-clamp-2">{u.address || "—"}</p>
                      <p className="text-xs text-slate-500">{u.recoveryEmail || "—"}</p>
                    </td>
                    <td className="px-3 py-3 text-slate-700">{u.nationalId || "—"}</td>
                    <td className="px-3 py-3 text-slate-700">{u.phone || "—"}</td>
                    <td className="px-3 py-3">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${accountStatusClass(u)}`}>
                        {accountStatusLabel(u)}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-slate-700">{systemRoleLabel(u, appRole?.name)}</td>
                    <td className="max-w-xs px-3 py-3 text-xs text-slate-600">
                      {u.role === "admin" ? "ทุกเมนู" : formatMenuRights(appRole)}
                    </td>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        onClick={() => openEdit(u)}
                        className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50"
                      >
                        แก้ไข
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-user-title"
          onClick={closeEdit}
        >
          <form
            onSubmit={saveEdit}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-slate-200 bg-white p-5 shadow-xl"
          >
            <h3 id="edit-user-title" className="text-lg font-semibold text-slate-900">
              แก้ไขข้อมูลลงทะเบียน
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              {editing.name} · เลขบัตร {editing.nationalId} (แก้เลขบัตรไม่ได้)
            </p>

            <div className="mt-4 space-y-3">
              <label className="block text-sm">
                <span className="font-medium text-slate-700">ชื่อ-นามสกุล *</span>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className={inp}
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium text-slate-700">ที่อยู่</span>
                <textarea
                  rows={2}
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  className={inp}
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium text-slate-700">โทรศัพท์</span>
                <input
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  className={inp}
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium text-slate-700">อีเมลสำรอง (ลืมรหัสผ่าน) *</span>
                <input
                  type="email"
                  required
                  value={form.recoveryEmail}
                  onChange={(e) => setForm((f) => ({ ...f, recoveryEmail: e.target.value }))}
                  className={inp}
                />
              </label>
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={closeEdit}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-800 hover:bg-slate-50"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
              >
                {saving ? "กำลังบันทึก…" : "บันทึก"}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}

const inp =
  "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";
