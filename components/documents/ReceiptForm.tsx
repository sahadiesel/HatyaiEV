"use client";

import type { BankAccountRecord } from "@/lib/domain-types";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { DocumentPrintLink } from "@/components/documents/DocumentPrintLink";
import { useAuth } from "@/components/AuthProvider";
import { listBankAccountsClient } from "@/lib/bank-accounts-client";
import {
  getDocumentClient,
  printDocumentClient,
  saveCommercialDocumentClient,
  toCommercialFormInitial,
} from "@/lib/documents-client";
import { parseAmount, roundMoney2 } from "@/lib/documents/calc";
import {
  defaultCommercialMeta,
  emptyLine,
  type CommercialDocumentMeta,
  type DocumentLineItem,
} from "@/lib/documents/types";
import {
  buildReceiptInitialFromTaxInvoice,
  listOpenTaxInvoicesForReceipt,
} from "@/lib/vehicles/document-pack";
import { formatDateThBE } from "@/lib/format-date-th";
import type { ClientOption } from "@/components/documents/CommercialDocumentForm";

const inp =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

type OpenInvoice = {
  id: string;
  number: string;
  issueDate: string;
  totalAmount: string;
  counterpartyName: string;
  clientId: string | null;
};

function fmt(n: number) {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function bankLabel(b: BankAccountRecord) {
  return `${b.bankName} ${b.accountNumber}${b.isPrimary ? " (หลัก)" : ""} — ${b.accountName}`;
}

export function ReceiptForm({
  clients: _clients,
  documentId,
  taxInvoiceId: initialTaxInvoiceId,
  vehicleId,
}: {
  clients: ClientOption[];
  documentId?: string;
  taxInvoiceId?: string;
  vehicleId?: string;
}) {
  const { profile } = useAuth();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savedId, setSavedId] = useState(documentId || "");
  const [savedNumber, setSavedNumber] = useState("");
  const [openInvoices, setOpenInvoices] = useState<OpenInvoice[]>([]);
  const [banks, setBanks] = useState<BankAccountRecord[]>([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(initialTaxInvoiceId || "");
  const [lines, setLines] = useState<DocumentLineItem[]>([emptyLine(1)]);
  const [meta, setMeta] = useState<CommercialDocumentMeta>(() => ({
    ...defaultCommercialMeta(),
    vatRatePercent: 0,
    withholdingEnabled: false,
    withholdingTaxRatePercent: "3",
    withholdingTaxBase: "0",
    withholdingAmount: "0",
    receiveBankAccountId: null,
    paymentMethod: "TRANSFER",
  }));
  const [clientId, setClientId] = useState("");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [assignNumber, setAssignNumber] = useState(!documentId);
  const [includeSignature, setIncludeSignature] = useState(false);
  const [includeStamp, setIncludeStamp] = useState(false);
  const [receiveChannel, setReceiveChannel] = useState<"CASH" | "BANK" | "CHEQUE">("BANK");

  const receiptTotal = useMemo(
    () => roundMoney2(lines.reduce((s, l) => s + parseAmount(l.amount), 0)),
    [lines],
  );

  const whtRate = parseAmount(meta.withholdingTaxRatePercent ?? "");
  const whtBase = parseAmount(meta.withholdingTaxBase ?? "") || receiptTotal;
  const whtAmount = meta.withholdingEnabled
    ? roundMoney2((whtBase * whtRate) / 100)
    : 0;
  const netToAccount = roundMoney2(Math.max(0, receiptTotal - whtAmount));

  const invoiceOptions = useMemo(() => {
    const list = [...openInvoices];
    if (
      selectedInvoiceId &&
      meta.taxInvoiceNumber &&
      !list.some((i) => i.id === selectedInvoiceId)
    ) {
      list.unshift({
        id: selectedInvoiceId,
        number: meta.taxInvoiceNumber,
        issueDate: meta.taxInvoiceDate || "",
        totalAmount: String(receiptTotal),
        counterpartyName: meta.counterpartyName,
        clientId,
      });
    }
    return list;
  }, [
    openInvoices,
    selectedInvoiceId,
    meta.taxInvoiceNumber,
    meta.taxInvoiceDate,
    meta.counterpartyName,
    receiptTotal,
    clientId,
  ]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const [invs, bankList] = await Promise.all([
        listOpenTaxInvoicesForReceipt(),
        listBankAccountsClient(),
      ]);
      if (cancelled) return;
      setOpenInvoices(invs);
      setBanks(bankList);
      const primary = bankList.find((b) => b.isPrimary) || bankList[0];

      if (documentId) {
        const row = await getDocumentClient(documentId);
        if (cancelled) return;
        if (!row || row.kind !== "RECEIPT") {
          setMsg("ไม่พบใบเสร็จ");
          setLoading(false);
          return;
        }
        const data = toCommercialFormInitial(row);
        setSavedId(data.id);
        setSavedNumber(data.number);
        setLines(data.lines.length ? data.lines : [emptyLine(1)]);
        setMeta({
          ...defaultCommercialMeta(),
          ...data.meta,
          vatRatePercent: data.meta.vatRatePercent ?? 0,
        });
        setClientId(data.clientId ?? "");
        setIssueDate(data.issueDate);
        setNotes(data.notes);
        setAssignNumber(!data.number);
        setSelectedInvoiceId(data.meta.taxInvoiceId || "");
        const pm = data.meta.paymentMethod;
        const ch: "CASH" | "BANK" | "CHEQUE" =
          pm === "CASH" ? "CASH" : pm === "CHEQUE" ? "CHEQUE" : "BANK";
        setReceiveChannel(ch);
        if (ch === "BANK" && !data.meta.receiveBankAccountId && primary) {
          setMeta((m) => ({ ...m, receiveBankAccountId: primary.id }));
        }
        setLoading(false);
        return;
      }

      if (primary) {
        setMeta((m) => ({
          ...m,
          receiveBankAccountId: m.receiveBankAccountId || primary.id,
        }));
      }

      const taxId = initialTaxInvoiceId;
      if (taxId) {
        const res = await buildReceiptInitialFromTaxInvoice(taxId);
        if (cancelled) return;
        if (!res.ok) {
          setMsg(res.message);
          setLoading(false);
          return;
        }
        applyInvoiceInitial(res.initial, vehicleId, primary?.id);
        setSelectedInvoiceId(taxId);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount / documentId only
  }, [documentId, initialTaxInvoiceId, vehicleId]);

  function applyInvoiceInitial(
    initial: {
      clientId: string | null;
      lines: DocumentLineItem[];
      meta: CommercialDocumentMeta;
      notes: string;
      issueDate: string;
    },
    vid?: string,
    defaultBankId?: string,
  ) {
    setClientId(initial.clientId ?? "");
    setIssueDate(initial.issueDate);
    setNotes(initial.notes);
    setLines(initial.lines.length ? initial.lines : [emptyLine(1)]);
    const total = roundMoney2(
      initial.lines.reduce((s, l) => s + parseAmount(l.amount), 0),
    );
    setMeta({
      ...defaultCommercialMeta(),
      ...initial.meta,
      vehicleId: initial.meta.vehicleId || vid,
      vatRatePercent: 0,
      withholdingEnabled: false,
      withholdingTaxRatePercent: initial.meta.withholdingTaxRatePercent || "3",
      withholdingTaxBase: String(total),
      withholdingAmount: "0",
      receiveBankAccountId: initial.meta.receiveBankAccountId || defaultBankId || null,
      paymentMethod: "TRANSFER",
    });
    setReceiveChannel("BANK");
  }

  async function onSelectInvoice(id: string) {
    setSelectedInvoiceId(id);
    setMsg(null);
    if (!id) return;
    setLoading(true);
    const res = await buildReceiptInitialFromTaxInvoice(id);
    setLoading(false);
    if (!res.ok) {
      setMsg(res.message);
      return;
    }
    const primary = banks.find((b) => b.isPrimary) || banks[0];
    applyInvoiceInitial(res.initial, vehicleId, primary?.id);
  }

  function setWhtEnabled(enabled: boolean) {
    setMeta((m) => {
      const base = parseAmount(m.withholdingTaxBase ?? "") || receiptTotal;
      const rate = parseAmount(m.withholdingTaxRatePercent ?? "3");
      const amt = enabled ? roundMoney2((base * rate) / 100) : 0;
      return {
        ...m,
        withholdingEnabled: enabled,
        withholdingTaxBase: String(base || receiptTotal),
        withholdingAmount: String(amt),
      };
    });
  }

  function setWhtRate(rateStr: string) {
    setMeta((m) => {
      const base = parseAmount(m.withholdingTaxBase ?? "") || receiptTotal;
      const rate = parseAmount(rateStr);
      const amt = m.withholdingEnabled ? roundMoney2((base * rate) / 100) : 0;
      return {
        ...m,
        withholdingTaxRatePercent: rateStr,
        withholdingAmount: String(amt),
      };
    });
  }

  function onReceiveChannelChange(ch: "CASH" | "BANK" | "CHEQUE") {
    setReceiveChannel(ch);
    setMeta((m) => ({
      ...m,
      paymentMethod: ch === "CASH" ? "CASH" : ch === "CHEQUE" ? "CHEQUE" : "TRANSFER",
      receiveBankAccountId:
        ch === "BANK"
          ? m.receiveBankAccountId || banks.find((b) => b.isPrimary)?.id || banks[0]?.id || null
          : null,
    }));
  }

  function submit(assign: boolean) {
    setMsg(null);
    if (!documentId && !selectedInvoiceId && !meta.taxInvoiceId) {
      setMsg("กรุณาเลือกใบกำกับภาษีที่ยังไม่ออกใบเสร็จ");
      return;
    }
    if (receiveChannel === "BANK" && !meta.receiveBankAccountId) {
      setMsg("กรุณาเลือกบัญชีที่รับเงิน");
      return;
    }
    if (receiveChannel === "CHEQUE") {
      if (!meta.chequeBankName?.trim() || !meta.chequeNo?.trim() || !meta.chequeDate?.trim()) {
        setMsg("กรุณากรอกชื่อธนาคาร เลขที่เช็ค และวันที่เช็ค");
        return;
      }
    }
    startTransition(async () => {
      const base = parseAmount(meta.withholdingTaxBase ?? "") || receiptTotal;
      const rate = parseAmount(meta.withholdingTaxRatePercent ?? "");
      const amt = meta.withholdingEnabled ? roundMoney2((base * rate) / 100) : 0;
      const nextMeta: CommercialDocumentMeta = {
        ...meta,
        vatRatePercent: 0,
        paymentMethod:
          receiveChannel === "CASH"
            ? "CASH"
            : receiveChannel === "CHEQUE"
              ? "CHEQUE"
              : "TRANSFER",
        receiveBankAccountId: receiveChannel === "BANK" ? meta.receiveBankAccountId : null,
        chequeBankName: receiveChannel === "CHEQUE" ? meta.chequeBankName || "" : "",
        chequeNo: receiveChannel === "CHEQUE" ? meta.chequeNo || "" : "",
        chequeDate: receiveChannel === "CHEQUE" ? meta.chequeDate || "" : "",
        withholdingEnabled: Boolean(meta.withholdingEnabled),
        withholdingTaxBase: String(base),
        withholdingTaxRatePercent: meta.withholdingTaxRatePercent || "0",
        withholdingAmount: String(amt),
      };
      const r = await saveCommercialDocumentClient({
        id: savedId || null,
        kind: "RECEIPT",
        clientId: clientId || null,
        issueDate,
        notes,
        linesJson: JSON.stringify(lines),
        metaJson: JSON.stringify(nextMeta),
        assignNumber: assign,
        issuedByName: profile?.name?.trim() ?? "",
      });
      if (!r.ok) {
        setMsg(r.message ?? "บันทึกไม่สำเร็จ");
        return;
      }
      const docId = r.id!;
      if (assign && docId) {
        await printDocumentClient(docId, profile?.name, {
          includeSignature,
          includeStamp,
        });
      }
      router.push(`/documents/receipt`);
      router.refresh();
    });
  }

  if (loading) {
    return <p className="text-sm text-slate-500">กำลังโหลด…</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-900">
          {savedId ? "แก้ไข" : "สร้าง"}ใบเสร็จรับเงิน
        </h2>
        {savedNumber && (
          <span className="font-mono text-sm text-slate-600">เลขที่ {savedNumber}</span>
        )}
      </div>
      {msg && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{msg}</p>}

      <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        {/* 1. ใบกำกับ + วันที่ */}
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">
              เลือกใบกำกับภาษี (ที่ยังไม่ออกใบเสร็จ)
            </label>
            <select
              className={inp}
              value={selectedInvoiceId}
              onChange={(e) => void onSelectInvoice(e.target.value)}
              disabled={pending || Boolean(savedId)}
            >
              <option value="">— เลือกใบกำกับภาษี —</option>
              {invoiceOptions.map((inv) => (
                <option key={inv.id} value={inv.id}>
                  {inv.number} · {formatDateThBE(inv.issueDate)} · {inv.counterpartyName || "—"} · ฿
                  {fmt(parseAmount(inv.totalAmount))}
                </option>
              ))}
            </select>
            {!savedId && openInvoices.length === 0 && !selectedInvoiceId && (
              <p className="mt-1 text-xs text-amber-800">
                ไม่มีใบกำกับภาษีที่รอออกใบเสร็จ — สร้างใบกำกับภาษีก่อน
              </p>
            )}
          </div>
          <div className="sm:w-44">
            <label className="mb-1 block text-xs text-slate-600">วันที่ใบเสร็จ</label>
            <input
              type="date"
              className={inp}
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
              disabled={pending}
            />
          </div>
        </div>

        {/* 2. ชื่อ เบอร์ เลขผู้เสียภาษี */}
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs text-slate-600">ชื่อลูกค้า</label>
            <input
              className={inp}
              value={meta.counterpartyName}
              onChange={(e) => setMeta((m) => ({ ...m, counterpartyName: e.target.value }))}
              disabled={pending}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-600">เบอร์ติดต่อ</label>
            <input
              className={inp}
              value={meta.counterpartyPhone}
              onChange={(e) => setMeta((m) => ({ ...m, counterpartyPhone: e.target.value }))}
              disabled={pending}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-600">เลขประจำตัวผู้เสียภาษี</label>
            <input
              className={inp}
              value={meta.counterpartyTaxId}
              onChange={(e) => setMeta((m) => ({ ...m, counterpartyTaxId: e.target.value }))}
              disabled={pending}
            />
          </div>
        </div>

        {/* 3. ที่อยู่ */}
        <div>
          <label className="mb-1 block text-xs text-slate-600">ที่อยู่ลูกค้า</label>
          <textarea
            className={inp}
            rows={2}
            value={meta.counterpartyAddress}
            onChange={(e) => setMeta((m) => ({ ...m, counterpartyAddress: e.target.value }))}
            disabled={pending}
          />
        </div>

        {/* 4. เงินสด/บัญชี/เช็ค + หัก ณ ที่จ่าย (แยกชัด) */}
        <div className="space-y-2 rounded-md border border-slate-100 bg-slate-50 p-3">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="text-xs font-medium text-slate-700">บัญชีที่รับเงิน</span>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="receiveChannel"
                    checked={receiveChannel === "CASH"}
                    onChange={() => onReceiveChannelChange("CASH")}
                    disabled={pending}
                  />
                  เงินสด
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="receiveChannel"
                    checked={receiveChannel === "BANK"}
                    onChange={() => onReceiveChannelChange("BANK")}
                    disabled={pending}
                  />
                  บัญชีธนาคาร
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="receiveChannel"
                    checked={receiveChannel === "CHEQUE"}
                    onChange={() => onReceiveChannelChange("CHEQUE")}
                    disabled={pending}
                  />
                  เช็ค
                </label>
              </div>
              {receiveChannel === "BANK" && (
                <select
                  className={inp}
                  value={meta.receiveBankAccountId || ""}
                  onChange={(e) =>
                    setMeta((m) => ({ ...m, receiveBankAccountId: e.target.value || null }))
                  }
                  disabled={pending}
                >
                  <option value="">— เลือกบัญชี —</option>
                  {banks.map((b) => (
                    <option key={b.id} value={b.id}>
                      {bankLabel(b)}
                    </option>
                  ))}
                </select>
              )}
              {receiveChannel === "CHEQUE" && (
                <div className="grid gap-2 sm:grid-cols-3">
                  <label className="text-sm">
                    <span className="mb-1 block text-xs text-slate-600">ชื่อธนาคาร</span>
                    <input
                      className={inp}
                      value={meta.chequeBankName || ""}
                      onChange={(e) =>
                        setMeta((m) => ({ ...m, chequeBankName: e.target.value }))
                      }
                      disabled={pending}
                      placeholder="เช่น กสิกรไทย"
                    />
                  </label>
                  <label className="text-sm">
                    <span className="mb-1 block text-xs text-slate-600">เลขที่เช็ค</span>
                    <input
                      className={inp}
                      value={meta.chequeNo || ""}
                      onChange={(e) => setMeta((m) => ({ ...m, chequeNo: e.target.value }))}
                      disabled={pending}
                    />
                  </label>
                  <label className="text-sm">
                    <span className="mb-1 block text-xs text-slate-600">วันที่เช็ค</span>
                    <input
                      type="date"
                      className={inp}
                      value={meta.chequeDate || ""}
                      onChange={(e) => setMeta((m) => ({ ...m, chequeDate: e.target.value }))}
                      disabled={pending}
                    />
                  </label>
                </div>
              )}
            </div>

            <div className="shrink-0 rounded-md border border-amber-300 bg-amber-50 px-3 py-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-amber-950">
                <input
                  type="checkbox"
                  checked={Boolean(meta.withholdingEnabled)}
                  onChange={(e) => setWhtEnabled(e.target.checked)}
                  disabled={pending}
                />
                มีหัก ณ ที่จ่าย
              </label>
              {meta.withholdingEnabled && (
                <div className="mt-2 flex items-end gap-2">
                  <label className="text-sm">
                    <span className="mb-1 block text-xs text-slate-600">อัตรา (%)</span>
                    <input
                      className={`${inp} w-20`}
                      value={meta.withholdingTaxRatePercent || ""}
                      onChange={(e) => setWhtRate(e.target.value)}
                      disabled={pending}
                    />
                  </label>
                  <span className="pb-2 text-xs tabular-nums text-amber-900">
                    = {fmt(whtAmount)} บาท
                  </span>
                </div>
              )}
            </div>
          </div>
          {meta.withholdingEnabled && (
            <div className="grid gap-3 rounded-md border border-amber-200 bg-amber-50/80 p-3 sm:grid-cols-2">
              <label className="text-sm">
                <span className="mb-1 block text-xs text-slate-600">ฐานหัก (บาท)</span>
                <input
                  className={inp}
                  value={meta.withholdingTaxBase || ""}
                  onChange={(e) => {
                    const baseStr = e.target.value;
                    setMeta((m) => {
                      const base = parseAmount(baseStr);
                      const rate = parseAmount(m.withholdingTaxRatePercent ?? "");
                      return {
                        ...m,
                        withholdingTaxBase: baseStr,
                        withholdingAmount: String(roundMoney2((base * rate) / 100)),
                      };
                    });
                  }}
                  disabled={pending}
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-xs text-slate-600">ยอดหัก ณ ที่จ่าย</span>
                <input className={inp} value={fmt(whtAmount)} readOnly disabled />
              </label>
            </div>
          )}
        </div>
      </section>

      <section className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
            <tr>
              <th className="px-2 py-2 w-10">#</th>
              <th className="px-2 py-2">รายละเอียด</th>
              <th className="px-2 py-2 w-36">จำนวนเงิน</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, i) => (
              <tr key={i} className="border-t border-slate-100">
                <td className="px-2 py-2 text-center text-slate-500">{i + 1}</td>
                <td className="px-2 py-2">
                  <textarea
                    className={inp}
                    rows={2}
                    value={line.description}
                    onChange={(e) => {
                      const v = e.target.value;
                      setLines((prev) => {
                        const next = [...prev];
                        next[i] = { ...next[i], description: v };
                        return next;
                      });
                    }}
                    disabled={pending}
                  />
                </td>
                <td className="px-2 py-2 font-mono text-right">{fmt(parseAmount(line.amount))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="flex justify-end">
        <div className="min-w-[240px] space-y-1 rounded-md border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm">
          <div className="flex justify-between gap-6">
            <span className="text-slate-600">ยอดใบเสร็จ</span>
            <strong>{fmt(receiptTotal)}</strong>
          </div>
          {meta.withholdingEnabled && (
            <div className="flex justify-between gap-6 text-amber-900">
              <span>
                หัก ณ ที่จ่าย {meta.withholdingTaxRatePercent || 0}%
              </span>
              <strong>{fmt(whtAmount)}</strong>
            </div>
          )}
          <div className="flex justify-between gap-6 border-t border-slate-100 pt-1 text-base">
            <span className="text-slate-800">เข้าบัญชีตามจริง</span>
            <strong className="text-emerald-800">{fmt(netToAccount)}</strong>
          </div>
          <p className="pt-1 text-xs text-slate-500">
            บันทึกสมุดเงินสด (รับเข้า) ด้วยยอดสุทธิหลังหัก ณ ที่จ่าย
          </p>
        </div>
      </div>

      <textarea
        className={inp}
        rows={2}
        placeholder="หมายเหตุ"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        disabled={pending}
      />

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={assignNumber}
          onChange={(e) => setAssignNumber(e.target.checked)}
        />
        ออกเลขที่เอกสารเมื่อบันทึก
      </label>

      <div className="flex flex-wrap items-center gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
        <span className="font-medium text-slate-800">ตัวเลือกพิมพ์:</span>
        <label className="inline-flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={includeSignature}
            onChange={(e) => setIncludeSignature(e.target.checked)}
          />
          ลายเซ็น
        </label>
        <label className="inline-flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={includeStamp}
            onChange={(e) => setIncludeStamp(e.target.checked)}
          />
          ตรายาง
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => submit(assignNumber)}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {pending ? "กำลังบันทึก…" : "บันทึก"}
        </button>
        {savedId && (
          <DocumentPrintLink
            documentId={savedId}
            showOptions={false}
            includeSignature={includeSignature}
            includeStamp={includeStamp}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-800 hover:bg-slate-50"
          />
        )}
        <Link
          href="/documents/receipt"
          className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-800 hover:bg-slate-50"
        >
          ← กลับรายการ
        </Link>
      </div>
    </div>
  );
}
