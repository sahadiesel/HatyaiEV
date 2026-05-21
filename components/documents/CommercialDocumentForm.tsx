"use client";

import type { DocumentKind } from "@/lib/documents-firestore-types";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { saveCommercialDocument } from "@/app/documents/actions";
import { DocumentPrintLink } from "@/components/documents/DocumentPrintLink";
import { useAuth } from "@/components/AuthProvider";
import { documentPrintUrl } from "@/lib/documents/print-url";
import { calcCommercialTotals, parseAmount, recalcLineAmount } from "@/lib/documents/calc";
import {
  defaultCommercialMeta,
  DOCUMENT_KIND_ROUTES,
  emptyLine,
  type CommercialDocumentMeta,
  type DocumentLineItem,
} from "@/lib/documents/types";

const inp =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

export type ClientOption = { id: string; name: string; taxId: string; address: string; phone: string };

export function CommercialDocumentForm({
  kind,
  listHref,
  clients,
  initial,
}: {
  kind: DocumentKind;
  listHref: string;
  clients: ClientOption[];
  initial?: {
    id: string;
    number: string;
    issueDate: string;
    clientId: string | null;
    lines: DocumentLineItem[];
    meta: CommercialDocumentMeta;
    notes: string;
  };
}) {
  const route = DOCUMENT_KIND_ROUTES[kind];
  const { profile } = useAuth();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [lines, setLines] = useState<DocumentLineItem[]>(
    initial?.lines?.length ? initial.lines : [emptyLine(1), emptyLine(2), emptyLine(3)],
  );
  const [meta, setMeta] = useState<CommercialDocumentMeta>(initial?.meta ?? defaultCommercialMeta());
  const [clientId, setClientId] = useState(initial?.clientId ?? "");
  const [issueDate, setIssueDate] = useState(
    initial?.issueDate ?? new Date().toISOString().slice(0, 10),
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [assignNumber, setAssignNumber] = useState(!initial?.id);

  const totals = useMemo(
    () => calcCommercialTotals(lines, meta.vatRatePercent ?? 7),
    [lines, meta.vatRatePercent],
  );

  function onClientChange(id: string) {
    setClientId(id);
    const c = clients.find((x) => x.id === id);
    if (!c) return;
    setMeta((m) => ({
      ...m,
      counterpartyName: c.name,
      counterpartyTaxId: c.taxId,
      counterpartyAddress: c.address,
      counterpartyPhone: c.phone,
    }));
  }

  function updateLine(i: number, patch: Partial<DocumentLineItem>) {
    setLines((prev) => {
      const next = [...prev];
      next[i] = recalcLineAmount({ ...next[i], ...patch });
      return next;
    });
  }

  function addLine() {
    setLines((prev) => [...prev, emptyLine(prev.length + 1)]);
  }

  function removeLine(i: number) {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((_, idx) => idx !== i)));
  }

  async function submit(assign: boolean) {
    setMsg(null);
    const fd = new FormData();
    fd.set("kind", kind);
    if (initial?.id) fd.set("id", initial.id);
    fd.set("clientId", clientId);
    fd.set("issueDate", issueDate);
    fd.set("notes", notes);
    fd.set("linesJson", JSON.stringify(lines));
    fd.set("metaJson", JSON.stringify(meta));
    fd.set("assignNumber", assign ? "1" : "0");
    fd.set("issuedByName", profile?.name?.trim() ?? "");

    startTransition(async () => {
      const r = await saveCommercialDocument(fd);
      if (!r.ok) {
        setMsg(r.message ?? "บันทึกไม่สำเร็จ");
        return;
      }
      const docId = r.id;
      if (assign && docId) {
        window.open(documentPrintUrl(docId, profile?.name), "_blank", "noopener");
      }
      router.push(`${listHref}/${docId}`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-900">
          {initial?.id ? "แก้ไข" : "สร้าง"}
          {route.titleTh}
        </h2>
        {initial?.number && (
          <span className="font-mono text-sm text-slate-600">เลขที่ {initial.number}</span>
        )}
      </div>
      {msg && <p className="text-sm text-red-700">{msg}</p>}

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs text-slate-600">ลูกค้า (ผู้ว่าจ้าง)</label>
            <select
              className={inp}
              value={clientId}
              onChange={(e) => onClientChange(e.target.value)}
              disabled={pending}
            >
              <option value="">— เลือกลูกค้า —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-600">วันที่</label>
            <input
              type="date"
              className={inp}
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
              disabled={pending}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-600">VAT (%)</label>
            <input
              type="number"
              className={inp}
              value={meta.vatRatePercent ?? 7}
              onChange={(e) =>
                setMeta((m) => ({ ...m, vatRatePercent: parseFloat(e.target.value) || 7 }))
              }
              disabled={pending}
            />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            className={inp}
            placeholder="ชื่อลูกค้า"
            value={meta.counterpartyName}
            onChange={(e) => setMeta((m) => ({ ...m, counterpartyName: e.target.value }))}
            disabled={pending}
          />
          <input
            className={inp}
            placeholder="เลขประจำตัวผู้เสียภาษี"
            value={meta.counterpartyTaxId}
            onChange={(e) => setMeta((m) => ({ ...m, counterpartyTaxId: e.target.value }))}
            disabled={pending}
          />
          <input
            className={inp}
            placeholder="เบอร์ติดต่อ"
            value={meta.counterpartyPhone}
            onChange={(e) => setMeta((m) => ({ ...m, counterpartyPhone: e.target.value }))}
            disabled={pending}
          />
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={meta.counterpartyBranchHeadOffice}
              onChange={(e) =>
                setMeta((m) => ({ ...m, counterpartyBranchHeadOffice: e.target.checked }))
              }
            />
            สำนักงานใหญ่
          </label>
        </div>
        <textarea
          className={inp}
          rows={2}
          placeholder="ที่อยู่ลูกค้า"
          value={meta.counterpartyAddress}
          onChange={(e) => setMeta((m) => ({ ...m, counterpartyAddress: e.target.value }))}
          disabled={pending}
        />
        {kind === "INVOICE" && (
          <textarea
            className={inp}
            rows={2}
            placeholder="ข้อความโอนเงิน"
            value={meta.bankAccountText ?? ""}
            onChange={(e) => setMeta((m) => ({ ...m, bankAccountText: e.target.value }))}
            disabled={pending}
          />
        )}
        {kind === "RECEIPT" && (
          <div className="flex flex-wrap gap-4 text-sm">
            {(["CASH", "TRANSFER", "CHEQUE"] as const).map((pm) => (
              <label key={pm} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="paymentMethod"
                  checked={(meta.paymentMethod ?? "TRANSFER") === pm}
                  onChange={() => setMeta((m) => ({ ...m, paymentMethod: pm }))}
                />
                {pm === "CASH" ? "เงินสด" : pm === "TRANSFER" ? "โอน ธนาคาร" : "เช็ค"}
              </label>
            ))}
          </div>
        )}
      </section>

      <section className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[800px] text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
            <tr>
              <th className="px-2 py-2 w-10">#</th>
              <th className="px-2 py-2 w-20">รหัส</th>
              <th className="px-2 py-2">รายละเอียด</th>
              <th className="px-2 py-2 w-28">ราคา/หน่วย</th>
              <th className="px-2 py-2 w-16">จำนวน</th>
              <th className="px-2 py-2 w-28">ราคารวม</th>
              <th className="px-2 py-2 w-10" />
            </tr>
          </thead>
          <tbody>
            {lines.map((line, i) => (
              <tr key={i} className="border-t border-slate-100">
                <td className="px-2 py-1 text-center text-slate-500">{i + 1}</td>
                <td className="px-2 py-1">
                  <input
                    className={inp}
                    value={line.code}
                    onChange={(e) => updateLine(i, { code: e.target.value })}
                    disabled={pending}
                  />
                </td>
                <td className="px-2 py-1">
                  <textarea
                    className={inp}
                    rows={2}
                    value={line.description}
                    onChange={(e) => updateLine(i, { description: e.target.value })}
                    disabled={pending}
                  />
                </td>
                <td className="px-2 py-1">
                  <input
                    className={inp}
                    value={line.unitPrice}
                    onChange={(e) => updateLine(i, { unitPrice: e.target.value })}
                    disabled={pending}
                  />
                </td>
                <td className="px-2 py-1">
                  <input
                    className={inp}
                    value={line.quantity}
                    onChange={(e) => updateLine(i, { quantity: e.target.value })}
                    disabled={pending}
                  />
                </td>
                <td className="px-2 py-1 font-mono text-right">{line.amount}</td>
                <td className="px-2 py-1">
                  <button
                    type="button"
                    className="text-red-600 text-xs hover:underline"
                    onClick={() => removeLine(i)}
                    disabled={pending}
                  >
                    ลบ
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="border-t border-slate-100 p-2">
          <button
            type="button"
            onClick={addLine}
            className="text-sm text-blue-800 hover:underline"
            disabled={pending}
          >
            + เพิ่มรายการ
          </button>
        </div>
      </section>

      <div className="flex justify-end gap-6 text-sm">
        <div className="text-right space-y-1">
          <div>รวมก่อน VAT: <strong>{totals.subtotal.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</strong></div>
          <div>VAT: <strong>{totals.vatAmount.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</strong></div>
          <div className="text-base">รวมทั้งสิ้น: <strong>{totals.totalAmount.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</strong></div>
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

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={assignNumber}
            onChange={(e) => setAssignNumber(e.target.checked)}
          />
          ออกเลขที่เอกสารเมื่อบันทึก
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
        {initial?.id && (
          <DocumentPrintLink
            documentId={initial.id}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-800 hover:bg-slate-50"
          />
        )}
        <Link href={listHref} className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-800 hover:bg-slate-50">
          ← กลับรายการ
        </Link>
      </div>
    </div>
  );
}
