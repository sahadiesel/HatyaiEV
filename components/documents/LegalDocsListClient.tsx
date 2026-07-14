"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import {
  deleteLegalDocClient,
  listLegalDocsClient,
} from "@/lib/legal-documents-client";
import type { LegalDocKind, LegalDocRecord } from "@/lib/domain-types";

export function LegalDocsListClient({
  kind,
  title,
  newHref,
  emptyHint,
}: {
  kind: LegalDocKind;
  title: string;
  newHref: string;
  emptyHint: string;
}) {
  const [rows, setRows] = useState<LegalDocRecord[]>([]);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function reload() {
    startTransition(async () => {
      setRows(await listLegalDocsClient(kind));
    });
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <Link
          href={newHref}
          className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          + สร้างสัญญา
        </Link>
      </div>
      {msg && <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{msg}</p>}
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="border-b bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-3 py-2">เลขที่</th>
              <th className="px-3 py-2">วันที่</th>
              <th className="px-3 py-2">จำนวนเงิน</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-10 text-center text-slate-500">
                  {pending ? "กำลังโหลด…" : emptyHint}
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-slate-100">
                <td className="px-3 py-2 font-mono text-xs">{r.number || "—"}</td>
                <td className="px-3 py-2">{r.issueDate || "—"}</td>
                <td className="px-3 py-2">
                  {Number(r.amount || 0).toLocaleString("th-TH", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    className="text-red-600 hover:underline"
                    onClick={() => {
                      if (!confirm("ลบรายการนี้?")) return;
                      startTransition(async () => {
                        const res = await deleteLegalDocClient(r.id);
                        if (!res.ok) {
                          setMsg(res.message);
                          return;
                        }
                        setMsg("ลบแล้ว");
                        setRows(await listLegalDocsClient(kind));
                      });
                    }}
                  >
                    ลบ
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
