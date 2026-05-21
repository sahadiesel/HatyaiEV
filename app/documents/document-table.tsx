import type { DocumentKind } from "@/lib/documents-firestore-types";
import Link from "next/link";
import { AdminSetupNotice } from "@/components/AdminSetupNotice";
import { DocumentPrintLink } from "@/components/documents/DocumentPrintLink";
import { listDocuments } from "@/lib/documents-repository";
import { DOCUMENT_KIND_ROUTES } from "@/lib/documents/types";

const kindLabel: Record<DocumentKind, string> = {
  INVOICE: "ใบแจ้งหนี้",
  TAX_INVOICE: "ใบกำกับภาษี",
  RECEIPT: "ใบเสร็จรับเงิน",
  PURCHASE_ORDER: "ใบสั่งจ้าง",
  WITHHOLDING_TAX: "หัก ณ ที่จ่าย",
  PAYMENT_VOUCHER: "ใบสำคัญจ่าย",
};

export async function DocumentTable({ kind }: { kind: DocumentKind }) {
  const slug = DOCUMENT_KIND_ROUTES[kind].slug;
  const rows = await listDocuments(kind);

  return (
    <div className="space-y-3">
      <AdminSetupNotice />
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
            <th className="px-3 py-2 font-medium w-28" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={8} className="px-3 py-8 text-center text-slate-500">
                ยังไม่มี{kindLabel[kind]}ในระบบ — กด <strong>สร้างเอกสาร</strong> เพื่อเพิ่มรายการ
              </td>
            </tr>
          ) : (
            rows.map((d) => (
              <tr key={d.id} className="hover:bg-slate-50/80">
                <td className="px-3 py-2 font-mono text-slate-900">
                  <Link href={`/documents/${slug}/${d.id}`} className="text-blue-800 hover:underline">
                    {d.number || "—"}
                  </Link>
                </td>
                <td className="px-3 py-2 text-slate-700">{d.issueDate.toLocaleDateString("th-TH")}</td>
                <td className="px-3 py-2 text-right text-slate-800">
                  {Number(d.subtotal).toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                </td>
                <td className="px-3 py-2 text-right text-slate-800">
                  {Number(d.vatAmount).toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                </td>
                <td className="px-3 py-2 text-right font-medium text-slate-900">
                  {Number(d.totalAmount).toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                </td>
                <td className="px-3 py-2 text-right text-slate-800">
                  {Number(d.withholdingAmount).toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                </td>
                <td className="px-3 py-2 text-slate-700">
                  {d.clientName && <span>ลูกค้า: {d.clientName}</span>}
                  {d.contractorName && (
                    <span>
                      {d.clientName ? " · " : ""}ผู้รับเหมา: {d.contractorName}
                    </span>
                  )}
                  {!d.clientName && !d.contractorName && "—"}
                </td>
                <td className="px-3 py-2 text-right text-sm whitespace-nowrap">
                  <Link href={`/documents/${slug}/${d.id}`} className="text-blue-800 hover:underline">
                    แก้ไข
                  </Link>
                  {" · "}
                  <DocumentPrintLink documentId={d.id} />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
    </div>
  );
}
