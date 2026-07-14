"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteRepairContractAction, saveRepairContractAction } from "./actions";
import type { EntityRecord, RepairContractKind, RepairContractRecord, VehicleRecord } from "@/lib/domain-types";
import { formatBaht } from "@/lib/vehicles/calc";
import { parseAmount, roundMoney2 } from "@/lib/documents/calc";

const inp =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

export function ServicesClient({
  contracts,
  entities,
  vehicles,
}: {
  contracts: RepairContractRecord[];
  entities: EntityRecord[];
  vehicles: VehicleRecord[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [kind, setKind] = useState<RepairContractKind>("SERVICE_TO_CUSTOMER");
  const [msg, setMsg] = useState<string | null>(null);
  const [price, setPrice] = useState("0");

  const vat = roundMoney2((parseAmount(price) * 7) / 100);
  const total = roundMoney2(parseAmount(price) + vat);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await saveRepairContractAction(fd);
      if (!res.ok) {
        setMsg(res.message);
        return;
      }
      setShowForm(false);
      setMsg("บันทึกสัญญาแล้ว");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">รับจ้างซ่อม & สัญญา</h1>
          <p className="mt-1 text-sm text-slate-600">
            สัญญารับจ้างซ่อม (กับลูกค้า) และสัญญาจ้างต่อ (อู่นอก/ซัพพลายเออร์) — ดึงข้อมูล Entities อัตโนมัติ
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          + สร้างงานซ่อม
        </button>
      </div>

      {msg && <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{msg}</p>}

      {showForm && (
        <form onSubmit={onSubmit} className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-slate-900">ฟอร์มตกลงราคาค่าซ่อม</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">ประเภทสัญญา</span>
              <select
                name="kind"
                className={inp}
                value={kind}
                onChange={(e) => setKind(e.target.value as RepairContractKind)}
              >
                <option value="SERVICE_TO_CUSTOMER">สัญญารับจ้างซ่อม (HYEV ↔ ลูกค้า)</option>
                <option value="OUTSOURCE_TO_SUPPLIER">สัญญาจ้างต่อ (HYEV ↔ อู่นอก)</option>
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">วันที่</span>
              <input
                name="issueDate"
                type="date"
                className={inp}
                defaultValue={new Date().toISOString().slice(0, 10)}
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">
                {kind === "SERVICE_TO_CUSTOMER" ? "ลูกค้า" : "อู่ / ผู้รับจ้าง"}
              </span>
              <select name="counterpartyEntityId" className={inp} defaultValue="">
                <option value="">— เลือกจาก Entities —</option>
                {entities.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">รถในสต็อกบริษัท (ถ้ามี)</span>
              <select name="vehicleId" className={inp} defaultValue="">
                <option value="">— ไม่ระบุ —</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.brand} {v.model} · {v.licensePlate || v.code}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block text-slate-600">รถลูกค้า / รายละเอียดรถ</span>
              <input name="customerVehicleLabel" className={inp} placeholder="เช่น ทะเบียน กข 1234 Toyota Camry" />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block text-slate-600">อาการ / ขอบเขตงาน</span>
              <textarea name="symptoms" className={inp} rows={3} required placeholder="บันทึกอาการและงานที่จะทำ" />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">ราคาตกลง (ก่อน VAT)</span>
              <input
                name="agreedPriceExVat"
                className={inp}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
              />
            </label>
            <div className="text-sm">
              <p className="mb-1 text-slate-600">VAT 7% / รวม</p>
              <p className="rounded-md bg-slate-50 px-3 py-2 tabular-nums">
                VAT ฿{formatBaht(vat)} · รวม ฿{formatBaht(total)}
              </p>
            </div>
            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block text-slate-600">หัวข้อสัญญา</span>
              <input
                name="title"
                className={inp}
                defaultValue={kind === "SERVICE_TO_CUSTOMER" ? "สัญญารับจ้างซ่อม" : "สัญญาจ้างต่อ"}
              />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block text-slate-600">หมายเหตุ</span>
              <textarea name="notes" className={inp} rows={2} />
            </label>
          </div>
          <input type="hidden" name="vatRate" value="7" />
          <input type="hidden" name="status" value="ACTIVE" />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              บันทึก
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="rounded-md border px-4 py-2 text-sm">
              ยกเลิก
            </button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="border-b bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-3 py-2">เลขที่</th>
              <th className="px-3 py-2">ประเภท</th>
              <th className="px-3 py-2">คู่สัญญา</th>
              <th className="px-3 py-2">รถ / อาการ</th>
              <th className="px-3 py-2 text-right">ราคา (ex VAT)</th>
              <th className="px-3 py-2">พิมพ์</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {contracts.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-slate-500">
                  ยังไม่มีงานซ่อม
                </td>
              </tr>
            )}
            {contracts.map((c) => {
              const party = entities.find((e) => e.id === c.counterpartyEntityId);
              return (
                <tr key={c.id} className="border-b border-slate-100">
                  <td className="px-3 py-2 font-mono text-xs">{c.code}</td>
                  <td className="px-3 py-2 text-xs">
                    {c.kind === "SERVICE_TO_CUSTOMER" ? "รับจ้างซ่อม" : "จ้างต่อ"}
                  </td>
                  <td className="px-3 py-2">{party?.name || "—"}</td>
                  <td className="px-3 py-2">
                    <p className="font-medium">{c.customerVehicleLabel || "—"}</p>
                    <p className="line-clamp-1 text-xs text-slate-500">{c.symptoms}</p>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatBaht(parseAmount(c.agreedPriceExVat))}
                  </td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/documents/legal/repair?contractId=${c.id}`}
                      className="text-blue-800 hover:underline"
                      target="_blank"
                    >
                      {c.kind === "SERVICE_TO_CUSTOMER" ? "สัญญารับจ้างซ่อม" : "สัญญาจ้างต่อ"}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      className="text-red-600 hover:underline"
                      onClick={() => {
                        if (!confirm("ลบ?")) return;
                        startTransition(async () => {
                          await deleteRepairContractAction(c.id);
                          router.refresh();
                        });
                      }}
                    >
                      ลบ
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-500">
        สัญญาจ้างซ่อมแบบโครงการขนาดใหญ่ (Hiring / Subcontract) ยังอยู่ที่{" "}
        <Link href="/contracts/hiring-contracts" className="text-blue-800 hover:underline">
          เอกสารสัญญา
        </Link>
      </p>
    </div>
  );
}
