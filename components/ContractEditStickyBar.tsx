"use client";

import Link from "next/link";

type Props = {
  backHref: string;
  backLabel: string;
  title: React.ReactNode;
  formId: string;
  pending?: boolean;
  message?: string | null;
  error?: string | null;
  /** ช่องค้นหา / ปุ่มเสริม ระหว่างหัวข้อกับปุ่มบันทึก */
  toolbar?: React.ReactNode;
};

/** แถบหัวแก้ไขสัญญา — ติดใต้ header เอกสารสัญญา (sticky) */
export function ContractEditStickyBar({
  backHref,
  backLabel,
  title,
  formId,
  pending,
  message,
  error,
  toolbar,
}: Props) {
  return (
    <div className="sticky top-[8.75rem] z-20 -mx-6 mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/95 px-6 py-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-slate-50/80">
      <div className="min-w-0 flex-1">
        <p className="text-sm text-slate-600">
          <Link href={backHref} className="text-blue-800 hover:underline">
            ← {backLabel}
          </Link>
        </p>
        <div className="mt-1 text-xl font-bold text-slate-900">{title}</div>
        {error && <p className="mt-1 text-sm text-red-800">{error}</p>}
        {!error && message && <p className="mt-1 text-sm text-green-800">{message}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {toolbar}
        <button
          type="submit"
          form={formId}
          disabled={pending}
          className="shrink-0 rounded-md bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "กำลังบันทึก…" : "บันทึกการแก้ไข"}
        </button>
      </div>
    </div>
  );
}
