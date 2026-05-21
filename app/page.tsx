import Link from "next/link";
import { loadCompanySettingsForDisplay } from "@/lib/company-settings-server";
import {
  countFirestoreCollection,
} from "@/lib/firestore-entities";
import { firestoreCollections } from "@/lib/firestore";
import { prisma } from "@/lib/prisma";

async function countWithFirestore(
  firestoreCollection: string,
  prismaCount: () => Promise<number>,
): Promise<number> {
  const fs = await countFirestoreCollection(firestoreCollection);
  if (fs !== null) return fs;
  return prismaCount();
}

export default async function HomePage() {
  const [clients, contractors, hiringContracts, subcontractAgreements, settings] =
    await Promise.all([
      countWithFirestore(firestoreCollections.clients, () => prisma.client.count()),
      countWithFirestore(firestoreCollections.contractors, () => prisma.contractor.count()),
      prisma.hiringContract.count(),
      prisma.subcontractAgreement.count(),
      loadCompanySettingsForDisplay(),
    ]);

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

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="font-semibold text-slate-900">ข้อมูลร้าน (จากตั้งค่า)</h2>
        <dl className="mt-3 space-y-1 text-sm text-slate-700">
          <div>
            <dt className="font-medium text-slate-500">ชื่อ</dt>
            <dd>{settings?.companyName ?? "— ยังไม่ได้ตั้งค่า —"}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-500">เลขผู้เสียภาษี</dt>
            <dd>{settings?.taxId ?? "—"}</dd>
          </div>
        </dl>
        <Link
          href="/settings"
          className="mt-4 inline-block text-sm font-medium text-blue-700 hover:underline"
        >
          ไปแก้ไขตั้งค่าร้าน →
        </Link>
      </section>
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
