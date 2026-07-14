"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  addCostLineAction,
  removeCostLineAction,
  saveVehicleAction,
  updateSalePricingAction,
} from "../actions";
import type { EntityRecord, VehicleCostCategory, VehicleRecord } from "@/lib/domain-types";
import {
  COST_CATEGORY_LABELS,
  formatBaht,
  PURCHASE_TYPE_LABELS,
  summarizeVehicleEconomics,
  VEHICLE_STATUS_LABELS,
} from "@/lib/vehicles/calc";

const inp =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

export function VehicleDetailClient({
  vehicle,
  entities,
}: {
  vehicle: VehicleRecord;
  entities: EntityRecord[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [expectedSalePrice, setExpectedSalePrice] = useState(vehicle.expectedSalePrice);
  const [commissionAmount, setCommissionAmount] = useState(vehicle.commissionAmount);

  const eco = useMemo(
    () =>
      summarizeVehicleEconomics({
        ...vehicle,
        expectedSalePrice,
        commissionAmount,
      }),
    [vehicle, expectedSalePrice, commissionAmount],
  );

  const seller = entities.find((e) => e.id === vehicle.sellerEntityId);
  const buyer = entities.find((e) => e.id === vehicle.buyerEntityId);

  function savePricing() {
    const fd = new FormData();
    fd.set("id", vehicle.id);
    fd.set("expectedSalePrice", expectedSalePrice);
    fd.set("commissionAmount", commissionAmount);
    startTransition(async () => {
      const res = await updateSalePricingAction(fd);
      setMsg(res.ok ? "อัปเดตราคาตั้งขายแล้ว" : res.message);
      router.refresh();
    });
  }

  function addCost(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("vehicleId", vehicle.id);
    startTransition(async () => {
      const res = await addCostLineAction(fd);
      if (!res.ok) {
        setMsg(res.message);
        return;
      }
      setMsg("เพิ่มต้นทุนสะสมแล้ว");
      e.currentTarget.reset();
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/vehicles" className="text-sm text-blue-800 hover:underline">
            ← รถยนต์และต้นทุน
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">
            {vehicle.brand} {vehicle.model}
          </h1>
          <p className="text-sm text-slate-600">
            {vehicle.code} · {vehicle.licensePlate || "ไม่มีทะเบียน"} · VIN {vehicle.vin || "—"}
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700">
          {VEHICLE_STATUS_LABELS[vehicle.status]}
        </span>
      </div>

      {msg && <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{msg}</p>}

      {/* Total cost hero */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:col-span-1">
          <p className="text-sm text-slate-500">ต้นทุนรวมปัจจุบัน (Real-time)</p>
          <p className="mt-1 text-3xl font-bold tabular-nums text-slate-900">
            ฿{formatBaht(eco.totalCost)}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            ซื้อเข้า ฿{formatBaht(Number(vehicle.purchasePrice) || 0)} + สะสม ฿
            {formatBaht(eco.totalCost - (Number(vehicle.purchasePrice) || 0))}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:col-span-2">
          <p className="mb-3 text-sm font-semibold text-slate-800">ราคาตั้งขาย / ค่าคอม / กำไรขั้นต้น</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">ราคาตั้งขาย</span>
              <input
                className={inp}
                value={expectedSalePrice}
                onChange={(e) => setExpectedSalePrice(e.target.value)}
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">หักค่าคอมมิชชั่น</span>
              <input
                className={inp}
                value={commissionAmount}
                onChange={(e) => setCommissionAmount(e.target.value)}
              />
            </label>
            <div>
              <p className="mb-1 text-sm text-slate-600">กำไรขั้นต้นประมาณ</p>
              <p
                className={
                  eco.grossProfit >= 0
                    ? "text-2xl font-bold tabular-nums text-emerald-700"
                    : "text-2xl font-bold tabular-nums text-red-600"
                }
              >
                ฿{formatBaht(eco.grossProfit)}
              </p>
            </div>
          </div>
          {eco.saleVat && (
            <p className="mt-3 text-xs text-slate-500">
              VAT เมื่อขาย ({eco.saleVat.scheme === "MARGIN" ? "Margin Scheme ป.111" : "ยอดขายเต็ม"}): ฿
              {formatBaht(eco.saleVat.vatAmount)} · ฐานภาษี ฿{formatBaht(eco.saleVat.taxableBase)}
            </p>
          )}
          <button
            type="button"
            onClick={savePricing}
            disabled={pending}
            className="mt-3 rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-50"
          >
            บันทึกราคาตั้งขาย
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Add cost */}
        <form onSubmit={addCost} className="space-y-3 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-slate-900">เพิ่มต้นทุนสะสม</h2>
          <p className="text-xs text-slate-500">อะไหล่ / ค่าแรงซ่อมหน้างาน — ลงในรถคันนี้ทันที</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">วันที่</span>
              <input
                name="date"
                type="date"
                className={inp}
                defaultValue={new Date().toISOString().slice(0, 10)}
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">หมวด</span>
              <select name="category" className={inp} defaultValue="PARTS">
                {(Object.keys(COST_CATEGORY_LABELS) as VehicleCostCategory[]).map((k) => (
                  <option key={k} value={k}>
                    {COST_CATEGORY_LABELS[k]}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block text-slate-600">รายละเอียด</span>
              <input name="description" className={inp} placeholder="เช่น แบตเตอรี่, ค่าแรงเปลี่ยนยาง" required />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">จำนวนเงิน</span>
              <input name="amount" className={inp} required defaultValue="0" />
            </label>
            <label className="flex items-end gap-2 pb-2 text-sm text-slate-700">
              <input type="checkbox" name="postCash" value="1" defaultChecked />
              ลงสมุดเงินสดด้วย (จ่ายออก)
            </label>
          </div>
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
          >
            + เพิ่มต้นทุนสะสม
          </button>
        </form>

        {/* Info */}
        <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-slate-900">ข้อมูลรถ / การซื้อ</h2>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
            <dt className="text-slate-500">ประเภทซื้อ</dt>
            <dd>{PURCHASE_TYPE_LABELS[vehicle.purchaseType]}</dd>
            <dt className="text-slate-500">ผู้ขาย</dt>
            <dd>{seller?.name || "—"}</dd>
            <dt className="text-slate-500">วันที่ซื้อ</dt>
            <dd>{vehicle.purchaseDate || "—"}</dd>
            <dt className="text-slate-500">ผู้ซื้อ (ถ้าขายแล้ว)</dt>
            <dd>{buyer?.name || "—"}</dd>
            <dt className="text-slate-500">สี / ปี / ไมล์</dt>
            <dd>
              {vehicle.color || "—"} / {vehicle.year || "—"} / {vehicle.mileage || "—"}
            </dd>
          </dl>
          <div className="flex flex-wrap gap-2 pt-2">
            <Link
              href={`/documents/legal/purchase?vehicleId=${vehicle.id}`}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
            >
              สัญญาซื้อ
            </Link>
            <Link
              href={`/documents/legal/sale?vehicleId=${vehicle.id}`}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
            >
              สัญญาขาย
            </Link>
            <Link
              href={`/documents/legal/receiving?vehicleId=${vehicle.id}`}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
            >
              ใบรับรถ
            </Link>
            <Link
              href={`/documents/tax-invoice/new?vehicleId=${vehicle.id}`}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
            >
              ใบกำกับภาษี (Margin)
            </Link>
          </div>
        </div>
      </div>

      {/* Cost lines */}
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="border-b bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-3 py-2">วันที่</th>
              <th className="px-3 py-2">หมวด</th>
              <th className="px-3 py-2">รายละเอียด</th>
              <th className="px-3 py-2 text-right">จำนวน</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {vehicle.costLines.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                  ยังไม่มีต้นทุนสะสม
                </td>
              </tr>
            )}
            {vehicle.costLines.map((l) => (
              <tr key={l.id} className="border-b border-slate-100">
                <td className="px-3 py-2">{l.date}</td>
                <td className="px-3 py-2">{COST_CATEGORY_LABELS[l.category] ?? l.category}</td>
                <td className="px-3 py-2">{l.description}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatBaht(Number(l.amount) || 0)}</td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    className="text-red-600 hover:underline"
                    onClick={() => {
                      startTransition(async () => {
                        await removeCostLineAction(vehicle.id, l.id);
                        router.refresh();
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

      {/* Quick status / notes update */}
      <form
        className="space-y-3 rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          fd.set("id", vehicle.id);
          fd.set("expectedSalePrice", expectedSalePrice);
          fd.set("commissionAmount", commissionAmount);
          startTransition(async () => {
            const res = await saveVehicleAction(fd);
            setMsg(res.ok ? "บันทึกข้อมูลรถแล้ว" : res.message);
            router.refresh();
          });
        }}
      >
        <h2 className="font-semibold text-slate-900">อัปเดตสถานะ / หมายเหตุ</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">สถานะ</span>
            <select name="status" className={inp} defaultValue={vehicle.status}>
              {Object.entries(VEHICLE_STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="mb-1 block text-slate-600">หมายเหตุ</span>
            <input name="notes" className={inp} defaultValue={vehicle.notes} />
          </label>
        </div>
        <input type="hidden" name="brand" value={vehicle.brand} />
        <input type="hidden" name="model" value={vehicle.model} />
        <input type="hidden" name="licensePlate" value={vehicle.licensePlate} />
        <input type="hidden" name="year" value={vehicle.year} />
        <input type="hidden" name="color" value={vehicle.color} />
        <input type="hidden" name="vin" value={vehicle.vin} />
        <input type="hidden" name="engineNo" value={vehicle.engineNo} />
        <input type="hidden" name="mileage" value={vehicle.mileage} />
        <input type="hidden" name="purchaseType" value={vehicle.purchaseType} />
        <input type="hidden" name="sellerEntityId" value={vehicle.sellerEntityId ?? ""} />
        <input type="hidden" name="purchaseDate" value={vehicle.purchaseDate} />
        <input type="hidden" name="purchasePrice" value={vehicle.purchasePrice} />
        <input type="hidden" name="soldDate" value={vehicle.soldDate} />
        <input type="hidden" name="soldPrice" value={vehicle.soldPrice} />
        <input type="hidden" name="buyerEntityId" value={vehicle.buyerEntityId ?? ""} />
        <button
          type="submit"
          disabled={pending}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
        >
          บันทึกสถานะ
        </button>
      </form>
    </div>
  );
}
