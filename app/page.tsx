import Link from "next/link";
import { DashboardShopSummary } from "@/components/DashboardShopSummary";
import { calcCashflowBalance } from "@/lib/cashbook-repository";
import { listEntities } from "@/lib/entities-repository";
import { listSubcontractAgreements } from "@/lib/subcontract-agreements-repository";
import { listVehicles } from "@/lib/vehicles-repository";
import { formatBaht } from "@/lib/vehicles/calc";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [entities, vehicles, hireContracts, cash] = await Promise.all([
    listEntities(),
    listVehicles(),
    listSubcontractAgreements(),
    calcCashflowBalance(),
  ]);
  const inStock = vehicles.filter((v) => v.status === "IN_STOCK" || v.status === "RESERVED").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">แดชบอร์ด — Hatyai EV</h1>
        <p className="mt-1 text-slate-600">
          ระบบจัดการสต็อกรถ · ต้นทุน · สัญญา · เอกสารบัญชี · สมุดเงินสด
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="รถในสต็อก" value={String(inStock)} href="/vehicles" />
        <StatCard title="คู่ค้า" value={String(entities.length)} href="/entities" />
        <StatCard
          title="สัญญาว่าจ้าง"
          value={String(hireContracts.length)}
          href="/contracts/subcontract-agreements"
        />
        <StatCard
          title="Cashflow Balance"
          value={`฿${formatBaht(cash.balance)}`}
          href="/cashbook"
          emphasize
        />
      </div>

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

function StatCard({
  title,
  value,
  href,
  emphasize,
}: {
  title: string;
  value: string;
  href: string;
  emphasize?: boolean;
}) {
  return (
    <Link
      href={href}
      className={
        emphasize
          ? "rounded-lg border-2 border-slate-900 bg-white p-4 shadow-sm transition hover:bg-slate-50"
          : "rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300"
      }
    >
      <p className="text-sm text-slate-500">{title}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{value}</p>
    </Link>
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
