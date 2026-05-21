"use client";

import { useCallback, useEffect, useState } from "react";
import { APP_MENUS, emptyMenuAccess, type AppRoleDefinition, type MenuAccessLevel, type MenuId } from "@/lib/menu-access";
import {
  createAppRole,
  deleteAppRole,
  ensureDefaultAppRole,
  listAppRoles,
  updateAppRole,
} from "@/lib/roles-firestore";

const ACCESS_OPTIONS: { value: MenuAccessLevel; label: string }[] = [
  { value: "none", label: "ไม่มีสิทธิ์" },
  { value: "view", label: "ดูอย่างเดียว" },
  { value: "edit", label: "แก้ไขได้" },
];

export default function RolesPermissionPage() {
  const [roles, setRoles] = useState<AppRoleDefinition[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [menus, setMenus] = useState<Record<MenuId, MenuAccessLevel>>(emptyMenuAccess());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isNew, setIsNew] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      await ensureDefaultAppRole();
      const list = await listAppRoles();
      setRoles(list);
      setLoading(false);
      return list;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setMessage(msg);
      setRoles([]);
      setLoading(false);
      return [];
    }
  }, []);

  useEffect(() => {
    void load().then((list) => {
      if (list.length > 0 && !selectedId && !isNew) {
        selectRole(list[0]);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial pick only
  }, [load]);

  function selectRole(role: AppRoleDefinition) {
    setIsNew(false);
    setSelectedId(role.id);
    setName(role.name);
    const next = emptyMenuAccess();
    for (const m of APP_MENUS) {
      const level = role.menus[m.id];
      if (level === "view" || level === "edit") next[m.id] = level;
    }
    setMenus(next);
    setMessage(null);
  }

  function startNewRole() {
    setIsNew(true);
    setSelectedId(null);
    setName("");
    setMenus(emptyMenuAccess());
    setMessage(null);
  }

  function setMenuLevel(menuId: MenuId, level: MenuAccessLevel) {
    setMenus((prev) => ({ ...prev, [menuId]: level }));
  }

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    const menuPayload: Partial<Record<MenuId, MenuAccessLevel>> = {};
    for (const m of APP_MENUS) {
      if (menus[m.id] !== "none") menuPayload[m.id] = menus[m.id];
    }

    const res =
      isNew || !selectedId
        ? await createAppRole(name, menuPayload)
        : await updateAppRole(selectedId, name, menuPayload);

    setSaving(false);
    if (!res.ok) {
      setMessage(res.message);
      return;
    }

    setMessage("บันทึกบทบาทแล้ว");
    const list = await load();
    if ("id" in res) {
      const created = list.find((r) => r.id === res.id);
      if (created) selectRole(created);
    } else if (selectedId) {
      const updated = list.find((r) => r.id === selectedId);
      if (updated) selectRole(updated);
    }
    setIsNew(false);
  }

  async function handleDelete() {
    if (!selectedId || isNew) return;
    if (!window.confirm("ลบบทบาทนี้? ผู้ใช้ที่ผูกบทบาทนี้จะต้องกำหนดบทบาทใหม่")) return;

    setSaving(true);
    const res = await deleteAppRole(selectedId);
    setSaving(false);
    if (!res.ok) {
      setMessage(res.message);
      return;
    }
    setMessage("ลบบทบาทแล้ว");
    setSelectedId(null);
    setIsNew(false);
    const list = await load();
    if (list.length > 0) selectRole(list[0]);
    else startNewRole();
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Role &amp; Permission</h2>
          <p className="mt-1 text-sm text-slate-600">
            สร้างชื่อบทบาท แล้วกำหนดแต่ละเมนูว่าไม่มีสิทธิ์ ดูอย่างเดียว หรือแก้ไขได้
          </p>
        </div>
        <button
          type="button"
          onClick={startNewRole}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
        >
          + สร้างบทบาทใหม่
        </button>
      </div>

      {message && (
        <p
          className={
            message.includes("ไม่มีสิทธิ์") || message.includes("permission")
              ? "rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900"
              : "rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900"
          }
        >
          {message}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">กำลังโหลด…</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
          <aside className="space-y-1">
            <p className="px-2 text-xs font-semibold uppercase tracking-wide text-slate-500">บทบาท</p>
            {roles.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => selectRole(r)}
                className={
                  selectedId === r.id && !isNew
                    ? "w-full rounded-md bg-slate-900 px-3 py-2 text-left text-sm font-medium text-white"
                    : "w-full rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
                }
              >
                {r.name}
              </button>
            ))}
            {isNew && (
              <p className="rounded-md border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-600">
                บทบาทใหม่ (ยังไม่บันทึก)
              </p>
            )}
          </aside>

          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <label className="block text-sm font-medium text-slate-700">
              ชื่อบทบาท
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="เช่น พนักงานขาย, หัวหน้างาน"
                className="mt-1 w-full max-w-md rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </label>

            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[480px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-600">
                    <th className="py-2 pr-4 font-medium">เมนู</th>
                    <th className="py-2 font-medium">สิทธิ์</th>
                  </tr>
                </thead>
                <tbody>
                  {APP_MENUS.map((m) => (
                    <tr key={m.id} className="border-b border-slate-100">
                      <td className="py-3 pr-4 text-slate-900">{m.label}</td>
                      <td className="py-3">
                        <div className="flex flex-wrap gap-4">
                          {ACCESS_OPTIONS.map((opt) => (
                            <label key={opt.value} className="inline-flex items-center gap-2 text-slate-700">
                              <input
                                type="radio"
                                name={`menu-${m.id}`}
                                checked={menus[m.id] === opt.value}
                                onChange={() => setMenuLevel(m.id, opt.value)}
                                className="border-slate-300"
                              />
                              {opt.label}
                            </label>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleSave()}
                className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {saving ? "กำลังบันทึก…" : "บันทึกบทบาท"}
              </button>
              {selectedId && !isNew && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void handleDelete()}
                  className="rounded-md border border-red-200 bg-white px-4 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
                >
                  ลบบทบาท
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
