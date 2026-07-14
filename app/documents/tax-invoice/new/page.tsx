import { CommercialDocumentForm } from "@/components/documents/CommercialDocumentForm";
import { loadClientsForDocument } from "../../document-page-data";
import { getVehicle } from "@/lib/vehicles-repository";
import { calcVehicleTotalCost, summarizeVehicleEconomics } from "@/lib/vehicles/calc";
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
  searchParams: Promise<{ vehicleId?: string }>;
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
      const eco = summarizeVehicleEconomics(vehicle);
      const totalCost = calcVehicleTotalCost(vehicle);
      const sale = eco.expectedSale || Number(vehicle.soldPrice) || 0;
      const vatInfo = eco.saleVat;
      const scheme =
        vehicle.purchaseType === "INDIVIDUAL_NO_VAT" ? ("MARGIN" as const) : ("FULL_SALE" as const);
      const lines: DocumentLineItem[] = [
        {
          ...emptyLine(1),
          description: `ขายรถยนต์ ${vehicle.brand} ${vehicle.model} ทะเบียน ${vehicle.licensePlate || "—"} VIN ${vehicle.vin || "—"} (ราคารวม VAT)`,
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
        marginSnapshot: vatInfo?.margin,
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
            ? `VAT Margin Scheme (ป.111): ต้นทุนรวม ${totalCost.toFixed(2)} บาท · กำไรขั้นต้น ${(vatInfo?.margin ?? 0).toFixed(2)} · VAT ${(vatInfo?.vatAmount ?? 0).toFixed(2)}`
            : `VAT จากยอดขายเต็ม · VAT ${(vatInfo?.vatAmount ?? 0).toFixed(2)} บาท`,
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
