"use client";

import { useAuth } from "@/components/AuthProvider";
import { printDocumentClient } from "@/lib/documents-client";
import { useEffect, useState, useTransition } from "react";

export function DocumentPrintLink({
  documentId,
  className = "text-blue-800 hover:underline",
  label = "พิมพ์",
  compact = false,
  showOptions = true,
  includeSignature: initialSig = false,
  includeStamp: initialStamp = false,
  onOptionsChange,
}: {
  documentId: string;
  className?: string;
  label?: string;
  /** โหมดสั้นในตาราง — ติ๊กเล็กข้างปุ่ม */
  compact?: boolean;
  /** แสดงติ๊กลายเซ็น/ตรายาง (ปิดได้ถ้าฟอร์มมีแล้ว) */
  showOptions?: boolean;
  includeSignature?: boolean;
  includeStamp?: boolean;
  onOptionsChange?: (opts: { includeSignature: boolean; includeStamp: boolean }) => void;
}) {
  const { profile } = useAuth();
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [includeSignature, setIncludeSignature] = useState(initialSig);
  const [includeStamp, setIncludeStamp] = useState(initialStamp);

  useEffect(() => {
    setIncludeSignature(initialSig);
  }, [initialSig]);
  useEffect(() => {
    setIncludeStamp(initialStamp);
  }, [initialStamp]);

  function setSig(v: boolean) {
    setIncludeSignature(v);
    onOptionsChange?.({ includeSignature: v, includeStamp });
  }
  function setStamp(v: boolean) {
    setIncludeStamp(v);
    onOptionsChange?.({ includeSignature, includeStamp: v });
  }

  return (
    <span className={compact ? "inline-flex flex-wrap items-center gap-x-2 gap-y-1" : "inline-flex flex-col gap-2 sm:flex-row sm:items-center"}>
      {showOptions && (
        <>
          <label className="inline-flex items-center gap-1 text-xs text-slate-700">
            <input
              type="checkbox"
              checked={includeSignature}
              onChange={(e) => setSig(e.target.checked)}
            />
            ลายเซ็น
          </label>
          <label className="inline-flex items-center gap-1 text-xs text-slate-700">
            <input
              type="checkbox"
              checked={includeStamp}
              onChange={(e) => setStamp(e.target.checked)}
            />
            ตรายาง
          </label>
        </>
      )}
      <button
        type="button"
        disabled={pending}
        className={className}
        onClick={() => {
          setErr(null);
          startTransition(async () => {
            const r = await printDocumentClient(documentId, profile?.name, {
              includeSignature,
              includeStamp,
            });
            if (!r.ok) setErr(r.message);
          });
        }}
      >
        {pending ? "…" : label}
      </button>
      {err && <span className="text-xs text-red-600">{err}</span>}
    </span>
  );
}
