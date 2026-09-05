"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useAuth } from "@/components/AuthProvider";
import type { VehicleRecord } from "@/lib/domain-types";
import { deleteVehicleClient, listVehiclesClient } from "@/lib/vehicles-client";
import { reconcileAllVehiclePurchaseAmountsClient } from "@/lib/vehicles/purchase-amount-sync";
import {
  COST_CATEGORY_LABELS,
  formatBaht,
  PURCHASE_TYPE_LABELS,
  calcPurchasePaymentSummary,
  compareVehiclesByBrandModelPlate,
  summarizeVehicleEconomics,
  VEHICLE_STATUS_LABELS,
} from "@/lib/vehicles/calc";
import { printVehicleList } from "@/lib/vehicles/print-list";

export function VehiclesBoard({ vehicles }: { vehicles: VehicleRecord[] }) {
  const { isAdmin } = useAuth();
  const [pending, startTransition] = useTransition();
  const [view, setView] = useState<"cards" | "table">("cards");
  const [statusFilter, setStatusFilter] = useState<string>("ACTIVE");
  const [rowsAll, setRowsAll] = useState<VehicleRecord[]>(vehicles);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  function reload() {
    setLoading(true);
    void listVehiclesClient()
      .then((rows) => reconcileAllVehiclePurchaseAmountsClient(rows.length > 0 ? rows : vehicles))
      .then((rows) => {
        setRowsAll(rows);
        setLoading(false);
      });
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void listVehiclesClient()
      .then((rows) => reconcileAllVehiclePurchaseAmountsClient(rows.length > 0 ? rows : vehicles))
      .then((rows) => {
        if (cancelled) return;
        setRowsAll(rows);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [vehicles]);

  const rows = useMemo(() => {
    return rowsAll
      .filter((v) => {
        if (statusFilter === "ALL") return true;
        if (statusFilter === "ACTIVE") return v.status === "IN_STOCK" || v.status === "RESERVED";
        return v.status === statusFilter;
      })
      .slice()
      .sort(compareVehiclesByBrandModelPlate);
  }, [rowsAll, statusFilter]);

  function onDelete(v: VehicleRecord) {
    const label = `${v.brand} ${v.model} (${v.licensePlate || v.code || v.id})`;
    if (
      !confirm(
        `ลบรถ ${label} ออกจากสต็อก?\nรายการสมุดเงินสดที่ผูกกับรถคันนี้จะถูกลบด้วย\nการกระทำนี้ย้อนกลับไม่ได้`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      const res = await deleteVehicleClient(v.id);
      if (!res.ok) {
        setMsg(res.message);
        return;
      }
      setMsg(
        res.deletedCashbook > 0
          ? `ลบรถแล้ว และลบรายการเงินสดที่เกี่ยวข้อง ${res.deletedCashbook} รายการ`
          : "ลบรถออกจากสต็อกแล้ว",
      );
      reload();
    });
  }

  function onPrintList() {
    void printVehicleList({ vehicles: rows, statusFilter }).catch((e) => {
      setMsg(e instanceof Error ? e.message : "พิมพ์รายการไม่สำเร็จ");
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">รถยนต์และต้นทุน</h1>
          <p className="mt-1 text-sm text-slate-600">
            ดูต้นทุนรวมแบบ Real-time ต่อคัน — เพิ่มต้นทุนสะสม ตั้งราคาขาย และหักค่าคอม
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onPrintList}
            disabled={rows.length === 0}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50"
          >
            พิมพ์รายการ
          </button>
          <Link
            href="/vehicles/new"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            + รับรถเข้าสต็อก
          </Link>
        </div>
      </div>

      {msg && (
        <p className="rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-800">{msg}</p>
      )}

      {loading && rowsAll.length === 0 ? (
        <p className="text-sm text-slate-500">กำลังโหลดรายการรถ…</p>
      ) : null}

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
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {rows.map((v) => {
            const eco = summarizeVehicleEconomics(v);
            const pay = calcPurchasePaymentSummary(v);
            return (
              <div
                key={v.id}
                className="relative rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-400"
              >
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/vehicles/${v.id}`} className="min-w-0 flex-1 hover:opacity-90">
                    <p className="font-mono text-xs text-slate-500">{v.code}</p>
                    <h3 className="text-lg font-semibold text-slate-900">
                      {v.brand} {v.model}
                    </h3>
                    <p className="text-sm text-slate-600">
                      {v.licensePlate || "—"} · {v.year || "—"} · {v.color || "—"}
                    </p>
                  </Link>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                      {VEHICLE_STATUS_LABELS[v.status] ?? v.status}
                    </span>
                    {isAdmin && (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => onDelete(v)}
                        className="rounded border border-red-200 px-2 py-0.5 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        ลบ
                      </button>
                    )}
                  </div>
                </div>

                <Link href={`/vehicles/${v.id}`} className="mt-4 block">
                  <div className="rounded-md bg-slate-50 p-3">
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
                      <p className="text-xs text-slate-500">ราคาตั้งขาย (รวม VAT)</p>
                      <p className="font-medium tabular-nums">฿{formatBaht(eco.expectedSale)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">กำไรประมาณ</p>
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
                    <div>
                      <p className="text-xs text-slate-500">ราคาก่อนภาษี</p>
                      <p className="font-medium tabular-nums">฿{formatBaht(eco.priceBeforeVat)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">ภาษี 7%</p>
                      <p className="font-medium tabular-nums">฿{formatBaht(eco.vatAmount)}</p>
                    </div>
                  </div>

                  <p className="mt-3 text-xs text-slate-500">
                    {PURCHASE_TYPE_LABELS[v.purchaseType]}
                    {" · "}กำไร = ราคาก่อนภาษี − ต้นทุนไม่รวมภาษี
                  </p>
                  <p
                    className={
                      pay.remaining > 0
                        ? "mt-2 text-xs font-medium text-amber-800"
                        : "mt-2 text-xs text-emerald-700"
                    }
                  >
                    จ่ายค่าซื้อ ฿{formatBaht(pay.paid)} / ฿{formatBaht(pay.obligation)}
                    {pay.remaining > 0 ? ` · คงค้าง ฿${formatBaht(pay.remaining)}` : " · ครบแล้ว"}
                  </p>
                </Link>
              </div>
            );
          })}
        </div>
      )}

      {view === "table" && (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="min-w-[1100px] w-full text-sm">
            <thead className="border-b bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-3 py-2">ประเภทซื้อ</th>
                <th className="px-3 py-2">รถ</th>
                <th className="px-3 py-2 text-right">ต้นทุนรถ</th>
                <th className="px-3 py-2 text-right">ต้นทุนซ่อม</th>
                <th className="px-3 py-2 text-right">ต้นทุนรวม</th>
                <th className="px-3 py-2 text-right">ตั้งขาย</th>
                <th className="px-3 py-2 text-right">ราคาก่อนภาษี</th>
                <th className="px-3 py-2 text-right">ภาษี 7%</th>
                <th className="px-3 py-2 text-right">กำไรประมาณ</th>
                <th className="px-3 py-2">สถานะ</th>
                {isAdmin && <th className="px-3 py-2" />}
              </tr>
            </thead>
            <tbody>
              {rows.map((v) => {
                const eco = summarizeVehicleEconomics(v);
                const purchaseCost = Number(v.purchasePrice) || 0;
                const repairCost = eco.totalCost - purchaseCost;
                return (
                  <tr key={v.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-2 text-xs whitespace-nowrap">
                      {v.purchaseType === "INDIVIDUAL_NO_VAT" ? "ซื้อบุคคล" : "ซื้อบริษัท VAT"}
                    </td>
                    <td className="px-3 py-2">
                      <Link href={`/vehicles/${v.id}`} className="font-medium text-blue-800 hover:underline">
                        {v.brand} {v.model} · {v.licensePlate || "—"}
                      </Link>
                      <p className="font-mono text-xs text-slate-500">{v.code}</p>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatBaht(purchaseCost)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatBaht(repairCost)}</td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">
                      {formatBaht(eco.totalCost)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatBaht(eco.expectedSale)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatBaht(eco.priceBeforeVat)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatBaht(eco.vatAmount)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatBaht(eco.grossProfit)}</td>
                    <td className="px-3 py-2">{VEHICLE_STATUS_LABELS[v.status]}</td>
                    {isAdmin && (
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => onDelete(v)}
                          className="text-red-600 hover:underline disabled:opacity-50"
                        >
                          ลบ
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-slate-400">
        หมวดต้นทุน: {Object.values(COST_CATEGORY_LABELS).join(" · ")}
        {isAdmin ? " · ผู้ดูแลระบบสามารถลบรถทดสอบได้" : ""}
      </p>
    </div>
  );
}
