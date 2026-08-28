"use client";

import type { DocumentKind } from "@/lib/documents-firestore-types";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { DocumentPrintLink } from "@/components/documents/DocumentPrintLink";
import { useAuth } from "@/components/AuthProvider";
import { calcCommercialTotals, calcVehicleSaleVatTotals, parseAmount, recalcLineAmount } from "@/lib/documents/calc";
import {
  getDocumentClient,
  printDocumentClient,
  saveCommercialDocumentClient,
  toCommercialFormInitial,
} from "@/lib/documents-client";
import { listEntitiesClient } from "@/lib/entities-client";
import { entityHasRoleGroup } from "@/lib/entity-roles";
import {
  defaultCommercialMeta,
  DOCUMENT_KIND_ROUTES,
  emptyLine,
  type CommercialDocumentMeta,
  type DocumentLineItem,
} from "@/lib/documents/types";

const inp =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

export type ClientOption = {
  id: string;
  name: string;
  taxId: string;
  address: string;
  phone: string;
  branchHeadOffice?: boolean;
  branchNo?: string;
};

function toClientOption(e: {
  id: string;
  name: string;
  taxId: string;
  address: string;
  phone: string;
  branchHeadOffice?: boolean;
  branchNo?: string;
}): ClientOption {
  return {
    id: e.id,
    name: e.name,
    taxId: e.taxId,
    address: e.address,
    phone: e.phone,
    branchHeadOffice: e.branchHeadOffice !== false,
    branchNo: e.branchNo ?? "",
  };
}

export function CommercialDocumentForm({
  kind,
  listHref,
  clients,
  initial,
  documentId,
}: {
  kind: DocumentKind;
  listHref: string;
  clients: ClientOption[];
  documentId?: string;
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
  const [loadingDoc, setLoadingDoc] = useState(Boolean(documentId && !initial));
  const [saved, setSaved] = useState(initial ?? null);
  const [clientOptions, setClientOptions] = useState<ClientOption[]>(clients);
  const [lines, setLines] = useState<DocumentLineItem[]>(
    initial?.lines?.length ? initial.lines : [emptyLine(1), emptyLine(2), emptyLine(3)],
  );
  const [meta, setMeta] = useState<CommercialDocumentMeta>(initial?.meta ?? defaultCommercialMeta());
  const [clientId, setClientId] = useState(initial?.clientId ?? "");
  const [issueDate, setIssueDate] = useState(
    initial?.issueDate ?? new Date().toISOString().slice(0, 10),
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [assignNumber, setAssignNumber] = useState(!initial?.id && !documentId);
  const [includeSignature, setIncludeSignature] = useState(false);
  const [includeStamp, setIncludeStamp] = useState(false);

  useEffect(() => {
    void listEntitiesClient().then((ents) => {
      const fromEntities = ents
        .filter(
          (e) =>
            entityHasRoleGroup(e.roles, "CUSTOMER_BUYER") || entityHasRoleGroup(e.roles, "HIRER"),
        )
        .map(toClientOption)
        .sort((a, b) => a.name.localeCompare(b.name, "th"));
      if (fromEntities.length > 0) {
        setClientOptions(fromEntities);
        return;
      }
      if (clients.length > 0) setClientOptions(clients);
    });
  }, [clients]);

  useEffect(() => {
    if (!documentId || initial) return;
    let cancelled = false;
    setLoadingDoc(true);
    void getDocumentClient(documentId).then((row) => {
      if (cancelled) return;
      if (!row || row.kind !== kind) {
        setMsg("ไม่พบเอกสาร");
        setLoadingDoc(false);
        return;
      }
      const data = toCommercialFormInitial(row);
      setSaved(data);
      setLines(data.lines.length ? data.lines : [emptyLine(1)]);
      setMeta(data.meta);
      setClientId(data.clientId ?? "");
      setIssueDate(data.issueDate);
      setNotes(data.notes);
      setAssignNumber(!data.number);
      setLoadingDoc(false);
    });
    return () => {
      cancelled = true;
    };
  }, [documentId, initial, kind]);

  const isVehicleVatScheme = meta.vatScheme === "MARGIN" || meta.vatScheme === "FULL_SALE";

  const totals = useMemo(() => {
    const scheme = meta.vatScheme;
    if (scheme === "MARGIN" || scheme === "FULL_SALE") {
      // บรรทัด = ยอดขายรวม VAT (ราคารวม)
      const salePriceInclusive = lines.reduce((s, l) => s + parseAmount(l.amount), 0);
      const purchaseType =
        meta.purchaseType ?? (scheme === "MARGIN" ? "INDIVIDUAL_NO_VAT" : "COMPANY_VAT_7");
      const r = calcVehicleSaleVatTotals({
        purchaseType,
        salePriceInclusive,
        totalCost: meta.totalCostSnapshot ?? 0,
        vatRatePercent: meta.vatRatePercent ?? 7,
      });
      return { subtotal: r.subtotal, vatAmount: r.vatAmount, totalAmount: r.totalAmount };
    }
    return calcCommercialTotals(lines, meta.vatRatePercent ?? 7);
  }, [lines, meta]);

  function onClientChange(id: string) {
    setClientId(id);
    const c = clientOptions.find((x) => x.id === id);
    if (!c) return;
    setMeta((m) => ({
      ...m,
      counterpartyName: c.name,
      counterpartyTaxId: c.taxId,
      counterpartyAddress: c.address,
      counterpartyPhone: c.phone,
      counterpartyBranchHeadOffice: c.branchHeadOffice !== false,
      counterpartyBranchNo: c.branchNo ?? "",
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
    startTransition(async () => {
      const r = await saveCommercialDocumentClient({
        id: saved?.id || documentId || null,
        kind,
        clientId: clientId || null,
        issueDate,
        notes,
        linesJson: JSON.stringify(lines),
        metaJson: JSON.stringify(meta),
        assignNumber: assign,
        issuedByName: profile?.name?.trim() ?? "",
      });
      if (!r.ok) {
        setMsg(r.message ?? "บันทึกไม่สำเร็จ");
        return;
      }
      const docId = r.id;
      if (assign && docId) {
        await printDocumentClient(docId, profile?.name, {
          includeSignature,
          includeStamp,
        });
      }
      router.push(listHref);
      router.refresh();
    });
  }

  if (loadingDoc) {
    return <p className="text-sm text-slate-500">กำลังโหลดเอกสาร…</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-900">
          {saved?.id || documentId ? "แก้ไข" : "สร้าง"}
          {route.titleTh}
        </h2>
        {saved?.number && (
          <span className="font-mono text-sm text-slate-600">เลขที่ {saved.number}</span>
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
              {clientOptions.map((c) => (
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
          {isVehicleVatScheme && (
            <p className="mb-2 max-w-sm text-left text-xs text-amber-800">
              {`VAT จากยอดขายเต็ม × 7/107 (ออกใบกำกับบริษัท) · ต้นทุนอ้างอิง ฿${(meta.totalCostSnapshot ?? 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}`}
              {" · "}ยอดในบรรทัด = ราคารวม VAT
            </p>
          )}
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
        <span className="text-xs text-slate-500">ติ๊กเฉพาะรายการที่ต้องการใส่ตอนพิมพ์</span>
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
        {(saved?.id || documentId) && (
          <DocumentPrintLink
            documentId={saved?.id || documentId!}
            showOptions={false}
            includeSignature={includeSignature}
            includeStamp={includeStamp}
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
