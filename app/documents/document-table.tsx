import type { DocumentKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const kindLabel: Record<DocumentKind, string> = {
  INVOICE: "ใบแจ้งหนี้",
  TAX_INVOICE: "ใบกำกับภาษี",
  RECEIPT: "ใบเสร็จรับเงิน",
  PURCHASE_ORDER: "ใบสั่งจ้าง",
  WITHHOLDING_TAX: "หัก ณ ที่จ่าย",
  PAYMENT_VOUCHER: "ใบสำคัญจ่าย",
};

export async function DocumentTable({ kind }: { kind: DocumentKind }) {
  const rows = await prisma.document.findMany({
    where: { kind },
    orderBy: { issueDate: "desc" },
    take: 200,
    include: {
      client: { select: { name: true } },
      contractor: { select: { name: true } },
    },
  });

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
          <tr>
            <th className="px-3 py-2 font-medium">เลขที่</th>
            <th className="px-3 py-2 font-medium">วันที่</th>
            <th className="px-3 py-2 font-medium">ก่อน VAT</th>
            <th className="px-3 py-2 font-medium">VAT</th>
            <th className="px-3 py-2 font-medium">รวม</th>
            <th className="px-3 py-2 font-medium">หัก ณ ที่จ่าย</th>
            <th className="px-3 py-2 font-medium">คู่สัญญา</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-3 py-8 text-center text-slate-500">
                ยังไม่มี{kindLabel[kind]}ในระบบ — ฟังก์ชันสร้าง/พิมพ์เอกสารจะเพิ่มในขั้นถัดไป
              </td>
            </tr>
          ) : (
            rows.map((d) => (
              <tr key={d.id} className="hover:bg-slate-50/80">
                <td className="px-3 py-2 font-mono text-slate-900">{d.number || "—"}</td>
                <td className="px-3 py-2 text-slate-700">{d.issueDate.toLocaleDateString("th-TH")}</td>
                <td className="px-3 py-2 text-slate-800">{String(d.subtotal)}</td>
                <td className="px-3 py-2 text-slate-800">{String(d.vatAmount)}</td>
                <td className="px-3 py-2 font-medium text-slate-900">{String(d.totalAmount)}</td>
                <td className="px-3 py-2 text-slate-800">{String(d.withholdingAmount)}</td>
                <td className="px-3 py-2 text-slate-700">
                  {d.client?.name && <span>ลูกค้า: {d.client.name}</span>}
                  {d.contractor?.name && (
                    <span>
                      {d.client?.name ? " · " : ""}ผู้รับเหมา: {d.contractor.name}
                    </span>
                  )}
                  {!d.client && !d.contractor && "—"}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
