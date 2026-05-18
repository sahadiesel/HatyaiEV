"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/contracts/hiring-contracts", label: "1. สัญญารับจ้าง" },
  { href: "/contracts/subcontract-agreements", label: "2. สัญญาว่าจ้าง" },
] as const;

export function ContractSubnav() {
  const pathname = usePathname() ?? "";

  return (
    <nav aria-label="ประเภทสัญญา" className="flex flex-wrap gap-2 border-b border-slate-200 pb-3 text-sm">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
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
  );
}
