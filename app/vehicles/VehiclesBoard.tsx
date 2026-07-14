"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { VehicleRecord } from "@/lib/domain-types";
import {
  COST_CATEGORY_LABELS,
  formatBaht,
  PURCHASE_TYPE_LABELS,
  summarizeVehicleEconomics,
  VEHICLE_STATUS_LABELS,
} from "@/lib/vehicles/calc";

export function VehiclesBoard({ vehicles }: { vehicles: VehicleRecord[] }) {
  const [view, setView] = useState<"cards" | "table">("cards");
  const [statusFilter, setStatusFilter] = useState<string>("ACTIVE");

  const rows = useMemo(() => {
    return vehicles.filter((v) => {
      if (statusFilter === "ALL") return true;
      if (statusFilter === "ACTIVE") return v.status === "IN_STOCK" || v.status === "RESERVED";
      return v.status === statusFilter;
    });
  }, [vehicles, statusFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">รถยนต์และต้นทุน</h1>
          <p className="mt-1 text-sm text-slate-600">
            ดูต้นทุนรวมแบบ Real-time ต่อคัน — เพิ่มต้นทุนสะสม ตั้งราคาขาย และหักค่าคอม
          </p>
        </div>
        <Link
          href="/vehicles/new"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          + รับรถเข้าสต็อก
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["ACTIVE", "ในสต็อก/จอง"],
            ["IN_STOCK", "ในสต็อก"],
            ["SOLD", "ขายแล้ว"],
            ["ALL", "ทั้งหมด"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setStatusFilter(k)}
            className={
              statusFilter === k
                ? "rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white"
                : "rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
            }
          >
            {label}
          </button>
        ))}
        <div className="ml-auto flex gap-1 rounded-md border border-slate-200 p-0.5">
          <button
            type="button"
            onClick={() => setView("cards")}
            className={view === "cards" ? "rounded bg-slate-900 px-2 py-1 text-xs text-white" : "px-2 py-1 text-xs"}
          >
            การ์ด
          </button>
          <button
            type="button"
            onClick={() => setView("table")}
            className={view === "table" ? "rounded bg-slate-900 px-2 py-1 text-xs text-white" : "px-2 py-1 text-xs"}
          >
            ตาราง
          </button>
        </div>
      </div>

      {rows.length === 0 && (
        <p className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
          ยังไม่มีรถในสต็อก — กดรับรถเข้าสต็อก
        </p>
      )}

      {view === "cards" && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((v) => {
            const eco = summarizeVehicleEconomics(v);
            return (
              <Link
                key={v.id}
                href={`/vehicles/${v.id}`}
                className="block rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-400"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-mono text-xs text-slate-500">{v.code}</p>
                    <h3 className="text-lg font-semibold text-slate-900">
                      {v.brand} {v.model}
                    </h3>
                    <p className="text-sm text-slate-600">
                      {v.licensePlate || "—"} · {v.year || "—"} · {v.color || "—"}
                    </p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                    {VEHICLE_STATUS_LABELS[v.status] ?? v.status}
                  </span>
                </div>

                <div className="mt-4 rounded-md bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">ต้นทุนรวมปัจจุบัน</p>
                  <p className="text-2xl font-bold tabular-nums text-slate-900">
                    ฿{formatBaht(eco.totalCost)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    ซื้อ {formatBaht(Number(v.purchasePrice) || 0)} + สะสม{" "}
                    {formatBaht(eco.totalCost - (Number(v.purchasePrice) || 0))} (
                    {v.costLines.length} รายการ)
                  </p>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-xs text-slate-500">ราคาตั้งขาย</p>
                    <p className="font-medium tabular-nums">฿{formatBaht(eco.expectedSale)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">กำไรขั้นต้นประมาณ</p>
                    <p
                      className={
                        eco.grossProfit >= 0
                          ? "font-medium tabular-nums text-emerald-700"
                          : "font-medium tabular-nums text-red-600"
                      }
                    >
                      ฿{formatBaht(eco.grossProfit)}
                    </p>
                  </div>
                </div>

                <p className="mt-3 text-xs text-slate-500">
                  {PURCHASE_TYPE_LABELS[v.purchaseType]}
                  {eco.saleVat && (
                    <> · VAT ประมาณ ฿{formatBaht(eco.saleVat.vatAmount)} ({eco.saleVat.scheme})</>
                  )}
                </p>
              </Link>
            );
          })}
        </div>
      )}

      {view === "table" && (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="min-w-[900px] w-full text-sm">
            <thead className="border-b bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-3 py-2">รถ</th>
                <th className="px-3 py-2">ประเภทซื้อ</th>
                <th className="px-3 py-2 text-right">ต้นทุนรวม</th>
                <th className="px-3 py-2 text-right">ตั้งขาย</th>
                <th className="px-3 py-2 text-right">คอม</th>
                <th className="px-3 py-2 text-right">กำไรประมาณ</th>
                <th className="px-3 py-2">สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((v) => {
                const eco = summarizeVehicleEconomics(v);
                return (
                  <tr key={v.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-2">
                      <Link href={`/vehicles/${v.id}`} className="font-medium text-blue-800 hover:underline">
                        {v.brand} {v.model} · {v.licensePlate || "—"}
                      </Link>
                      <p className="font-mono text-xs text-slate-500">{v.code}</p>
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {v.purchaseType === "INDIVIDUAL_NO_VAT" ? "บุคคล / Margin" : "บริษัท VAT 7%"}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">
                      {formatBaht(eco.totalCost)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatBaht(eco.expectedSale)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatBaht(eco.commission)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatBaht(eco.grossProfit)}</td>
                    <td className="px-3 py-2">{VEHICLE_STATUS_LABELS[v.status]}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-slate-400">
        หมวดต้นทุน: {Object.values(COST_CATEGORY_LABELS).join(" · ")}
      </p>
    </div>
  );
}
