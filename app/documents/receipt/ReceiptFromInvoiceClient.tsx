"use client";

import { useEffect, useState } from "react";
import {
  CommercialDocumentForm,
  type ClientOption,
} from "@/components/documents/CommercialDocumentForm";
import { buildReceiptInitialFromTaxInvoice } from "@/lib/vehicles/document-pack";
import {
  defaultCommercialMeta,
  emptyLine,
  type CommercialDocumentMeta,
  type DocumentLineItem,
} from "@/lib/documents/types";

type Initial = {
  id: string;
  number: string;
  issueDate: string;
  clientId: string | null;
  lines: DocumentLineItem[];
  meta: CommercialDocumentMeta;
  notes: string;
};

export function ReceiptFromInvoiceClient({
  clients,
  taxInvoiceId,
  vehicleId,
}: {
  clients: ClientOption[];
  taxInvoiceId?: string;
  vehicleId?: string;
}) {
  const [initial, setInitial] = useState<Initial | undefined>(undefined);
  const [loading, setLoading] = useState(Boolean(taxInvoiceId));
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!taxInvoiceId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void buildReceiptInitialFromTaxInvoice(taxInvoiceId).then((res) => {
      if (cancelled) return;
      if (!res.ok) {
        setMsg(res.message);
        setLoading(false);
        return;
      }
      const lines = Array.isArray(res.initial.lines)
        ? (res.initial.lines as DocumentLineItem[])
        : [{ ...emptyLine(1) }];
      setInitial({
        ...res.initial,
        lines: lines.length ? lines : [{ ...emptyLine(1) }],
        meta: {
          ...defaultCommercialMeta(),
          ...res.initial.meta,
          vehicleId: res.initial.meta.vehicleId || vehicleId,
        },
      });
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [taxInvoiceId, vehicleId]);

  if (loading) {
    return <p className="text-sm text-slate-500">กำลังโหลดใบกำกับภาษี…</p>;
  }

  return (
    <div className="space-y-3">
      {msg && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{msg}</p>
      )}
      {taxInvoiceId && initial && (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          สร้างใบเสร็จอ้างอิงใบกำกับภาษี{" "}
          <strong>{initial.meta.taxInvoiceNumber || taxInvoiceId}</strong>
          {initial.meta.vehicleLabel ? ` · รถ ${initial.meta.vehicleLabel}` : ""} — บันทึกแล้วจะลงสมุดเงินสด
          (รับเข้า) อัตโนมัติ
        </p>
      )}
      <CommercialDocumentForm
        kind="RECEIPT"
        listHref="/documents/receipt"
        clients={clients}
        initial={initial}
      />
    </div>
  );
}
