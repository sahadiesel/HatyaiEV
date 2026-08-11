"use client";

/** ปุ่มไอคอนพิมพ์เอกสาร (หัก ณ ที่จ่าย / ใบสำคัญจ่าย) */
export function PrintDocIconButton({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-8 min-w-8 items-center justify-center gap-0.5 rounded border border-slate-300 px-1.5 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        className="h-4 w-4"
        aria-hidden
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M6 9V3h12v6M6 17H4a2 2 0 01-2-2v-4a2 2 0 012-2h16a2 2 0 012 2v4a2 2 0 01-2 2h-2M6 14h12v7H6v-7z"
        />
      </svg>
      <span className="text-[10px] font-medium leading-none">{label}</span>
    </button>
  );
}
