import Link from "next/link";
import { DashboardShopSummary } from "@/components/DashboardShopSummary";
import { DashboardHomeClient } from "./DashboardHomeClient";

export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">แดชบอร์ด — Hatyai EV</h1>
        <p className="mt-1 text-slate-600">
          ระบบจัดการสต็อกรถ · ต้นทุน · สัญญา · เอกสารบัญชี · สมุดเงินสด
        </p>
      </div>

      <DashboardHomeClient />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <QuickLink href="/vehicles/new" label="รับรถเข้าสต็อก" />
        <QuickLink href="/cashbook" label="บันทึกรายการด่วน" />
        <QuickLink href="/documents/payment-voucher/new" label="ใบสำคัญจ่าย" />
        <QuickLink href="/contracts/subcontract-agreements/new" label="สร้างสัญญาว่าจ้าง" />
      </div>

      <DashboardShopSummary />
    </div>
  );
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-md border border-slate-200 bg-white px-4 py-3 text-center text-sm font-medium text-slate-800 shadow-sm hover:border-slate-400"
    >
      {label}
    </Link>
  );
}
