"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { saveWithholdingDocument } from "@/app/documents/actions";
import { DocumentPrintLink } from "@/components/documents/DocumentPrintLink";
import { useAuth } from "@/components/AuthProvider";
import { documentPrintUrl } from "@/lib/documents/print-url";
import { calcWithholdingTotals, parseAmount } from "@/lib/documents/calc";
import { defaultWithholdingMeta, type WithholdingDocumentMeta } from "@/lib/documents/types";

const inp =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

export type ContractorOption = {
  id: string;
  name: string;
  taxId: string;
  address: string;
  defaultWhtPercent: string;
};

const WHT_RATES = ["1", "2", "3", "5"] as const;

export function WithholdingDocumentForm({
  contractors,
  initial,
}: {
  contractors: ContractorOption[];
  initial?: {
    id: string;
    number: string;
    issueDate: string;
    contractorId: string | null;
    meta: WithholdingDocumentMeta;
    notes: string;
    subtotal: number;
    withholdingAmount: number;
  };
}) {
  const { profile } = useAuth();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [meta, setMeta] = useState<WithholdingDocumentMeta>(initial?.meta ?? defaultWithholdingMeta());
  const [contractorId, setContractorId] = useState(initial?.contractorId ?? "");
  const [issueDate, setIssueDate] = useState(
    initial?.issueDate ?? new Date().toISOString().slice(0, 10),
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [assignNumber, setAssignNumber] = useState(!initial?.id);

  const totals = useMemo(() => {
    const base = parseAmount(meta.withholdingTaxBase);
    const whtRate = parseAmount(meta.withholdingTaxRatePercent);
    return calcWithholdingTotals({ base, vatRatePercent: 7, whtRatePercent: whtRate });
  }, [meta.withholdingTaxBase, meta.withholdingTaxRatePercent]);

  function onContractorChange(id: string) {
    setContractorId(id);
    const c = contractors.find((x) => x.id === id);
    if (!c) return;
    setMeta((m) => ({
      ...m,
      payeeName: c.name,
      payeeTaxId: c.taxId,
      payeeAddress: c.address,
      withholdingTaxRatePercent: c.defaultWhtPercent || "3",
    }));
  }

  async function submit() {
    setMsg(null);
    const fd = new FormData();
    if (initial?.id) fd.set("id", initial.id);
    fd.set("contractorId", contractorId);
    fd.set("issueDate", issueDate);
    fd.set("notes", notes);
    fd.set("metaJson", JSON.stringify(meta));
    fd.set("assignNumber", assignNumber ? "1" : "0");
    fd.set("issuedByName", profile?.name?.trim() ?? "");

    startTransition(async () => {
      const r = await saveWithholdingDocument(fd);
      if (!r.ok) {
        setMsg(r.message ?? "บันทึกไม่สำเร็จ");
        return;
      }
      const docId = r.id;
      if (assignNumber && docId) {
        window.open(documentPrintUrl(docId, profile?.name), "_blank", "noopener");
      }
      router.push(`/documents/withholding/${docId}`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-900">
          {initial?.id ? "แก้ไข" : "สร้าง"} หนังสือรับรองหัก ณ ที่จ่าย
        </h2>
        {initial?.number && (
          <span className="font-mono text-sm text-slate-600">เลขที่ {initial.number}</span>
        )}
      </div>
      <p className="text-sm text-slate-600">
        บริษัทเป็นผู้หักภาษี ณ ที่จ่าย · ผู้รับเหมาเป็นผู้ถูกหัก (แนว ม.50 ทวิ)
      </p>
      {msg && <p className="text-sm text-red-700">{msg}</p>}

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-slate-600">ผู้รับเหมา (ผู้ถูกหัก)</label>
            <select
              className={inp}
              value={contractorId}
              onChange={(e) => onContractorChange(e.target.value)}
              disabled={pending}
            >
              <option value="">— เลือกผู้รับเหมา —</option>
              {contractors.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-600">วันที่ออกหนังสือ</label>
            <input
              type="date"
              className={inp}
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
              disabled={pending}
            />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            className={inp}
            placeholder="ชื่อผู้ถูกหัก"
            value={meta.payeeName}
            onChange={(e) => setMeta((m) => ({ ...m, payeeName: e.target.value }))}
            disabled={pending}
          />
          <input
            className={inp}
            placeholder="เลขประจำตัวผู้เสียภาษี"
            value={meta.payeeTaxId}
            onChange={(e) => setMeta((m) => ({ ...m, payeeTaxId: e.target.value }))}
            disabled={pending}
          />
        </div>
        <textarea
          className={inp}
          rows={2}
          placeholder="ที่อยู่ผู้ถูกหัก"
          value={meta.payeeAddress}
          onChange={(e) => setMeta((m) => ({ ...m, payeeAddress: e.target.value }))}
          disabled={pending}
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={meta.payeeBranchHeadOffice}
            onChange={(e) => setMeta((m) => ({ ...m, payeeBranchHeadOffice: e.target.checked }))}
          />
          สำนักงานใหญ่
        </label>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <h3 className="font-medium text-slate-900">รายการเงินได้</h3>
        <input
          className={inp}
          placeholder="ประเภทเงินได้ เช่น ค่าจ้างทำของ / ค่าบริการ"
          value={meta.incomeTypeLabel}
          onChange={(e) => setMeta((m) => ({ ...m, incomeTypeLabel: e.target.value }))}
          disabled={pending}
        />
        <textarea
          className={inp}
          rows={2}
          placeholder="รายละเอียดงาน / อ้างอิงสัญญา"
          value={meta.jobDescription}
          onChange={(e) => setMeta((m) => ({ ...m, jobDescription: e.target.value }))}
          disabled={pending}
        />
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs text-slate-600">มูลค่าก่อน VAT (ฐานหัก)</label>
            <input
              className={inp}
              value={meta.withholdingTaxBase}
              onChange={(e) => setMeta((m) => ({ ...m, withholdingTaxBase: e.target.value }))}
              disabled={pending}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-600">อัตราหัก ณ ที่จ่าย (%)</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {WHT_RATES.map((r) => (
                <button
                  key={r}
                  type="button"
                  className={`rounded px-2 py-1 text-xs border ${
                    meta.withholdingTaxRatePercent === r
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-300 text-slate-700"
                  }`}
                  onClick={() => setMeta((m) => ({ ...m, withholdingTaxRatePercent: r }))}
                >
                  {r}%
                </button>
              ))}
            </div>
            <input
              className={inp}
              value={meta.withholdingTaxRatePercent}
              onChange={(e) =>
                setMeta((m) => ({ ...m, withholdingTaxRatePercent: e.target.value }))
              }
              disabled={pending}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-600">วันที่จ่ายเงิน</label>
            <input
              type="date"
              className={inp}
              value={meta.paymentDate?.slice(0, 10) ?? ""}
              onChange={(e) => setMeta((m) => ({ ...m, paymentDate: e.target.value }))}
              disabled={pending}
            />
          </div>
        </div>
        <input
          className={inp}
          placeholder="อ้างอิงเลขที่ใบแจ้งหนี้ / ใบสั่งจ้าง"
          value={meta.referenceNo}
          onChange={(e) => setMeta((m) => ({ ...m, referenceNo: e.target.value }))}
          disabled={pending}
        />
        <div className="rounded-md bg-slate-50 p-3 text-sm space-y-1">
          <div>VAT 7%: {totals.vatAmount.toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท</div>
          <div>จำนวนเงินที่จ่าย: {totals.totalAmount.toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท</div>
          <div className="font-semibold text-slate-900">
            หัก ณ ที่จ่าย: {totals.withholdingAmount.toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท
          </div>
          <div>
            เงินสุทธิ:{" "}
            {(totals.totalAmount - totals.withholdingAmount).toLocaleString("th-TH", {
              minimumFractionDigits: 2,
            })}{" "}
            บาท
          </div>
        </div>
      </section>

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

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={submit}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {pending ? "กำลังบันทึก…" : "บันทึก"}
        </button>
        {initial?.id && (
          <DocumentPrintLink
            documentId={initial.id}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-800 hover:bg-slate-50"
          />
        )}
        <Link
          href="/documents/withholding"
          className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-800 hover:bg-slate-50"
        >
          ← กลับรายการ
        </Link>
      </div>
    </div>
  );
}
