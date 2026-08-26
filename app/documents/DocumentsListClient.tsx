"use client";

import type { DocumentKind } from "@/lib/documents-firestore-types";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useAuth } from "@/components/AuthProvider";
import { listDocumentsClient, printDocumentClient } from "@/lib/documents-client";
import type { DocumentListItem } from "@/lib/documents-firestore-types";
import type { HyevWhtCopyVariant } from "@/lib/documents/print-html";
import { DOCUMENT_KIND_ROUTES } from "@/lib/documents/types";
import { formatDateThBE } from "@/lib/format-date-th";

const kindLabel: Record<DocumentKind, string> = {
  INVOICE: "ใบแจ้งหนี้",
  TAX_INVOICE: "ใบกำกับภาษี",
  RECEIPT: "ใบเสร็จรับเงิน",
  PURCHASE_ORDER: "ใบสั่งจ้าง",
  WITHHOLDING_TAX: "หัก ณ ที่จ่าย",
  PAYMENT_VOUCHER: "ใบสำคัญจ่าย",
};

function fmtMoney(n: number | string): string {
  return Number(n).toLocaleString("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function partyLabel(d: DocumentListItem): string {
  if (d.clientName) return d.clientName;
  if (d.contractorName) return d.contractorName;
  return "—";
}

const actionBtn =
  "inline-flex items-center justify-center rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50";

const WHT_COPY_OPTIONS: { id: HyevWhtCopyVariant; label: string }[] = [
  { id: "COPY_PAYEE_TAX_RETURN", label: "ฉบับที่ 1 ผู้ถูกหัก (แนบภาษี)" },
  { id: "COPY_PAYEE_RECORD", label: "ฉบับที่ 2 ผู้ถูกหัก (เก็บหลักฐาน)" },
  { id: "COPY_PAYER_RECORD", label: "สำเนาผู้หัก" },
];

function RowActions({
  documentId,
  editHref,
  kind,
}: {
  documentId: string;
  editHref: string;
  kind: DocumentKind;
}) {
  const { profile } = useAuth();
  const [pending, startTransition] = useTransition();
  const [includeSignature, setIncludeSignature] = useState(true);
  const [includeStamp, setIncludeStamp] = useState(true);
  const [whtCopies, setWhtCopies] = useState<HyevWhtCopyVariant[]>([
    "COPY_PAYEE_TAX_RETURN",
    "COPY_PAYEE_RECORD",
    "COPY_PAYER_RECORD",
  ]);
  const [err, setErr] = useState<string | null>(null);
  const isWht = kind === "WITHHOLDING_TAX";

  function toggleWhtCopy(id: HyevWhtCopyVariant, on: boolean) {
    setWhtCopies((prev) => {
      if (on) return prev.includes(id) ? prev : [...prev, id];
      return prev.filter((x) => x !== id);
    });
  }

  function runPrint(preview: boolean) {
    setErr(null);
    startTransition(async () => {
      const orderedCopies = isWht
        ? WHT_COPY_OPTIONS.map((o) => o.id).filter((id) => whtCopies.includes(id))
        : undefined;
      if (isWht && (!orderedCopies || orderedCopies.length === 0)) {
        setErr("เลือกอย่างน้อย 1 ฉบับ");
        return;
      }
      const r = await printDocumentClient(documentId, profile?.name, {
        includeSignature,
        includeStamp,
        preview,
        whtCopies: orderedCopies,
      });
      if (!r.ok) setErr(r.message);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap items-center justify-end gap-1">
        <button type="button" disabled={pending} className={actionBtn} onClick={() => runPrint(true)}>
          {pending ? "…" : "ดู"}
        </button>
        <Link href={editHref} className={actionBtn}>
          แก้ไข
        </Link>
        <button type="button" disabled={pending} className={actionBtn} onClick={() => runPrint(false)}>
          {pending ? "…" : "พิมพ์"}
        </button>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2 text-[10px] leading-none text-slate-600">
        <label className="inline-flex items-center gap-0.5">
          <input
            type="checkbox"
            className="h-3 w-3"
            checked={includeSignature}
            onChange={(e) => setIncludeSignature(e.target.checked)}
          />
          ลายเซ็น
        </label>
        <label className="inline-flex items-center gap-0.5">
          <input
            type="checkbox"
            className="h-3 w-3"
            checked={includeStamp}
            onChange={(e) => setIncludeStamp(e.target.checked)}
          />
          ตรายาง
        </label>
      </div>
      {isWht && (
        <div className="flex max-w-[220px] flex-col items-end gap-0.5 text-[10px] leading-tight text-slate-600">
          {WHT_COPY_OPTIONS.map((opt) => (
            <label key={opt.id} className="inline-flex items-center gap-0.5">
              <input
                type="checkbox"
                className="h-3 w-3"
                checked={whtCopies.includes(opt.id)}
                onChange={(e) => toggleWhtCopy(opt.id, e.target.checked)}
              />
              {opt.label}
            </label>
          ))}
        </div>
      )}
      {err && <span className="text-[10px] text-red-600">{err}</span>}
    </div>
  );
}

export function DocumentsListClient({ kind }: { kind: DocumentKind }) {
  const slug = DOCUMENT_KIND_ROUTES[kind].slug;
  const [rows, setRows] = useState<DocumentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const showReceiptCol = kind === "TAX_INVOICE";
  const colSpan = showReceiptCol ? 9 : 8;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void listDocumentsClient(kind).then((data) => {
      if (!cancelled) {
        setRows(data);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [kind]);

  return (
    <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <table className="w-full table-fixed text-left text-sm">
        <colgroup>
          <col className="w-[10%]" />
          <col className="w-[9%]" />
          <col className="w-[10%]" />
          <col className="w-[8%]" />
          <col className="w-[10%]" />
          <col className="w-[9%]" />
          <col className={showReceiptCol ? "w-[14%]" : "w-[22%]"} />
          {showReceiptCol && <col className="w-[12%]" />}
          <col className="w-[18%]" />
        </colgroup>
        <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
          <tr>
            <th className="px-2 py-2 text-xs font-medium">เลขที่</th>
            <th className="px-2 py-2 text-xs font-medium">วันที่</th>
            <th className="px-2 py-2 text-right text-xs font-medium">ก่อน VAT</th>
            <th className="px-2 py-2 text-right text-xs font-medium">VAT</th>
            <th className="px-2 py-2 text-right text-xs font-medium">รวม</th>
            <th className="px-2 py-2 text-right text-xs font-medium">หัก ณ ที่จ่าย</th>
            <th className="px-2 py-2 text-xs font-medium">คู่สัญญา</th>
            {showReceiptCol && (
              <th className="px-2 py-2 text-xs font-medium">ใบเสร็จรับเงิน</th>
            )}
            <th className="px-2 py-2 text-right text-xs font-medium">จัดการ</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {loading ? (
            <tr>
              <td colSpan={colSpan} className="px-3 py-8 text-center text-slate-500">
                กำลังโหลด…
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={colSpan} className="px-3 py-8 text-center text-slate-500">
                ยังไม่มี{kindLabel[kind]}ในระบบ — กด <strong>สร้างเอกสาร</strong> เพื่อเพิ่มรายการ
              </td>
            </tr>
          ) : (
            rows.map((d) => (
              <tr key={d.id} className="hover:bg-slate-50/80">
                <td className="truncate px-2 py-2 font-mono text-xs text-slate-900" title={d.number || ""}>
                  {d.number || "—"}
                </td>
                <td className="whitespace-nowrap px-2 py-2 text-xs text-slate-700">
                  {formatDateThBE(d.issueDate)}
                </td>
                <td className="px-2 py-2 text-right text-xs tabular-nums text-slate-800">
                  {fmtMoney(d.subtotal)}
                </td>
                <td className="px-2 py-2 text-right text-xs tabular-nums text-slate-800">
                  {fmtMoney(d.vatAmount)}
                </td>
                <td className="px-2 py-2 text-right text-xs font-medium tabular-nums text-slate-900">
                  {fmtMoney(d.totalAmount)}
                </td>
                <td className="px-2 py-2 text-right text-xs tabular-nums text-slate-800">
                  {fmtMoney(d.withholdingAmount)}
                </td>
                <td className="truncate px-2 py-2 text-xs text-slate-700" title={partyLabel(d)}>
                  {partyLabel(d)}
                </td>
                {showReceiptCol && (
                  <td className="truncate px-2 py-2 font-mono text-xs text-slate-800">
                    {d.receiptId && d.receiptNumber ? (
                      <Link
                        href={`/documents/receipt/${d.receiptId}`}
                        className="text-blue-800 hover:underline"
                        title={d.receiptNumber}
                      >
                        {d.receiptNumber}
                      </Link>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                )}
                <td className="px-2 py-2 align-middle">
                  <RowActions documentId={d.id} editHref={`/documents/${slug}/${d.id}`} kind={kind} />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
