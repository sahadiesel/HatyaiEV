"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ContractDocStatus, VehicleEngineType } from "@prisma/client";
import { ContractEditStickyBar } from "@/components/ContractEditStickyBar";
import { VehiclePhotoUpload } from "@/components/VehiclePhotoUpload";
import type { ContractPhoto } from "@/lib/vehicle-inspection-items";
import { stripVehiclesForSave } from "@/lib/vehicle-inspection-items";
import { updateHiringContract } from "../actions";

export type InstallmentRow = { sequence: number; label: string; amount: string; percent: string };
export type VehicleRow = {
  lineIndex: number;
  licensePlate: string;
  brand: string;
  model: string;
  year: string;
  color: string;
  engineType: VehicleEngineType;
  engineSize: string;
  extraNotes: string;
  contractPhotos: ContractPhoto[];
};

type ClientOpt = { id: string; name: string };

const HIRING_CONTRACT_FORM_ID = "hiring-contract-form";

export function HiringContractEditor({
  contractId,
  contractCode,
  clients,
  initialClientId,
  initialTitle,
  initialVehicleCount,
  initialPriceExVat,
  initialVatRate,
  initialNotes,
  initialStatus,
  initialVehicles,
  initialInstallments,
}: {
  contractId: string;
  contractCode: string;
  clients: ClientOpt[];
  initialClientId: string;
  initialTitle: string;
  initialVehicleCount: number;
  initialPriceExVat: string;
  initialVatRate: string;
  initialNotes: string;
  initialStatus: ContractDocStatus;
  initialVehicles: VehicleRow[];
  initialInstallments: InstallmentRow[];
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const [clientId, setClientId] = useState(initialClientId);
  const [title, setTitle] = useState(initialTitle);
  const [vehicleCount, setVehicleCount] = useState(Math.max(0, initialVehicleCount));
  const [pricePerVehicleExVat, setPricePerVehicleExVat] = useState(initialPriceExVat);
  const [vatRate, setVatRate] = useState(initialVatRate);
  const [notes, setNotes] = useState(initialNotes);
  const [status, setStatus] = useState<ContractDocStatus>(initialStatus);

  const [vehicles, setVehicles] = useState<VehicleRow[]>(() => mergeVehicleRows(initialVehicleCount, initialVehicles));
  const [installments, setInstallments] = useState<InstallmentRow[]>(() => initialInstallments);
  const [vehicleSearch, setVehicleSearch] = useState("");

  const filteredVehicles = useMemo(() => {
    const q = vehicleSearch.trim().toLowerCase();
    if (!q) return vehicles;
    return vehicles.filter((v) => vehicleMatchesSearch(v, q));
  }, [vehicles, vehicleSearch]);

  const totalExVat = useMemo(() => {
    const p = parseFloat(pricePerVehicleExVat.replace(/,/g, "")) || 0;
    return p * vehicleCount;
  }, [pricePerVehicleExVat, vehicleCount]);

  const vatAmountTotal = useMemo(() => {
    const v = parseFloat(vatRate.replace(/,/g, "")) || 0;
    return (totalExVat * v) / 100;
  }, [totalExVat, vatRate]);

  function syncVehicleCount(n: number) {
    const next = Math.max(0, Math.min(500, n));
    setVehicleCount(next);
    setVehicles((prev) => mergeVehicleRows(next, prev));
  }

  function updateVehicle(i: number, patch: Partial<VehicleRow>) {
    setVehicles((rows) =>
      rows.map((r) => (r.lineIndex === i ? normalizeVehicleRow({ ...r, ...patch, lineIndex: i }) : r)),
    );
  }

  function updateInst(idx: number, patch: Partial<InstallmentRow>) {
    setInstallments((rows) => rows.map((r, j) => (j === idx ? { ...r, ...patch } : r)));
  }

  function addInstallment() {
    setInstallments((rows) => [
      ...rows,
      { sequence: rows.length + 1, label: `งวด ${rows.length + 1}`, amount: "0", percent: "" },
    ]);
  }

  function removeInstallment(idx: number) {
    setInstallments((rows) => rows.filter((_, j) => j !== idx).map((r, j) => ({ ...r, sequence: j + 1 })));
  }

  function applyPercentToAmounts() {
    const t = totalExVat;
    setInstallments((rows) =>
      rows.map((r) => {
        const pct = parseFloat(String(r.percent).replace(/,/g, "")) || 0;
        const amt = (t * pct) / 100;
        return { ...r, amount: amt ? amt.toFixed(2) : "0" };
      }),
    );
    setMessage("คำนวณยอดงวดจาก % ของมูลค่ารวมก่อน VAT แล้ว (ตรวจสอบก่อนบันทึก)");
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setMessage(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    fd.set("vehiclesJson", JSON.stringify(stripVehiclesForSave(vehicles)));
    fd.set("installmentsJson", JSON.stringify(installments));
    const res = await updateHiringContract(fd);
    setPending(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setMessage("บันทึกการแก้ไขแล้ว");
    router.refresh();
  }

  return (
    <>
      <ContractEditStickyBar
        backHref="/contracts/hiring-contracts"
        backLabel="สัญญารับจ้าง"
        title={
          <>
            แก้ไขสัญญารับจ้าง <span className="font-semibold text-slate-600">{contractCode}</span>
          </>
        }
        formId={HIRING_CONTRACT_FORM_ID}
        pending={pending}
        message={message}
        error={error}
        toolbar={
          vehicleCount > 0 ? (
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <span className="sr-only">ค้นหารายการรถ</span>
              <input
                type="search"
                value={vehicleSearch}
                onChange={(e) => setVehicleSearch(e.target.value)}
                placeholder="ค้นหา ทะเบียน / ยี่ห้อ / รุ่น"
                className="w-52 min-w-[12rem] rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:w-64"
              />
            </label>
          ) : null
        }
      />
      <form id={HIRING_CONTRACT_FORM_ID} onSubmit={onSubmit} className="space-y-8">
        <input type="hidden" name="id" value={contractId} />

      <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="font-semibold text-slate-900">ข้อมูลสัญญา</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm sm:col-span-2">
            <span className="font-medium text-slate-700">ผู้ว่าจ้าง *</span>
            <select
              name="clientId"
              required
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className={inp}
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="font-medium text-slate-700">ชื่อเรื่องสัญญา</span>
            <input name="title" value={title} onChange={(e) => setTitle(e.target.value)} className={inp} />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-700">สถานะ</span>
            <select
              name="status"
              value={status}
              onChange={(e) => setStatus(e.target.value as ContractDocStatus)}
              className={inp}
            >
              <option value="DRAFT">ร่าง</option>
              <option value="ACTIVE">ใช้งาน</option>
              <option value="COMPLETED">ปิดสัญญา</option>
              <option value="CANCELLED">ยกเลิก</option>
            </select>
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="font-medium text-slate-700">หมายเหตุ</span>
            <textarea name="notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={inp} />
          </label>
        </div>
      </section>

      <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="font-semibold text-slate-900">มูลค่าและภาษี (ต่อคัน)</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block text-sm">
            <span className="font-medium text-slate-700">จำนวนรถในสัญญา (คัน) *</span>
            <input
              type="number"
              name="vehicleCount"
              min={0}
              max={500}
              value={vehicleCount}
              onChange={(e) => syncVehicleCount(parseInt(e.target.value, 10) || 0)}
              className={inp}
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-700">ราคาต่อคัน (ก่อน VAT)</span>
            <input
              name="pricePerVehicleExVat"
              value={pricePerVehicleExVat}
              onChange={(e) => setPricePerVehicleExVat(e.target.value)}
              className={inp}
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-700">VAT %</span>
            <input name="vatRate" value={vatRate} onChange={(e) => setVatRate(e.target.value)} className={inp} />
          </label>
        </div>
        <p className="text-sm text-slate-600">
          มูลค่ารวมก่อน VAT: <strong>{totalExVat.toLocaleString("th-TH", { maximumFractionDigits: 2 })}</strong> บาท ·
          ภาษีมูลค่าเพิ่มโดยประมาณ:{" "}
          <strong>{vatAmountTotal.toLocaleString("th-TH", { maximumFractionDigits: 2 })}</strong> บาท
        </p>
        <p className="text-xs text-slate-500">
          การออกบิลแยกตามคัน (เช่น 5 คัน ออกก่อน 2 คัน) จะผูกกับงวด/เงื่อนไขสัญญานี้ในเวอร์ชันถัดไปของระบบเอกสาร
        </p>
      </section>

      <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-slate-900">งวดเก็บเงิน</h2>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={applyPercentToAmounts} className={btnSecondary}>
              คิดยอดงวดจาก % × มูลค่ารวมก่อน VAT
            </button>
            <button type="button" onClick={addInstallment} className={btnSecondary}>
              + เพิ่มงวด
            </button>
          </div>
        </div>
        {installments.length === 0 ? (
          <p className="text-sm text-slate-500">ยังไม่มีงวด — กด «+ เพิ่มงวด» แล้วกรอกชื่อ จำนวนเงิน หรือ % ได้เอง</p>
        ) : null}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-600">
                <th className="py-2 pr-2">#</th>
                <th className="py-2 pr-2">ชื่องวด</th>
                <th className="py-2 pr-2">จำนวนเงิน (บาท)</th>
                <th className="py-2 pr-2">% ของก่อน VAT (ไม่บังคับ)</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {installments.map((row, idx) => (
                <tr key={idx} className="border-b border-slate-100">
                  <td className="py-2 pr-2">{idx + 1}</td>
                  <td className="py-2 pr-2">
                    <input
                      value={row.label}
                      onChange={(e) => updateInst(idx, { label: e.target.value })}
                      className={inpTight}
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      value={row.amount}
                      onChange={(e) => updateInst(idx, { amount: e.target.value })}
                      className={inpTight}
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      value={row.percent}
                      onChange={(e) => updateInst(idx, { percent: e.target.value })}
                      className={inpTight}
                    />
                  </td>
                  <td className="py-2">
                    <button type="button" onClick={() => removeInstallment(idx)} className="text-red-700 hover:underline">
                      ลบ
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-semibold text-slate-900">รายการรถ ({vehicleCount} คัน)</h2>
          {vehicleCount > 0 && vehicleSearch.trim() && (
            <p className="text-sm text-slate-600">
              แสดง {filteredVehicles.length} จาก {vehicleCount} คัน
            </p>
          )}
        </div>
        {vehicleCount === 0 ? (
          <p className="text-sm text-slate-500">ตั้งจำนวนคันมากกว่า 0 เพื่อแสดงแบบฟอร์มรายคัน</p>
        ) : filteredVehicles.length === 0 ? (
          <p className="text-sm text-slate-500">ไม่พบรถที่ตรงกับคำค้นหา &quot;{vehicleSearch.trim()}&quot;</p>
        ) : (
          <div className="space-y-6">
            {filteredVehicles.map((v) => (
              <div key={v.lineIndex} className="rounded-md border border-slate-100 bg-slate-50/80 p-3">
                <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                  <p className="text-sm font-medium text-slate-800">คันที่ {v.lineIndex}</p>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/contracts/hiring-contracts/${contractId}/vehicles/${v.lineIndex}/progress`}
                      className={btnBlue}
                    >
                      รายละเอียดความคืบหน้างาน
                    </Link>
                    <Link
                      href={`/contracts/hiring-contracts/${contractId}/vehicles/${v.lineIndex}/billing`}
                      className={btnBlue}
                    >
                      รายละเอียดการวางบิลเก็บเงิน
                    </Link>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                  <Field
                    label="ทะเบียนรถ"
                    value={v.licensePlate}
                    onChange={(val) => updateVehicle(v.lineIndex, { licensePlate: val })}
                  />
                  <Field label="ยี่ห้อ" value={v.brand} onChange={(val) => updateVehicle(v.lineIndex, { brand: val })} />
                  <Field label="รุ่น" value={v.model} onChange={(val) => updateVehicle(v.lineIndex, { model: val })} />
                  <Field label="ปี" value={v.year} onChange={(val) => updateVehicle(v.lineIndex, { year: val })} />
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  <Field label="สี" value={v.color} onChange={(val) => updateVehicle(v.lineIndex, { color: val })} />
                  <label className="block text-xs">
                    <span className="text-slate-600">ชนิดเครื่องยนต์</span>
                    <select
                      value={v.engineType}
                      onChange={(e) => updateVehicle(v.lineIndex, { engineType: e.target.value as VehicleEngineType })}
                      className={inp}
                    >
                      <option value="GASOLINE">เบนซิน</option>
                      <option value="DIESEL">ดีเซล</option>
                      <option value="ELECTRIC">ไฟฟ้า</option>
                    </select>
                  </label>
                  <Field
                    label="ขนาดเครื่องยนต์"
                    value={v.engineSize}
                    onChange={(val) => updateVehicle(v.lineIndex, { engineSize: val })}
                  />
                </div>
                <div className="mt-3 space-y-3 rounded-md border border-amber-200/80 bg-amber-50/40 p-3">
                  <label className="block text-xs">
                    <span className="font-medium text-slate-700">รายละเอียดเพิ่มเติม</span>
                    <textarea
                      rows={2}
                      value={v.extraNotes ?? ""}
                      onChange={(e) => updateVehicle(v.lineIndex, { extraNotes: e.target.value })}
                      className={inp}
                    />
                  </label>
                  <VehiclePhotoUpload
                    contractId={contractId}
                    lineIndex={v.lineIndex}
                    photos={v.contractPhotos}
                    onChange={(contractPhotos) => updateVehicle(v.lineIndex, { contractPhotos })}
                  />
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  บันทึกสัญญาก่อนเปิดความคืบหน้า/วางบิล — ปุ่มน้ำเงินจะโหลดข้อมูลหลังบันทึกครั้งแรก
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      <button type="submit" disabled={pending} className={btnPrimary}>
        {pending ? "กำลังบันทึก…" : "บันทึกการแก้ไข"}
      </button>
      </form>
    </>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | undefined;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block text-xs">
      <span className="text-slate-600">{label}</span>
      <input value={value ?? ""} onChange={(e) => onChange(e.target.value)} className={inp} />
    </label>
  );
}

function normalizeVehicleRow(raw: Partial<VehicleRow> & { lineIndex: number }): VehicleRow {
  const engineType =
    raw.engineType === "DIESEL" || raw.engineType === "ELECTRIC" ? raw.engineType : "GASOLINE";
  return {
    lineIndex: raw.lineIndex,
    licensePlate: String(raw.licensePlate ?? ""),
    brand: String(raw.brand ?? ""),
    model: String(raw.model ?? ""),
    year: String(raw.year ?? ""),
    color: String(raw.color ?? ""),
    engineType,
    engineSize: String(raw.engineSize ?? ""),
    extraNotes: String(raw.extraNotes ?? ""),
    contractPhotos: Array.isArray(raw.contractPhotos) ? raw.contractPhotos : [],
  };
}

function vehicleMatchesSearch(v: VehicleRow, queryLower: string): boolean {
  const plate = (v.licensePlate ?? "").toLowerCase();
  const brand = (v.brand ?? "").toLowerCase();
  const model = (v.model ?? "").toLowerCase();
  return plate.includes(queryLower) || brand.includes(queryLower) || model.includes(queryLower);
}

function mergeVehicleRows(count: number, existing: VehicleRow[]): VehicleRow[] {
  const byLine = new Map(existing.map((v) => [v.lineIndex, normalizeVehicleRow(v)]));
  const rows: VehicleRow[] = [];
  for (let i = 1; i <= count; i++) {
    rows.push(normalizeVehicleRow(byLine.get(i) ?? { lineIndex: i }));
  }
  return rows;
}

const inp =
  "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";
const inpTight =
  "w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";
const btnPrimary =
  "rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60";
const btnSecondary =
  "rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 hover:bg-slate-50";
const btnBlue =
  "inline-flex rounded-md bg-blue-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-800";
