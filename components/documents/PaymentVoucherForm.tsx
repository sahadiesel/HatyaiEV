"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { useAuth } from "@/components/AuthProvider";
import { DocumentPrintLink } from "@/components/documents/DocumentPrintLink";
import { savePaymentVoucherClient } from "@/lib/documents-client";
import { listEntitiesClient } from "@/lib/entities-client";
import { defaultPaymentVoucherMeta, type PaymentVoucherMeta } from "@/lib/documents/types";
import type { EntityRecord } from "@/lib/domain-types";

const inp =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

export function PaymentVoucherForm({
  entities,
  initial,
}: {
  entities: EntityRecord[];
  initial?: {
    id: string;
    number: string;
    issueDate: string;
    totalAmount: string;
    notes: string;
    meta: PaymentVoucherMeta;
  };
}) {
  const { profile } = useAuth();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [meta, setMeta] = useState<PaymentVoucherMeta>(initial?.meta ?? defaultPaymentVoucherMeta());
  const [amount, setAmount] = useState(initial?.totalAmount ?? "0");
  const [issueDate, setIssueDate] = useState(
    initial?.issueDate ?? new Date().toISOString().slice(0, 10),
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [assignNumber, setAssignNumber] = useState(!initial?.id);
  const [savedId, setSavedId] = useState(initial?.id ?? "");
  const [savedNumber, setSavedNumber] = useState(initial?.number ?? "");
  const [entityOptions, setEntityOptions] = useState(entities);

  useEffect(() => {
    void listEntitiesClient().then((rows) => {
      if (rows.length > 0) setEntityOptions(rows);
      else if (entities.length > 0) setEntityOptions(entities);
    });
  }, [entities]);

  function onEntity(id: string) {
    const e = entityOptions.find((x) => x.id === id);
    if (!e) return;
    setMeta((m) => ({
      ...m,
      payeeName: e.name,
      payeeAddress: e.address,
      payeeTaxId: e.taxId,
      payeePhone: e.phone,
    }));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await savePaymentVoucherClient({
        id: savedId || null,
        issueDate,
        totalAmount: amount,
        notes,
        metaJson: JSON.stringify({ ...meta, issuedByName: profile?.name ?? "" }),
        issuedByName: profile?.name ?? "",
        assignNumber,
        postCashbook: true,
      });
      if (!res.ok) {
        setMsg(res.message);
        return;
      }
      setSavedId(res.id);
      if (res.number) setSavedNumber(res.number);
      setMsg("บันทึกใบสำคัญจ่ายแล้ว — ลงสมุดเงินสดอัตโนมัติ");
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">ใบสำคัญจ่าย (Payment Voucher)</h2>
        <Link href="/documents/payment-voucher" className="text-sm text-blue-800 hover:underline">
          ← รายการ
        </Link>
      </div>
      {msg && <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{msg}</p>}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">เลือกผู้รับเงินจาก Entities</span>
          <select className={inp} defaultValue="" onChange={(e) => onEntity(e.target.value)}>
            <option value="">— กรอกเอง / เลือก —</option>
            {entityOptions.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">วันที่</span>
          <input type="date" className={inp} value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">ชื่อผู้รับเงิน</span>
          <input
            className={inp}
            value={meta.payeeName}
            onChange={(e) => setMeta((m) => ({ ...m, payeeName: e.target.value }))}
            required
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">เลขผู้เสียภาษี</span>
          <input
            className={inp}
            value={meta.payeeTaxId}
            onChange={(e) => setMeta((m) => ({ ...m, payeeTaxId: e.target.value }))}
          />
        </label>
        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block text-slate-600">ที่อยู่</span>
          <input
            className={inp}
            value={meta.payeeAddress}
            onChange={(e) => setMeta((m) => ({ ...m, payeeAddress: e.target.value }))}
          />
        </label>
        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block text-slate-600">วัตถุประสงค์การจ่าย</span>
          <input
            className={inp}
            value={meta.purpose}
            onChange={(e) => setMeta((m) => ({ ...m, purpose: e.target.value }))}
            placeholder="เช่น จ่ายค่ารถเข้า / ซื้ออะไหล่"
            required
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">จำนวนเงิน</span>
          <input className={inp} value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">วิธีจ่าย</span>
          <select
            className={inp}
            value={meta.paymentMethod}
            onChange={(e) =>
              setMeta((m) => ({ ...m, paymentMethod: e.target.value as PaymentVoucherMeta["paymentMethod"] }))
            }
          >
            <option value="CASH">เงินสด</option>
            <option value="TRANSFER">โอน</option>
            <option value="CHEQUE">เช็ค</option>
          </select>
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={assignNumber} onChange={(e) => setAssignNumber(e.target.checked)} />
        ออกเลขที่เอกสารเมื่อบันทึก
      </label>

      <label className="block text-sm">
        <span className="mb-1 block text-slate-600">หมายเหตุ</span>
        <textarea className={inp} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {pending ? "กำลังบันทึก…" : "บันทึก + ลงสมุดเงินสด"}
        </button>
        {savedId && savedNumber && (
          <DocumentPrintLink documentId={savedId} label="พิมพ์ PDF" />
        )}
      </div>
    </form>
  );
}
