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
 * แยก VAT จากราคารวมภาษี (เช่น ตั้งขาย 80,000 รวม VAT 7%)
 * ภาษีขาย = ยอดรวม × 7/107
 */
export function extractInclusiveVat(totalInclusive: number, vatRatePercent = 7) {
  const total = roundMoney2(totalInclusive);
  const vatAmount = roundMoney2((total * vatRatePercent) / (100 + vatRatePercent));
  const priceBeforeVat = roundMoney2(total - vatAmount);
  return { total, vatAmount, priceBeforeVat };
}

/**
 * VAT เมื่อขายในนามบริษัทจด VAT — ต้องออกใบกำกับภาษี
 * คิดภาษีขายจากยอดขายเต็ม (ราคารวม VAT) × 7/107
 * ไม่ใช้ Margin Scheme ป.111 (แม้ซื้อจากบุคคลไม่มีใบกำกับ)
 */
export function calcSaleVat(opts: {
  purchaseType?: VehiclePurchaseType;
  salePriceInclusive: number;
  totalCost: number;
  vatRatePercent?: number;
}): {
  scheme: "FULL";
  salePriceInclusive: number;
  taxableBase: number;
  vatAmount: number;
  priceBeforeVat: number;
  /** กำไรขั้นต้นหลังแยก VAT = ราคาก่อน VAT − ต้นทุน */
  margin: number;
  /** ภาษีซื้อ (โดยทั่วไป 0 ถ้าซื้อจากบุคคลไม่มีใบกำกับ) */
  inputVatHint: number;
} {
  const rate = opts.vatRatePercent ?? 7;
  const sale = roundMoney2(opts.salePriceInclusive);
  const cost = roundMoney2(opts.totalCost);
  const { vatAmount, priceBeforeVat } = extractInclusiveVat(sale, rate);
  return {
    scheme: "FULL",
    salePriceInclusive: sale,
    taxableBase: priceBeforeVat,
    vatAmount,
    priceBeforeVat,
    margin: roundMoney2(priceBeforeVat - cost),
    inputVatHint: 0,
  };
}

/**
 * ต้นทุนไม่รวมภาษี — ซื้อบุคคล = ยอดเต็ม, ซื้อบริษัท VAT = แยก VAT จากราคาซื้อ
 * ต้นทุนซ่อมสะสมใช้ยอดที่บันทึก (ส่วนใหญ่เป็นยอดจ่ายจริง)
 */
export function calcCostExcludingVat(vehicle: Pick<VehicleRecord, "purchaseType" | "purchasePrice" | "costLines">): number {
  const purchase = parseAmount(vehicle.purchasePrice);
  const repair = sumCostLines(vehicle.costLines ?? []);
  if (vehicle.purchaseType === "COMPANY_VAT_7" && purchase > 0) {
    const { priceBeforeVat } = extractInclusiveVat(purchase, 7);
    return roundMoney2(priceBeforeVat + repair);
  }
  return roundMoney2(purchase + repair);
}

/**
 * กำไรขั้นต้นประมาณ = ราคาขายก่อน VAT − ต้นทุนไม่รวมภาษี − ค่าคอม
 * (ราคาตั้งขายถือว่ารวม VAT 7% แล้ว)
 */
export function calcGrossProfitEstimate(opts: {
  expectedSalePrice: string | number;
  /** ต้นทุนไม่รวมภาษี */
  totalCostExVat: number;
  commissionAmount: string | number;
  vatRatePercent?: number;
}): number {
  const sale = parseAmount(opts.expectedSalePrice);
  const commission = parseAmount(opts.commissionAmount);
  if (sale <= 0) return roundMoney2(0 - opts.totalCostExVat - commission);
  const { priceBeforeVat } = extractInclusiveVat(sale, opts.vatRatePercent ?? 7);
  return roundMoney2(priceBeforeVat - opts.totalCostExVat - commission);
}

/** สรุปตัวเลขสำหรับแสดงบนการ์ดรถ */
export function summarizeVehicleEconomics(vehicle: VehicleRecord) {
  const totalCost = calcVehicleTotalCost(vehicle);
  const costExVat = calcCostExcludingVat(vehicle);
  const expectedSale = parseAmount(vehicle.expectedSalePrice);
  const commission = parseAmount(vehicle.commissionAmount);
  const saleVat =
    expectedSale > 0
      ? calcSaleVat({
          purchaseType: vehicle.purchaseType,
          salePriceInclusive: expectedSale,
          totalCost: costExVat,
        })
      : null;
  const priceBeforeVat = saleVat?.priceBeforeVat ?? 0;
  const vatAmount = saleVat?.vatAmount ?? 0;
  const grossProfit = calcGrossProfitEstimate({
    expectedSalePrice: expectedSale,
    totalCostExVat: costExVat,
    commissionAmount: commission,
  });

  return {
    totalCost,
    costExVat,
    expectedSale,
    commission,
    priceBeforeVat,
    vatAmount,
    grossProfit,
    saleVat,
  };
}

export const PURCHASE_TYPE_LABELS: Record<VehiclePurchaseType, string> = {
  INDIVIDUAL_NO_VAT: "บุคคลธรรมดา (ซื้อไม่มีใบกำกับ — ภาษีซื้อ = 0)",
  COMPANY_VAT_7: "บริษัทจด VAT 7% (ซื้อมีใบกำกับ)",
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

/** เรียงรถ: ยี่ห้อ → รุ่น → ทะเบียน */
export function compareVehiclesByBrandModelPlate(
  a: Pick<VehicleRecord, "brand" | "model" | "licensePlate">,
  b: Pick<VehicleRecord, "brand" | "model" | "licensePlate">,
): number {
  const brand = (a.brand || "").localeCompare(b.brand || "", "th", { sensitivity: "base" });
  if (brand !== 0) return brand;
  const model = (a.model || "").localeCompare(b.model || "", "th", { sensitivity: "base" });
  if (model !== 0) return model;
  return (a.licensePlate || "").localeCompare(b.licensePlate || "", "th", {
    numeric: true,
    sensitivity: "base",
  });
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
