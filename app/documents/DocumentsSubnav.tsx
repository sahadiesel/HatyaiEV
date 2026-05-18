"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const docNav = [
  { href: "/documents/invoice", newHref: "/documents/invoice/new", label: "1. ใบแจ้งหนี้" },
  { href: "/documents/tax-invoice", newHref: "/documents/tax-invoice/new", label: "2. ใบกำกับภาษี" },
  { href: "/documents/receipt", newHref: "/documents/receipt/new", label: "3. ใบเสร็จรับเงิน" },
  { href: "/documents/withholding", newHref: "/documents/withholding/new", label: "4. ใบหักภาษี ณ ที่จ่าย" },
  { href: "/documents/payment-voucher", newHref: "/documents/payment-voucher/new", label: "5. ใบสำคัญจ่าย" },
] as const;

export function DocumentsSubnav() {
  const pathname = usePathname() ?? "";

  const isItemActive = (href: string) => {
    if (pathname === "/documents" && href === "/documents/invoice") return true;
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const current = docNav.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
  const createHref =
    pathname === "/documents" ? "/documents/invoice/new" : (current?.newHref ?? "/documents/invoice/new");

  return (
    <div className="flex flex-col gap-3 border-b border-slate-200 pb-3 sm:flex-row sm:items-end sm:justify-between">
      <nav aria-label="เมนูเอกสาร" className="flex flex-wrap gap-2 text-sm">
        {docNav.map((item) => {
          const active = isItemActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={
                active
                  ? "rounded-md border border-slate-900 bg-slate-900 px-3 py-2 font-medium text-white shadow-sm"
                  : "rounded-md border border-slate-200 bg-white px-3 py-2 text-slate-800 shadow-sm hover:border-slate-300 hover:bg-slate-50"
              }
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <Link
        href={createHref}
        className="inline-flex shrink-0 items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
      >
        สร้างเอกสาร
      </Link>
    </div>
  );
}
