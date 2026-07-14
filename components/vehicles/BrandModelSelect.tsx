"use client";

import { useEffect, useMemo, useState } from "react";
import {
  listVehicleBrandsClient,
  type VehicleBrandRecord,
} from "@/lib/vehicle-brands-client";

const inp =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

type Props = {
  brand: string;
  model: string;
  onBrandChange: (brand: string) => void;
  onModelChange: (model: string) => void;
  brandName?: string;
  modelName?: string;
  required?: boolean;
  allowCustom?: boolean;
};

export function BrandModelSelect({
  brand,
  model,
  onBrandChange,
  onModelChange,
  brandName = "brand",
  modelName = "model",
  required = true,
  allowCustom = true,
}: Props) {
  const [catalog, setCatalog] = useState<VehicleBrandRecord[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [customBrand, setCustomBrand] = useState(false);
  const [customModel, setCustomModel] = useState(false);

  useEffect(() => {
    void listVehicleBrandsClient().then((rows) => {
      setCatalog(rows);
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!loaded) return;
    if (brand && !catalog.some((b) => b.name === brand)) setCustomBrand(true);
    const row = catalog.find((b) => b.name === brand);
    if (model && row && !row.models.includes(model)) setCustomModel(true);
    if (model && brand && !row) setCustomModel(true);
  }, [loaded, catalog, brand, model]);

  const modelOptions = useMemo(() => {
    const row = catalog.find((b) => b.name === brand);
    return row?.models ?? [];
  }, [catalog, brand]);

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="text-sm">
        <span className="mb-1 block text-slate-600">ยี่ห้อ {required ? "*" : ""}</span>
        <select
          className={inp}
          value={customBrand ? "__custom__" : brand}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "__custom__") {
              setCustomBrand(true);
              setCustomModel(true);
              onBrandChange("");
              onModelChange("");
              return;
            }
            setCustomBrand(false);
            setCustomModel(false);
            onBrandChange(v);
            onModelChange("");
          }}
          required={required && !customBrand}
        >
          <option value="">{loaded ? "— เลือกยี่ห้อ —" : "กำลังโหลด…"}</option>
          {catalog.map((b) => (
            <option key={b.id} value={b.name}>
              {b.name}
            </option>
          ))}
          {allowCustom && <option value="__custom__">อื่นๆ (พิมพ์เอง)</option>}
        </select>
        {customBrand && (
          <input
            className={`${inp} mt-2`}
            name={brandName}
            value={brand}
            onChange={(e) => {
              onBrandChange(e.target.value);
              onModelChange("");
            }}
            placeholder="พิมพ์ยี่ห้อ"
            required={required}
          />
        )}
        {!customBrand && <input type="hidden" name={brandName} value={brand} />}
        {catalog.length === 0 && loaded && (
          <span className="mt-1 block text-xs text-amber-700">
            ยังไม่มียี่ห้อ — เพิ่มที่เมนูตั้งค่ารถยนต์
          </span>
        )}
      </label>

      <label className="text-sm">
        <span className="mb-1 block text-slate-600">รุ่น {required ? "*" : ""}</span>
        <select
          className={inp}
          value={customModel ? "__custom__" : model}
          disabled={!brand && !customBrand}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "__custom__") {
              setCustomModel(true);
              onModelChange("");
              return;
            }
            setCustomModel(false);
            onModelChange(v);
          }}
          required={required && !customModel && modelOptions.length > 0}
        >
          <option value="">{brand || customBrand ? "— เลือกรุ่น —" : "เลือกยี่ห้อก่อน"}</option>
          {modelOptions.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
          {allowCustom && (brand || customBrand) && (
            <option value="__custom__">อื่นๆ (พิมพ์เอง)</option>
          )}
        </select>
        {customModel && (
          <input
            className={`${inp} mt-2`}
            name={modelName}
            value={model}
            onChange={(e) => onModelChange(e.target.value)}
            placeholder="พิมพ์รุ่น"
            required={required}
          />
        )}
        {!customModel && <input type="hidden" name={modelName} value={model} />}
      </label>
    </div>
  );
}
