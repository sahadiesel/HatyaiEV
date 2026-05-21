import Link from "next/link";
import { DashboardShopSummary } from "@/components/DashboardShopSummary";
import { listClients } from "@/lib/clients-repository";
import { listContractors } from "@/lib/contractors-repository";
import { prisma } from "@/lib/prisma";

export default async function HomePage() {
  const [clientRows, contractorRows, hiringContracts, subcontractAgreements] = await Promise.all([
    listClients(),
    listContractors(),
    prisma.hiringContract.count().catch(() => 0),
    prisma.subcontractAgreement.count().catch(() => 0),
  ]);
  const clients = clientRows.length;
  const contractors = contractorRows.length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">แดชบอร์ด</h1>
        <p className="mt-1 text-slate-600">
          ระบบรับงานซ่อม แยกผู้ว่าจ้าง / ผู้รับเหมา งวดเงิน และประเภทเอกสาร
          (ใบแจ้งหนี้ ใบกำกับภาษี ใบเสร็จ / ใบสั่งจ้าง หัก ณ ที่จ่าย)
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="ผู้ว่าจ้าง" value={clients} href="/clients" />
        <StatCard title="ผู้รับเหมา" value={contractors} href="/contractors" />
        <StatCard title="สัญญารับจ้าง" value={hiringContracts} href="/contracts/hiring-contracts" />
        <StatCard title="สัญญาว่าจ้าง" value={subcontractAgreements} href="/contracts/subcontract-agreements" />
      </div>

      <DashboardShopSummary />
    </div>
  );
}

function StatCard({
  title,
  value,
  href,
}: {
  title: string;
  value: number;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300"
    >
      <p className="text-sm text-slate-500">{title}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
    </Link>
  );
}
