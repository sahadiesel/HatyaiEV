import { CommercialDocumentForm } from "@/components/documents/CommercialDocumentForm";
import { loadClientsForDocument } from "../../document-page-data";
import { calcVehicleSaleVatTotals } from "@/lib/documents/calc";
import {
  effectivePurchaseContractAmount,
  effectiveSaleContractAmount,
} from "@/lib/finance/vat-margin";
import { getVehicle } from "@/lib/vehicles-repository";
import { calcVehicleTotalCost } from "@/lib/vehicles/calc";
import {
  defaultCommercialMeta,
  emptyLine,
  type CommercialDocumentMeta,
  type DocumentLineItem,
} from "@/lib/documents/types";

export const metadata = { title: "สร้างใบกำกับภาษี — HYEV" };
export const dynamic = "force-dynamic";

export default async function NewTaxInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ vehicleId?: string; deposit?: string }>;
}) {
  const sp = await searchParams;
  const clients = await loadClientsForDocument();

  let initial:
    | {
        id: string;
        number: string;
        issueDate: string;
        clientId: string | null;
        lines: DocumentLineItem[];
        meta: CommercialDocumentMeta;
        notes: string;
      }
    | undefined;

  if (sp.vehicleId) {
    const vehicle = await getVehicle(sp.vehicleId);
    if (vehicle) {
      const purchaseBase = effectivePurchaseContractAmount(vehicle);
      const saleFull = effectiveSaleContractAmount(vehicle);
      const depositParam = sp.deposit ? Number(sp.deposit) : NaN;
      const sale = Number.isFinite(depositParam) && depositParam > 0 ? depositParam : saleFull;
      const totalCost = Math.max(purchaseBase, calcVehicleTotalCost(vehicle));
      const vatInfo = calcVehicleSaleVatTotals({
        purchaseType: vehicle.purchaseType,
        salePriceInclusive: sale,
        totalCost,
        vatRatePercent: 7,
      });
      const scheme =
        vehicle.purchaseType === "INDIVIDUAL_NO_VAT" ? ("MARGIN" as const) : ("FULL_SALE" as const);
      const isDeposit = Number.isFinite(depositParam) && depositParam > 0;
      const lines: DocumentLineItem[] = [
        {
          ...emptyLine(1),
          description: `ขายรถยนต์ ${vehicle.brand} ${vehicle.model} ทะเบียน ${vehicle.licensePlate || "—"} VIN ${vehicle.vin || "—"}${isDeposit ? " (มัดจำ รวม VAT)" : " (ราคารวม VAT)"}`,
          unitPrice: String(sale),
          quantity: "1",
          amount: String(sale),
        },
      ];
      const meta: CommercialDocumentMeta = {
        ...defaultCommercialMeta(),
        vatScheme: scheme,
        purchaseType: vehicle.purchaseType,
        vehicleId: vehicle.id,
        vehicleLabel: `${vehicle.brand} ${vehicle.model} ${vehicle.licensePlate}`,
        totalCostSnapshot: totalCost,
        marginSnapshot: vatInfo.margin,
        vatRatePercent: 7,
      };
      initial = {
        id: "",
        number: "",
        issueDate: new Date().toISOString().slice(0, 10),
        clientId: null,
        lines,
        meta,
        notes:
          scheme === "MARGIN"
            ? `VAT Margin Scheme (ป.111): ฐานซื้อสัญญา ${purchaseBase.toFixed(2)} · กำไรขั้นต้น ${vatInfo.margin.toFixed(2)} · VAT นำส่ง ${vatInfo.vatAmount.toFixed(2)}`
            : `VAT จากยอดขายเต็ม · VAT ${vatInfo.vatAmount.toFixed(2)} บาท`,
      };
    }
  }

  return (
    <div className="space-y-3">
      {sp.vehicleId && initial && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          ดึงข้อมูลจากรถในสต็อกแล้ว —{" "}
          {initial.meta.vatScheme === "MARGIN"
            ? "ใช้สูตร Margin Scheme (ป.111) จากกำไรขั้นต้น"
            : "คิด VAT จากยอดขายเต็ม (ซื้อจากบริษัท VAT 7%)"}
          . ปรับจำนวนเงิน/ลูกค้าให้ถูกต้องก่อนบันทึก
        </p>
      )}
      <CommercialDocumentForm
        kind="TAX_INVOICE"
        listHref="/documents/tax-invoice"
        clients={clients}
        initial={initial?.id ? initial : initial ? { ...initial, id: "" } : undefined}
      />
    </div>
  );
}
