"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useAuth } from "@/components/AuthProvider";
import { DocumentPrintLink } from "@/components/documents/DocumentPrintLink";
import { parseAmount, roundMoney2 } from "@/lib/documents/calc";
import { resolvePaymentVoucherWht } from "@/lib/documents/payment-voucher-wht";
import { getDocumentClient, savePaymentVoucherClient } from "@/lib/documents-client";
import { listEntitiesClient } from "@/lib/entities-client";
import {
  defaultPaymentVoucherMeta,
  parseMetaJson,
  type PaymentVoucherMeta,
} from "@/lib/documents/types";
import type { EntityRecord } from "@/lib/domain-types";

const inp =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

function fmt(n: number): string {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function calcWhtAmount(base: number, rate: number): number {
  return roundMoney2((base * rate) / 100);
}

export function PaymentVoucherForm({
  entities,
  initial,
  documentId,
}: {
  entities: EntityRecord[];
  documentId?: string;
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
  const [loadingDoc, setLoadingDoc] = useState(Boolean(documentId && !initial));
  const [loadError, setLoadError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [meta, setMeta] = useState<PaymentVoucherMeta>(() => {
    const m = initial?.meta ?? defaultPaymentVoucherMeta();
    const hasWht =
      m.withholdingEnabled === true ||
      parseAmount(m.withholdingAmount ?? "") > 0 ||
      Boolean(m.withholdingDocumentNumber);
    return {
      ...defaultPaymentVoucherMeta(),
      ...m,
      withholdingEnabled: hasWht,
      withholdingTaxRatePercent: m.withholdingTaxRatePercent || "3",
      withholdingTaxBase: m.withholdingTaxBase || initial?.totalAmount || "",
      withholdingAmount: m.withholdingAmount || "0",
    };
  });
  const [amount, setAmount] = useState(initial?.totalAmount ?? "0");
  const [issueDate, setIssueDate] = useState(
    initial?.issueDate ?? new Date().toISOString().slice(0, 10),
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [savedId, setSavedId] = useState(initial?.id ?? documentId ?? "");
  const [savedNumber, setSavedNumber] = useState(initial?.number ?? "");
  const [entityOptions, setEntityOptions] = useState(entities);

  useEffect(() => {
    void listEntitiesClient().then((rows) => {
      if (rows.length > 0) setEntityOptions(rows);
      else if (entities.length > 0) setEntityOptions(entities);
    });
  }, [entities]);

  useEffect(() => {
    if (!documentId || initial) return;
    let cancelled = false;
    setLoadingDoc(true);
    void (async () => {
      const row = await getDocumentClient(documentId);
      if (cancelled) return;
      if (!row || row.kind !== "PAYMENT_VOUCHER") {
        setLoadError("ไม่พบใบสำคัญจ่ายนี้");
        setLoadingDoc(false);
        return;
      }
      const m = parseMetaJson<PaymentVoucherMeta>(row.metaJson, defaultPaymentVoucherMeta());
      const noteText = row.notes || "";
      const hasWht =
        m.withholdingEnabled === true ||
        parseAmount(m.withholdingAmount ?? "") > 0 ||
        parseAmount(row.withholdingAmount) > 0 ||
        Boolean(m.withholdingDocumentNumber);
      setMeta({
        ...defaultPaymentVoucherMeta(),
        ...m,
        withholdingEnabled: hasWht,
        withholdingTaxRatePercent: m.withholdingTaxRatePercent || "3",
        withholdingTaxBase: m.withholdingTaxBase || String(row.totalAmount || "0"),
        withholdingAmount:
          m.withholdingAmount ||
          (parseAmount(row.withholdingAmount) > 0 ? String(row.withholdingAmount) : "0"),
      });
      setAmount(String(row.totalAmount || "0"));
      setIssueDate(row.issueDate.toISOString().slice(0, 10));
      setNotes(noteText);
      setSavedId(row.id);
      setSavedNumber(row.number || "");
      setLoadingDoc(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [documentId, initial]);

  const payAmount = parseAmount(amount);
  const whtRate = parseAmount(meta.withholdingTaxRatePercent ?? "");
  const whtBase = parseAmount(meta.withholdingTaxBase ?? "") || payAmount;
  const whtAmt = meta.withholdingEnabled ? calcWhtAmount(whtBase, whtRate) : 0;
  const netPay = Math.max(0, payAmount - whtAmt);
  const wht = useMemo(() => resolvePaymentVoucherWht(meta, notes), [meta, notes]);

  function setWhtEnabled(enabled: boolean) {
    setMeta((m) => {
      const base = parseAmount(m.withholdingTaxBase ?? "") || payAmount;
      const rate = parseAmount(m.withholdingTaxRatePercent ?? "3") || 3;
      return {
        ...m,
        withholdingEnabled: enabled,
        withholdingTaxBase: String(base || payAmount),
        withholdingTaxRatePercent: m.withholdingTaxRatePercent || "3",
        withholdingAmount: enabled ? String(calcWhtAmount(base || payAmount, rate)) : "0",
      };
    });
  }

  function setWhtRate(rateStr: string) {
    setMeta((m) => {
      const base = parseAmount(m.withholdingTaxBase ?? "") || payAmount;
      const rate = parseAmount(rateStr);
      return {
        ...m,
        withholdingTaxRatePercent: rateStr,
        withholdingAmount: m.withholdingEnabled ? String(calcWhtAmount(base, rate)) : "0",
      };
    });
  }

  function setWhtBase(baseStr: string) {
    setMeta((m) => {
      const base = parseAmount(baseStr);
      const rate = parseAmount(m.withholdingTaxRatePercent ?? "");
      return {
        ...m,
        withholdingTaxBase: baseStr,
        withholdingAmount: m.withholdingEnabled ? String(calcWhtAmount(base, rate)) : "0",
      };
    });
  }

  function onAmountChange(v: string) {
    setAmount(v);
    setMeta((m) => {
      if (!m.withholdingEnabled) return m;
      const pay = parseAmount(v);
      const base = parseAmount(m.withholdingTaxBase ?? "") || pay;
      // ถ้าฐานยังว่างหรือเท่ากับยอดเดิม ให้ sync ตามยอดใหม่
      const prevPay = payAmount;
      const prevBase = parseAmount(m.withholdingTaxBase ?? "");
      const nextBase = !m.withholdingTaxBase || prevBase === prevPay ? pay : base;
      const rate = parseAmount(m.withholdingTaxRatePercent ?? "");
      return {
        ...m,
        withholdingTaxBase: String(nextBase),
        withholdingAmount: String(calcWhtAmount(nextBase, rate)),
      };
    });
  }

  function onEntity(id: string) {
    const e = entityOptions.find((x) => x.id === id);
    if (!e) return;
    setMeta((m) => {
      const rate = e.defaultWhtPercent || m.withholdingTaxRatePercent || "3";
      const base = parseAmount(m.withholdingTaxBase ?? "") || payAmount;
      return {
        ...m,
        payeeName: e.name,
        payeeAddress: e.address,
        payeeTaxId: e.taxId,
        payeePhone: e.phone,
        withholdingTaxRatePercent: rate,
        withholdingAmount: m.withholdingEnabled
          ? String(calcWhtAmount(base, parseAmount(rate)))
          : m.withholdingAmount,
      };
    });
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const wasEdit = Boolean(savedId);
    startTransition(async () => {
      const base = parseAmount(meta.withholdingTaxBase ?? "") || payAmount;
      const rate = parseAmount(meta.withholdingTaxRatePercent ?? "") || 3;
      const amt = meta.withholdingEnabled ? calcWhtAmount(base, rate) : 0;
      const nextMeta: PaymentVoucherMeta = {
        ...meta,
        issuedByName: profile?.name ?? "",
        withholdingEnabled: Boolean(meta.withholdingEnabled),
        withholdingTaxBase: String(base),
        withholdingTaxRatePercent: String(rate),
        withholdingAmount: String(amt),
      };
      const res = await savePaymentVoucherClient({
        id: savedId || null,
        issueDate,
        totalAmount: amount,
        notes,
        metaJson: JSON.stringify(nextMeta),
        issuedByName: profile?.name ?? "",
        assignNumber: !savedNumber,
        postCashbook: !wasEdit,
      });
      if (!res.ok) {
        setMsg(res.message);
        return;
      }
      setSavedId(res.id);
      if (res.number) setSavedNumber(res.number);
      const fresh = await getDocumentClient(res.id);
      if (fresh) {
        setMeta(parseMetaJson<PaymentVoucherMeta>(fresh.metaJson, defaultPaymentVoucherMeta()));
        setNotes(fresh.notes || notes);
      }
      const whtHint =
        res.withholdingDocumentNumber != null && res.withholdingDocumentNumber
          ? ` · สร้างใบหัก ${res.withholdingDocumentNumber}`
          : "";
      setMsg(
        wasEdit
          ? `บันทึกการแก้ไขแล้ว — อัปเดตช่องทาง/ยอดในสมุดเงินสดแล้ว${whtHint}`
          : `บันทึกใบสำคัญจ่ายแล้ว — ลงสมุดเงินสดอัตโนมัติ${whtHint}`,
      );
      router.push("/documents/payment-voucher");
      router.refresh();
    });
  }

  if (loadingDoc) {
    return <p className="text-sm text-slate-600">กำลังโหลดใบสำคัญจ่าย…</p>;
  }

  if (loadError) {
    return (
      <div className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-800">
        <p>{loadError}</p>
        <Link href="/documents/payment-voucher" className="text-sm text-blue-800 hover:underline">
          ← กลับรายการ
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">
          {savedId ? "แก้ไขใบสำคัญจ่าย" : "ใบสำคัญจ่าย"} (Payment Voucher)
          {savedNumber ? ` · ${savedNumber}` : ""}
        </h2>
        <Link href="/documents/payment-voucher" className="text-sm text-blue-800 hover:underline">
          ← รายการ
        </Link>
      </div>
      {msg && <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{msg}</p>}

      {/* บรรทัด 1: ชื่อ · วันที่ · เลขผู้เสียภาษี */}
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">ชื่อผู้รับเงิน</span>
          <select
            className={inp}
            value={
              entityOptions.find(
                (e) =>
                  e.name === meta.payeeName &&
                  (!meta.payeeTaxId || e.taxId === meta.payeeTaxId),
              )?.id ??
              (meta.payeeName ? "__custom__" : "")
            }
            onChange={(e) => {
              const v = e.target.value;
              if (!v || v === "__custom__") return;
              onEntity(v);
            }}
            required={!meta.payeeName}
          >
            <option value="">— เลือกผู้รับเงิน —</option>
            {meta.payeeName &&
              !entityOptions.some(
                (e) =>
                  e.name === meta.payeeName &&
                  (!meta.payeeTaxId || e.taxId === meta.payeeTaxId),
              ) && <option value="__custom__">{meta.payeeName}</option>}
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
          <span className="mb-1 block text-slate-600">เลขผู้เสียภาษี</span>
          <input
            className={inp}
            value={meta.payeeTaxId}
            onChange={(e) => setMeta((m) => ({ ...m, payeeTaxId: e.target.value }))}
          />
        </label>
      </div>

      {/* บรรทัด 2: ที่อยู่ */}
      <label className="block text-sm">
        <span className="mb-1 block text-slate-600">ที่อยู่</span>
        <input
          className={inp}
          value={meta.payeeAddress}
          onChange={(e) => setMeta((m) => ({ ...m, payeeAddress: e.target.value }))}
        />
      </label>

      {/* บรรทัด 3: วัตถุประสงค์ · จำนวนเงิน · วิธีจ่าย */}
      <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <label className="text-sm">
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
          <input className={inp} value={amount} onChange={(e) => onAmountChange(e.target.value)} required />
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
          <p className="mt-1 text-[11px] text-slate-500">
            {meta.paymentMethod === "CASH"
              ? "ลงสมุดเงินสดช่องทางเงินสดหน้าร้าน"
              : "ลงสมุดเงินสดช่องทางบัญชีธนาคารหลัก"}
          </p>
        </label>
      </div>

      {/* บรรทัด 4: หัก ณ ที่จ่าย · หมายเหตุ */}
      <div className="grid items-stretch gap-3 sm:grid-cols-2">
        <div className="flex h-full flex-col rounded-md border border-amber-300 bg-amber-50 px-4 py-3">
          <label className="flex items-center gap-2 text-sm font-semibold text-amber-950">
            <input
              type="checkbox"
              checked={Boolean(meta.withholdingEnabled)}
              onChange={(e) => setWhtEnabled(e.target.checked)}
              disabled={pending}
            />
            มีหักภาษี ณ ที่จ่าย
          </label>
          <p className="mt-1 text-xs text-amber-900">
            ติ๊กแล้วระบบจะสร้างใบหัก ณ ที่จ่ายให้อัตโนมัติ — ยอดตัดบัญชี = จ่ายสุทธิหลังหัก
          </p>

          {meta.withholdingEnabled && (
            <div className="mt-3 space-y-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="text-sm">
                  <span className="mb-1 block text-slate-600">อัตราหัก (%)</span>
                  <input
                    className={inp}
                    value={meta.withholdingTaxRatePercent || ""}
                    onChange={(e) => setWhtRate(e.target.value)}
                    disabled={pending}
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-slate-600">มูลค่าฐานหัก</span>
                  <input
                    className={inp}
                    value={meta.withholdingTaxBase || ""}
                    onChange={(e) => setWhtBase(e.target.value)}
                    disabled={pending}
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-slate-600">ยอดหัก ณ ที่จ่าย</span>
                  <input className={inp} value={fmt(whtAmt)} readOnly disabled />
                </label>
              </div>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm text-slate-800">
                <div>
                  <dt className="text-xs text-slate-500">ยอดจ่ายก่อนหัก</dt>
                  <dd className="tabular-nums font-medium">{fmt(payAmount)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">จ่ายสุทธิ (ตัดบัญชี)</dt>
                  <dd className="tabular-nums font-semibold">{fmt(netPay)}</dd>
                </div>
                {wht.whtNo ? (
                  <div className="col-span-2">
                    <dt className="text-xs text-slate-500">ใบหักที่สร้างแล้ว</dt>
                    <dd>
                      <Link
                        href="/documents/withholding"
                        className="font-mono text-xs text-blue-800 hover:underline"
                      >
                        {wht.whtNo}
                      </Link>
                    </dd>
                  </div>
                ) : null}
              </dl>
            </div>
          )}
        </div>

        <label className="flex h-full flex-col text-sm">
          <span className="mb-1 block text-slate-600">หมายเหตุ</span>
          <textarea
            className={`${inp} min-h-0 flex-1 resize-none`}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {pending ? "กำลังบันทึก…" : savedId ? "บันทึก" : "บันทึก + ลงสมุดเงินสด"}
        </button>
        {savedId && savedNumber && (
          <DocumentPrintLink
            documentId={savedId}
            label="พิมพ์ PDF"
            showOptions={false}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-800 hover:bg-slate-50"
          />
        )}
      </div>
    </form>
  );
}
