"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { updateVehicleBilling } from "@/app/contracts/hiring-contracts/vehicle-actions";
import {
  BILLING_KIND_LABELS,
  type BillingRecordKind,
  type VehicleBillingRecord,
} from "@/lib/vehicle-inspection-items";

function newRecord(): VehicleBillingRecord {
  return {
    id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `b-${Date.now()}`,
    kind: "INVOICE",
    documentDate: "",
    amount: "",
    notes: "",
  };
}

function parseAmount(s: string): number {
  return parseFloat(String(s).replace(/,/g, "")) || 0;
}

export function VehicleBillingEditor({
  contractId,
  contractCode,
  lineIndex,
  licensePlate,
  brand,
  model,
  year,
  contractAmountInclVat,
  initialRecords,
}: {
  contractId: string;
  contractCode: string;
  lineIndex: number;
  licensePlate: string;
  brand: string;
  model: string;
  year: string;
  contractAmountInclVat: number;
  initialRecords: VehicleBillingRecord[];
}) {
  const [records, setRecords] = useState(initialRecords);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const summary = useMemo(() => {
    let invoiced = 0;
    let received = 0;
    for (const r of records) {
      const amt = parseAmount(r.amount);
      if (r.kind === "INVOICE") invoiced += amt;
      if (r.kind === "RECEIPT") received += amt;
    }
    const remaining = contractAmountInclVat - received;
    const complete = contractAmountInclVat > 0 && remaining <= 0.01;
    return { invoiced, received, remaining, complete, contractAmountInclVat };
  }, [records, contractAmountInclVat]);

  function updateRecord(id: string, patch: Partial<VehicleBillingRecord>) {
    setRecords((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function removeRecord(id: string) {
    setRecords((prev) => prev.filter((r) => r.id !== id));
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setMessage(null);
    setError(null);
    const res = await updateVehicleBilling(contractId, lineIndex, JSON.stringify(records));
    setPending(false);
    if (res.ok) setMessage("บันทึกการวางบิลแล้ว");
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
        <h1 className="mt-2 text-2xl font-bold text-slate-900">รายละเอียดการวางบิลเก็บเงิน</h1>
        <p className="mt-1 text-sm text-slate-600">
          คันที่ {lineIndex} — {vehicleLabel}
        </p>
      </div>

      {message && (
        <p className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900">{message}</p>
      )}
      {error && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">{error}</p>}

      <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          title="มูลค่าตามสัญญา (รวม VAT)"
          value={summary.contractAmountInclVat}
        />
        <SummaryCard title="ยอดแจ้งหนี้รวม" value={summary.invoiced} />
        <SummaryCard title="ยอดรับเงินรวม (ใบเสร็จ)" value={summary.received} />
        <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
          <p className="text-xs text-slate-600">สถานะเก็บเงิน</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">
            {summary.complete ? "ครบแล้ว" : `ขาด ${summary.remaining.toLocaleString("th-TH", { maximumFractionDigits: 2 })} บาท`}
          </p>
        </div>
      </section>

      <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-slate-900">บันทึกเอกสาร</h2>
          <button
            type="button"
            onClick={() => setRecords((prev) => [...prev, newRecord()])}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 hover:bg-slate-50"
          >
            + เพิ่มรายการ
          </button>
        </div>
        {records.length === 0 ? (
          <p className="text-sm text-slate-500">ยังไม่มีรายการ — กดเพิ่มเพื่อบันทึกวันที่แจ้งหนี้ ใบกำกับภาษี หรือใบเสร็จ</p>
        ) : (
          <div className="space-y-3">
            {records.map((r) => (
              <div key={r.id} className="grid gap-2 rounded-md border border-slate-100 bg-slate-50/80 p-3 sm:grid-cols-2 lg:grid-cols-5">
                <label className="block text-xs">
                  <span className="text-slate-600">ประเภท</span>
                  <select
                    value={r.kind}
                    onChange={(e) => updateRecord(r.id, { kind: e.target.value as BillingRecordKind })}
                    className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                  >
                    {(Object.keys(BILLING_KIND_LABELS) as BillingRecordKind[]).map((k) => (
                      <option key={k} value={k}>
                        {BILLING_KIND_LABELS[k]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs">
                  <span className="text-slate-600">วันที่</span>
                  <input
                    type="date"
                    value={r.documentDate}
                    onChange={(e) => updateRecord(r.id, { documentDate: e.target.value })}
                    className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                  />
                </label>
                <label className="block text-xs">
                  <span className="text-slate-600">จำนวนเงิน (บาท)</span>
                  <input
                    value={r.amount}
                    onChange={(e) => updateRecord(r.id, { amount: e.target.value })}
                    className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                    placeholder="0"
                  />
                </label>
                <label className="block text-xs sm:col-span-2">
                  <span className="text-slate-600">หมายเหตุ / เลขที่เอกสาร</span>
                  <input
                    value={r.notes}
                    onChange={(e) => updateRecord(r.id, { notes: e.target.value })}
                    className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                  />
                </label>
                <div className="flex items-end sm:col-span-2 lg:col-span-1">
                  <button type="button" onClick={() => removeRecord(r.id)} className="text-sm text-red-700 hover:underline">
                    ลบรายการ
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
      >
        {pending ? "กำลังบันทึก…" : "บันทึกการวางบิล"}
      </button>
    </form>
  );
}

function SummaryCard({ title, value }: { title: string; value: number }) {
  return (
    <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
      <p className="text-xs text-slate-600">{title}</p>
      <p className="mt-1 text-lg font-semibold text-slate-900">
        {value.toLocaleString("th-TH", { maximumFractionDigits: 2 })} บาท
      </p>
    </div>
  );
}
