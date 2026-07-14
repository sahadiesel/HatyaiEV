"use client";

import Link from "next/link";
import { useState } from "react";
import { updateVehicleInspection } from "@/app/contracts/hiring-contracts/vehicle-actions";
import {
  VEHICLE_INSPECTION_ITEMS,
  type InspectionStatus,
  type VehicleInspectionRow,
} from "@/lib/vehicle-inspection-items";

const STATUS_OPTIONS: { value: InspectionStatus; label: string }[] = [
  { value: "GOOD", label: "ปกติ/ดี" },
  { value: "USABLE", label: "ใช้ได้" },
  { value: "BAD", label: "ไม่ดี/ผิดปกติ" },
  { value: null, label: "—" },
];

export function VehicleProgressEditor({
  contractId,
  contractCode,
  lineIndex,
  licensePlate,
  brand,
  model,
  year,
  initialRows,
}: {
  contractId: string;
  contractCode: string;
  lineIndex: number;
  licensePlate: string;
  brand: string;
  model: string;
  year: string;
  initialRows: VehicleInspectionRow[];
}) {
  const [rows, setRows] = useState(initialRows);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function updateRow(itemIndex: number, patch: Partial<VehicleInspectionRow>) {
    setRows((prev) => prev.map((r) => (r.itemIndex === itemIndex ? { ...r, ...patch } : r)));
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setMessage(null);
    setError(null);
    const res = await updateVehicleInspection(contractId, lineIndex, JSON.stringify(rows));
    setPending(false);
    if (res.ok) setMessage("บันทึกความคืบหน้าแล้ว");
    else setError(res.message);
  }

  const vehicleLabel = [licensePlate, brand, model, year].filter(Boolean).join(" · ") || `คันที่ ${lineIndex}`;

  return (
    <form onSubmit={onSave} className="space-y-6">
      <div>
        <p className="text-sm text-slate-600">
          <Link href={`/contracts/hiring-contracts/${contractId}`} className="text-blue-800 hover:underline">
            ← กลับสัญญารับจ้าง {contractCode}
          </Link>
        </p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">รายละเอียดความคืบหน้างาน</h1>
        <p className="mt-1 text-sm text-slate-600">
          คันที่ {lineIndex} — {vehicleLabel}
        </p>
        <p className="mt-2 text-xs text-slate-500">แบบตรวจสอบงานมอบรถยนต์ — 14 รายการตรวจรับ</p>
      </div>

      {message && (
        <p className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900">{message}</p>
      )}
      {error && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">{error}</p>}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-slate-700">
              <th className="px-3 py-2 w-12">ลำดับ</th>
              <th className="px-3 py-2">รายการตรวจรับ</th>
              <th className="px-3 py-2">ผลการตรวจรับ</th>
              <th className="px-3 py-2">หมายเหตุ</th>
            </tr>
          </thead>
          <tbody>
            {VEHICLE_INSPECTION_ITEMS.map((item) => {
              const row = rows.find((r) => r.itemIndex === item.index)!;
              return (
                <tr key={item.index} className="border-b border-slate-100">
                  <td className="px-3 py-2 text-slate-600">{item.index}</td>
                  <td className="px-3 py-2 text-slate-900">{item.label}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-3">
                      {STATUS_OPTIONS.map((opt) => (
                        <label key={String(opt.value)} className="inline-flex items-center gap-1.5 text-xs text-slate-700">
                          <input
                            type="radio"
                            name={`status-${item.index}`}
                            checked={row.status === opt.value}
                            onChange={() => updateRow(item.index, { status: opt.value })}
                          />
                          {opt.label}
                        </label>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      value={row.remarks}
                      onChange={(e) => updateRow(item.index, { remarks: e.target.value })}
                      className="w-full min-w-[140px] rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                      placeholder="หมายเหตุ"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
        <strong>ผ่านเงื่อนไข:</strong> รถขับเคลื่อนได้ เปลี่ยนของเหลวครบ และผลตรวจเป็น ปกติ/ดี หรือมีข้อบกพร่องเล็กน้อย ·{" "}
        <strong>ไม่ผ่าน:</strong> ระบุเหตุผลในหมายเหตุ
      </p>

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
      >
        {pending ? "กำลังบันทึก…" : "บันทึกความคืบหน้า"}
      </button>
    </form>
  );
}
