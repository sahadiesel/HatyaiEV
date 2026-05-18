"use client";

import { useMemo, useState } from "react";
import type { ContractDocStatus } from "@prisma/client";
import { updateSubcontractAgreement } from "../actions";
import type { InstallmentRow } from "../../hiring-contracts/[id]/HiringContractEditor";

type ContractorOpt = { id: string; name: string };
type HiringOpt = { id: string; code: string; clientName: string };
type VehicleOpt = {
  id: string;
  lineIndex: number;
  brand: string;
  model: string;
  year: string;
  color: string;
};

export function SubcontractAgreementEditor({
  agreementId,
  code,
  contractors,
  hiringOptions,
  vehiclesByHiringId,
  initialContractorId,
  initialHiringContractId,
  initialTitle,
  initialPriceExVat,
  initialVatRate,
  initialNotes,
  initialStatus,
  initialSelectedVehicleIds,
  initialInstallments,
}: {
  agreementId: string;
  code: string;
  contractors: ContractorOpt[];
  hiringOptions: HiringOpt[];
  vehiclesByHiringId: Record<string, VehicleOpt[]>;
  initialContractorId: string;
  initialHiringContractId: string;
  initialTitle: string;
  initialPriceExVat: string;
  initialVatRate: string;
  initialNotes: string;
  initialStatus: ContractDocStatus;
  initialSelectedVehicleIds: string[];
  initialInstallments: InstallmentRow[];
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const [contractorId, setContractorId] = useState(initialContractorId);
  const [hiringContractId, setHiringContractId] = useState(initialHiringContractId);
  const [title, setTitle] = useState(initialTitle);
  const [pricePerVehicleExVat, setPricePerVehicleExVat] = useState(initialPriceExVat);
  const [vatRate, setVatRate] = useState(initialVatRate);
  const [notes, setNotes] = useState(initialNotes);
  const [status, setStatus] = useState<ContractDocStatus>(initialStatus);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(initialSelectedVehicleIds));
  const [installments, setInstallments] = useState<InstallmentRow[]>(() => initialInstallments);

  const vehicles = vehiclesByHiringId[hiringContractId] ?? [];

  const totalExVat = useMemo(() => {
    const p = parseFloat(pricePerVehicleExVat.replace(/,/g, "")) || 0;
    return p * selected.size;
  }, [pricePerVehicleExVat, selected]);

  function toggleVehicle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function onHiringChange(id: string) {
    setHiringContractId(id);
    setSelected(new Set());
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
    setMessage("คำนวณยอดงวดจาก % ของมูลค่ารวมก่อน VAT (ตามจำนวนคันที่เลือก) แล้ว");
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setMessage(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    fd.set("selectedVehicleIdsJson", JSON.stringify([...selected]));
    fd.set("installmentsJson", JSON.stringify(installments));
    const res = await updateSubcontractAgreement(fd);
    setPending(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setMessage("บันทึกแล้ว");
  }

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      <input type="hidden" name="id" value={agreementId} />

      {message && (
        <p className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900">{message}</p>
      )}
      {error && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">{error}</p>}

      <p className="text-sm text-slate-600">
        เลขที่สัญญา: <strong>{code}</strong>
      </p>

      <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="font-semibold text-slate-900">คู่สัญญาและอ้างอิง</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="font-medium text-slate-700">ผู้รับเหมา *</span>
            <select
              name="contractorId"
              required
              value={contractorId}
              onChange={(e) => setContractorId(e.target.value)}
              className={inp}
            >
              {contractors.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-700">อ้างอิงสัญญารับจ้าง *</span>
            <select
              name="hiringContractId"
              required
              value={hiringContractId}
              onChange={(e) => onHiringChange(e.target.value)}
              className={inp}
            >
              {hiringOptions.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.code} — {h.clientName}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="font-medium text-slate-700">ชื่อเรื่อง</span>
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
        <h2 className="font-semibold text-slate-900">เลือกรถจากสัญญารับจ้าง (ไม่ต้องกรอกรายละเอียดใหม่)</h2>
        {vehicles.length === 0 ? (
          <p className="text-sm text-amber-800">
            ยังไม่มีรายการรถในสัญญารับจ้างฉบับนี้ — ไปที่สัญญารับจ้างแล้วตั้งจำนวนคันและบันทึกรายละเอียดรถก่อน
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-md border border-slate-200">
            {vehicles.map((v) => (
              <li key={v.id} className="flex flex-wrap items-start gap-3 p-3">
                <input
                  type="checkbox"
                  className="mt-1 rounded border-slate-300"
                  checked={selected.has(v.id)}
                  onChange={() => toggleVehicle(v.id)}
                />
                <div className="text-sm">
                  <p className="font-medium text-slate-900">
                    คันที่ {v.lineIndex}: {v.brand} {v.model} ({v.year}) — {v.color}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="text-sm text-slate-600">
          เลือกแล้ว {selected.size} คัน · มูลค่ารวมก่อน VAT ตามราคาต่อคัน:{" "}
          <strong>{totalExVat.toLocaleString("th-TH", { maximumFractionDigits: 2 })}</strong> บาท
        </p>
      </section>

      <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="font-semibold text-slate-900">ราคาต่อคัน (ว่าจ้างเหมา)</h2>
        <div className="grid gap-3 sm:grid-cols-2">
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
      </section>

      <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-slate-900">งวดจ่ายเงิน</h2>
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
                <th className="py-2 pr-2">%</th>
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

      <button type="submit" disabled={pending} className={btnPrimary}>
        {pending ? "กำลังบันทึก…" : "บันทึกสัญญาว่าจ้าง"}
      </button>
    </form>
  );
}

const inp =
  "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";
const inpTight =
  "w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";
const btnPrimary =
  "rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60";
const btnSecondary =
  "rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 hover:bg-slate-50";
