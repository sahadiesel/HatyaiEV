"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { BrandModelSelect } from "@/components/vehicles/BrandModelSelect";
import { saveVehicleAction } from "../actions";
import type { EntityRecord, VehiclePurchaseType } from "@/lib/domain-types";
import { PURCHASE_TYPE_LABELS } from "@/lib/vehicles/calc";

const inp =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

export function NewVehicleForm({ entities }: { entities: EntityRecord[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [purchaseType, setPurchaseType] = useState<VehiclePurchaseType>("INDIVIDUAL_NO_VAT");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!brand.trim() || !model.trim()) {
      setMsg("เลือกหรือกรอกยี่ห้อและรุ่น");
      return;
    }
    const fd = new FormData(e.currentTarget);
    fd.set("brand", brand.trim());
    fd.set("model", model.trim());
    startTransition(async () => {
      const res = await saveVehicleAction(fd);
      if (!res.ok) {
        setMsg(res.message);
        return;
      }
      if ("id" in res && res.id) router.push(`/vehicles/${res.id}`);
      else router.push("/vehicles");
    });
  }

  const sellers = entities.filter(
    (e) => e.roles.includes("SELLER") || e.roles.includes("SUPPLIER") || e.roles.length > 0,
  );

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-3xl space-y-5 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">รับรถเข้าสต็อก</h1>
        <Link href="/vehicles" className="text-sm text-blue-800 hover:underline">
          ← กลับ
        </Link>
      </div>

      {msg && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{msg}</p>}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <BrandModelSelect
            brand={brand}
            model={model}
            onBrandChange={setBrand}
            onModelChange={setModel}
          />
        </div>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">ทะเบียน</span>
          <input name="licensePlate" className={inp} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">ปี</span>
          <input name="year" className={inp} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">สี</span>
          <input name="color" className={inp} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">เลขไมล์</span>
          <input name="mileage" className={inp} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">VIN / เลขตัวถัง</span>
          <input name="vin" className={inp} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">เลขเครื่อง</span>
          <input name="engineNo" className={inp} />
        </label>
      </div>

      <fieldset className="space-y-3 rounded-md border border-slate-200 p-4">
        <legend className="px-1 text-sm font-semibold text-slate-800">ข้อมูลการซื้อเข้า</legend>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">ประเภทการซื้อ *</span>
          <select
            name="purchaseType"
            className={inp}
            value={purchaseType}
            onChange={(e) => setPurchaseType(e.target.value as VehiclePurchaseType)}
          >
            {(Object.keys(PURCHASE_TYPE_LABELS) as VehiclePurchaseType[]).map((k) => (
              <option key={k} value={k}>
                {PURCHASE_TYPE_LABELS[k]}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-500">
            {purchaseType === "INDIVIDUAL_NO_VAT"
              ? "ตอนขายจะใช้ Margin Scheme (ป.111) คิด VAT จากกำไรขั้นต้น"
              : "ตอนขายจะคิด VAT จากยอดขายเต็มจำนวน"}
          </p>
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">ผู้ขาย (Entity)</span>
            <select name="sellerEntityId" className={inp} defaultValue="">
              <option value="">— เลือก —</option>
              {sellers.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} ({e.entityKind === "COMPANY" ? "บริษัท" : "บุคคล"})
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">วันที่ซื้อ</span>
            <input
              name="purchaseDate"
              type="date"
              className={inp}
              defaultValue={new Date().toISOString().slice(0, 10)}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">ราคาซื้อ (บาท) *</span>
            <input name="purchasePrice" className={inp} required defaultValue="0" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">ราคาตั้งขาย</span>
            <input name="expectedSalePrice" className={inp} defaultValue="0" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">หักค่าคอมมิชชั่น</span>
            <input name="commissionAmount" className={inp} defaultValue="0" />
          </label>
        </div>
      </fieldset>

      <label className="block text-sm">
        <span className="mb-1 block text-slate-600">หมายเหตุ</span>
        <textarea name="notes" className={inp} rows={2} />
      </label>

      <input type="hidden" name="status" value="IN_STOCK" />

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
      >
        {pending ? "กำลังบันทึก…" : "บันทึกและลงสมุดเงินสด (จ่ายซื้อรถ)"}
      </button>
    </form>
  );
}
