import { parseAmount, roundMoney2 } from "@/lib/documents/calc";
import type {
  VehicleCostLine,
  VehiclePurchasePayment,
  VehiclePurchaseType,
  VehicleRecord,
} from "@/lib/domain-types";

/** รวมต้นทุนสะสมจากรายการอะไหล่/ซ่อม */
export function sumCostLines(lines: VehicleCostLine[]): number {
  return roundMoney2(lines.reduce((s, l) => s + parseAmount(l.amount), 0));
}

/** ต้นทุนรวมปัจจุบัน = ราคาซื้อ + ต้นทุนสะสม */
export function calcVehicleTotalCost(vehicle: Pick<VehicleRecord, "purchasePrice" | "costLines">): number {
  return roundMoney2(parseAmount(vehicle.purchasePrice) + sumCostLines(vehicle.costLines ?? []));
}

/**
 * กำไรขั้นต้นเบื้องต้น = ราคาตั้งขาย − ต้นทุนรวม − ค่าคอมมิชชั่น
 * (ก่อนหักภาษี / ก่อนขายจริง)
 */
export function calcGrossProfitEstimate(opts: {
  expectedSalePrice: string | number;
  totalCost: number;
  commissionAmount: string | number;
}): number {
  const sale = parseAmount(opts.expectedSalePrice);
  const commission = parseAmount(opts.commissionAmount);
  return roundMoney2(sale - opts.totalCost - commission);
}

/**
 * VAT ตามประเภทการซื้อเข้า (ป.111 Margin Scheme)
 *
 * - ซื้อจากบุคคลธรรมดา: VAT จากกำไรขั้นต้น (Margin Scheme)
 *   margin = ราคาขาย − ต้นทุนรวม, VAT = margin × 7/107
 * - ซื้อจากบริษัท VAT 7%: VAT จากยอดขายเต็ม (ราคาขาย × 7/107 ถ้า inclusive
 *   หรือ ราคาขายก่อน VAT × 7% — ที่นี่ใช้ราคาตั้งขายเป็นยอดรวม VAT รวมแล้ว)
 *
 * คืนค่าทั้งกรณีขายแบบรวม VAT (ภาษีขายรถยนต์มือสองทั่วไป)
 */
export function calcSaleVat(opts: {
  purchaseType: VehiclePurchaseType;
  salePriceInclusive: number;
  totalCost: number;
  vatRatePercent?: number;
}): {
  scheme: "MARGIN" | "FULL";
  salePriceInclusive: number;
  taxableBase: number;
  vatAmount: number;
  priceBeforeVat: number;
  margin: number;
} {
  const rate = opts.vatRatePercent ?? 7;
  const sale = roundMoney2(opts.salePriceInclusive);
  const cost = roundMoney2(opts.totalCost);

  if (opts.purchaseType === "INDIVIDUAL_NO_VAT") {
    // Margin Scheme: VAT = (ขาย − ต้นทุน) × rate/(100+rate)
    const margin = roundMoney2(Math.max(0, sale - cost));
    const vatAmount = roundMoney2((margin * rate) / (100 + rate));
    const taxableBase = roundMoney2(margin - vatAmount);
    return {
      scheme: "MARGIN",
      salePriceInclusive: sale,
      taxableBase,
      vatAmount,
      priceBeforeVat: roundMoney2(sale - vatAmount),
      margin,
    };
  }

  // ซื้อจากบริษัทมี VAT — คิด VAT จากยอดขายเต็ม (ราคารวม VAT)
  const vatAmount = roundMoney2((sale * rate) / (100 + rate));
  const priceBeforeVat = roundMoney2(sale - vatAmount);
  return {
    scheme: "FULL",
    salePriceInclusive: sale,
    taxableBase: priceBeforeVat,
    vatAmount,
    priceBeforeVat,
    margin: roundMoney2(sale - cost),
  };
}

/** สรุปตัวเลขสำหรับแสดงบนการ์ดรถ */
export function summarizeVehicleEconomics(vehicle: VehicleRecord) {
  const totalCost = calcVehicleTotalCost(vehicle);
  const expectedSale = parseAmount(vehicle.expectedSalePrice);
  const commission = parseAmount(vehicle.commissionAmount);
  const grossProfit = calcGrossProfitEstimate({
    expectedSalePrice: expectedSale,
    totalCost,
    commissionAmount: commission,
  });
  const saleVat =
    expectedSale > 0
      ? calcSaleVat({
          purchaseType: vehicle.purchaseType,
          salePriceInclusive: expectedSale,
          totalCost,
        })
      : null;

  return { totalCost, expectedSale, commission, grossProfit, saleVat };
}

export const PURCHASE_TYPE_LABELS: Record<VehiclePurchaseType, string> = {
  INDIVIDUAL_NO_VAT: "บุคคลธรรมดา (ไม่มี VAT / Margin Scheme)",
  COMPANY_VAT_7: "บริษัทจด VAT 7%",
};

export const VEHICLE_STATUS_LABELS: Record<string, string> = {
  IN_STOCK: "ในสต็อก",
  RESERVED: "จองแล้ว",
  SOLD: "ขายแล้ว",
  WRITTEN_OFF: "ตัดจำหน่าย",
};

export const COST_CATEGORY_LABELS: Record<string, string> = {
  PARTS: "อะไหล่",
  LABOR: "ค่าแรง",
  REPAIR: "ซ่อม",
  OTHER: "อื่น ๆ",
};

export function formatBaht(n: number): string {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** ยอดที่ต้องจ่ายตามสัญญา (สัญญาซื้อ หรือราคาซื้อ) */
export function calcPurchaseObligation(
  vehicle: Pick<VehicleRecord, "purchasePrice" | "purchaseContractAmount">,
): number {
  const contract = parseAmount(vehicle.purchaseContractAmount);
  if (contract > 0) return roundMoney2(contract);
  return roundMoney2(parseAmount(vehicle.purchasePrice));
}

export function sumPurchasePayments(payments: VehiclePurchasePayment[] | undefined): number {
  return roundMoney2((payments ?? []).reduce((s, p) => s + parseAmount(p.amount), 0));
}

export function calcPurchasePaymentSummary(
  vehicle: Pick<VehicleRecord, "purchasePrice" | "purchaseContractAmount" | "purchasePayments">,
) {
  const obligation = calcPurchaseObligation(vehicle);
  const paid = sumPurchasePayments(vehicle.purchasePayments);
  const remaining = roundMoney2(Math.max(0, obligation - paid));
  return { obligation, paid, remaining };
}
