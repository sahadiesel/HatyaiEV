import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function HiringContractsListPage() {
  const rows = await prisma.hiringContract.findMany({
    orderBy: { updatedAt: "desc" },
    include: { client: true, _count: { select: { vehicles: true, installments: true } } },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">สัญญารับจ้าง</h1>
          <p className="mt-1 text-sm text-slate-600">
            สร้างรายการก่อน แล้วเข้าไปแก้ไขรายละเอียดรถ ราคาต่อคัน และงวดเก็บเงิน
          </p>
        </div>
        <Link
          href="/contracts/hiring-contracts/new"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          สร้างสัญญารับจ้าง
        </Link>
      </div>

      <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white shadow-sm">
        {rows.length === 0 ? (
          <li className="p-4 text-sm text-slate-500">ยังไม่มีสัญญารับจ้าง</li>
        ) : (
          rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 p-4">
              <div>
                <Link href={`/contracts/hiring-contracts/${r.id}`} className="font-medium text-blue-800 hover:underline">
                  {r.code}
                </Link>
                <span className="text-slate-600"> — {r.title || "—"}</span>
                <p className="text-sm text-slate-500">
                  ผู้ว่าจ้าง: {r.client.name} · กำหนด {r.vehicleCount} คัน · รายการรถที่กรอกแล้ว {r._count.vehicles} · งวด{" "}
                  {r._count.installments}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase text-slate-500">{r.status}</span>
                <Link
                  href={`/contracts/hiring-contracts/${r.id}`}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-800 hover:bg-slate-50"
                >
                  แก้ไขรายละเอียด
                </Link>
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
