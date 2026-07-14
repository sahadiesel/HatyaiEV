"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import {
  deleteVehicleBrandClient,
  listVehicleBrandsClient,
  saveVehicleBrandClient,
  type VehicleBrandRecord,
} from "@/lib/vehicle-brands-client";

const inp =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

export function VehicleBrandsSettingsClient() {
  const [rows, setRows] = useState<VehicleBrandRecord[]>([]);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [msgOk, setMsgOk] = useState(true);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [modelsText, setModelsText] = useState("");

  const reload = useCallback(async () => {
    setRows(await listVehicleBrandsClient());
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  function openNew() {
    setEditingId(null);
    setName("");
    setModelsText("");
    setMsg(null);
  }

  function openEdit(b: VehicleBrandRecord) {
    setEditingId(b.id);
    setName(b.name);
    setModelsText(b.models.join("\n"));
    setMsg(null);
  }

  function onSave(e: React.FormEvent) {
    e.preventDefault();
    const models = modelsText
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean);
    startTransition(async () => {
      const res = await saveVehicleBrandClient({
        id: editingId,
        name,
        models,
      });
      if (!res.ok) {
        setMsgOk(false);
        setMsg(res.message);
        return;
      }
      await reload();
      openNew();
      setMsgOk(true);
      setMsg("บันทึกแล้ว");
    });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">ตั้งค่ารถยนต์</h1>
        <p className="mt-1 text-sm text-slate-600">
          กำหนดยี่ห้อและรุ่นย่อย เพื่อเลือกใช้ตอนรับรถเข้าสต็อกและสร้างสัญญา
        </p>
      </div>

      {msg && (
        <p
          className={
            msgOk
              ? "rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
              : "rounded-md bg-red-50 px-3 py-2 text-sm text-red-800"
          }
        >
          {msg}
        </p>
      )}

      <form onSubmit={onSave} className="space-y-3 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-slate-900">
          {editingId ? "แก้ไขยี่ห้อ" : "เพิ่มยี่ห้อใหม่"}
        </h2>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">ยี่ห้อ *</span>
          <input
            className={inp}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="เช่น Toyota"
            required
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">รุ่นย่อย * (หนึ่งรุ่นต่อบรรทัด หรือคั่นด้วยจุลภาค)</span>
          <textarea
            className={inp}
            rows={5}
            value={modelsText}
            onChange={(e) => setModelsText(e.target.value)}
            placeholder={"Altis\nVigo\nPrado\nCorona\nCorolla"}
            required
          />
        </label>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {pending ? "กำลังบันทึก…" : "บันทึก"}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={openNew}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700"
            >
              ยกเลิกแก้ไข
            </button>
          )}
        </div>
      </form>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="border-b bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-3 py-2">ยี่ห้อ</th>
              <th className="px-3 py-2">รุ่นย่อย</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={3} className="px-3 py-8 text-center text-slate-500">
                  ยังไม่มีข้อมูล — เพิ่มยี่ห้อด้านบน เช่น Toyota พร้อมรุ่น Altis, Vigo, …
                </td>
              </tr>
            )}
            {rows.map((b) => (
              <tr key={b.id} className="border-b border-slate-100">
                <td className="px-3 py-2 font-medium text-slate-900">{b.name}</td>
                <td className="px-3 py-2 text-slate-700">{b.models.join(", ")}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <button type="button" className="text-blue-700 hover:underline" onClick={() => openEdit(b)}>
                    แก้ไข
                  </button>
                  <button
                    type="button"
                    className="ml-3 text-red-600 hover:underline"
                    disabled={pending}
                    onClick={() => {
                      if (!confirm(`ลบยี่ห้อ ${b.name}?`)) return;
                      startTransition(async () => {
                        const res = await deleteVehicleBrandClient(b.id);
                        if (!res.ok) {
                          setMsgOk(false);
                          setMsg(res.message);
                          return;
                        }
                        await reload();
                        if (editingId === b.id) openNew();
                        setMsgOk(true);
                        setMsg("ลบแล้ว");
                      });
                    }}
                  >
                    ลบ
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
