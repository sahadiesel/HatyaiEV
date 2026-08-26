"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import {
  printLegalVehicleDocClient,
  printVehicleSaleLegalDocClient,
  type LegalVehiclePrintKind,
} from "@/lib/documents/legal-print-client";
import {
  deleteLegalDocClient,
  listLegalDocsClient,
} from "@/lib/legal-documents-client";
import type { LegalDocKind, LegalDocRecord } from "@/lib/domain-types";
import { formatDateThBE } from "@/lib/format-date-th";

export type LegalDocEditMode = "purchase" | "vehicle-sale" | "none";

function resolveEditHref(mode: LegalDocEditMode, row: LegalDocRecord): string | null {
  if (mode === "purchase") {
    return row.id ? `/documents/purchase-contract/new?id=${row.id}` : null;
  }
  if (mode === "vehicle-sale") {
    return row.vehicleId
      ? `/documents/vehicle-sale/new?vehicleId=${row.vehicleId}`
      : "/documents/vehicle-sale/new";
  }
  return null;
}

export function LegalDocsListClient({
  kind,
  title,
  newHref,
  emptyHint,
  editMode = "none",
  printKind,
}: {
  kind: LegalDocKind;
  title: string;
  newHref: string;
  emptyHint: string;
  /** โหมดลิงก์แก้ไข (สตริง — ส่งจาก Server Component ได้) */
  editMode?: LegalDocEditMode;
  /** พิมพ์เอกสารทางกฎหมายที่ผูกกับรถ */
  printKind?: LegalVehiclePrintKind | "vehicle-sale";
}) {
  const [rows, setRows] = useState<LegalDocRecord[]>([]);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [msgOk, setMsgOk] = useState(true);

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
      {msg && (
        <p
          className={
            msgOk
              ? "rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
              : "rounded-md bg-red-50 px-3 py-2 text-sm text-red-800"
          }
        >
          {msg}
        </p>
      )}
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="border-b bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-3 py-2">เลขที่</th>
              <th className="px-3 py-2">วันที่</th>
              <th className="px-3 py-2">จำนวนเงิน</th>
              <th className="px-3 py-2 text-right">จัดการ</th>
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
            {rows.map((r) => {
              const edit = resolveEditHref(editMode, r);
              return (
                <tr key={r.id} className="border-b border-slate-100">
                  <td className="px-3 py-2 font-mono text-xs">{r.number || "—"}</td>
                  <td className="px-3 py-2">{formatDateThBE(r.issueDate)}</td>
                  <td className="px-3 py-2">
                    {Number(r.amount || 0).toLocaleString("th-TH", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      {edit && (
                        <Link href={edit} className="text-blue-800 hover:underline">
                          แก้ไข
                        </Link>
                      )}
                      {printKind && (
                        <button
                          type="button"
                          className="text-slate-800 hover:underline disabled:opacity-50"
                          disabled={pending || !r.vehicleId}
                          title={!r.vehicleId ? "ไม่มีรถผูกกับเอกสารนี้" : "พิมพ์"}
                          onClick={() => {
                            if (!r.vehicleId) return;
                            startTransition(async () => {
                              const res =
                                printKind === "vehicle-sale"
                                  ? await printVehicleSaleLegalDocClient(r)
                                  : await printLegalVehicleDocClient(printKind, r.vehicleId!);
                              setMsgOk(res.ok);
                              setMsg(
                                res.ok
                                  ? `เปิดพิมพ์ ${r.number || ""}`
                                  : res.message,
                              );
                            });
                          }}
                        >
                          พิมพ์
                        </button>
                      )}
                      <button
                        type="button"
                        className="text-red-600 hover:underline"
                        onClick={() => {
                          if (!confirm("ลบรายการนี้?")) return;
                          startTransition(async () => {
                            const res = await deleteLegalDocClient(r.id);
                            setMsgOk(res.ok);
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
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
