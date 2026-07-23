import { parseAmount, roundMoney2 } from "@/lib/documents/calc";

/** ถอด VAT จากยอดรวมภาษี (เช่น มัดจำ 315,000 → ฐาน + VAT 7%) */
export function calcInclusiveVatBreakdown(totalInclusive: number, vatRatePercent = 7) {
  const total = roundMoney2(totalInclusive);
  const vatAmount = roundMoney2((total * vatRatePercent) / (100 + vatRatePercent));
  const base = roundMoney2(total - vatAmount);
  return { base, vatAmount, total };
}

/**
 * ใบกำกับภาษีมัดจำขาย (แสดงให้ลูกค้า) + VAT นำส่งตาม ป.111 (หลังบ้าน)
 * - ลูกค้าได้ใบกำกับเต็มรูปจากยอดมัดจำรวม VAT
 * - บริษัทนำส่ง VAT จากสัดส่วนกำไรขั้นต้น (ขายสัญญา − ซื้อสัญญา) × สัดส่วนมัดจำ
 */
export function calcSaleDepositTaxInvoice(opts: {
  saleContractAmount: number;
  purchaseContractAmount: number;
  depositInclusive: number;
  purchaseType: "INDIVIDUAL_NO_VAT" | "COMPANY_VAT_7";
  vatRatePercent?: number;
}) {
  const rate = opts.vatRatePercent ?? 7;
  const sale = roundMoney2(opts.saleContractAmount);
  const purchase = roundMoney2(opts.purchaseContractAmount);
  const deposit = roundMoney2(opts.depositInclusive);
  const customerInvoice = calcInclusiveVatBreakdown(deposit, rate);

  if (opts.purchaseType === "COMPANY_VAT_7") {
    return {
      customerInvoice,
      remittanceVat: customerInvoice.vatAmount,
      taxBasisAmount: customerInvoice.base,
      vatType: "FULL_VAT" as const,
      marginPortion: roundMoney2(Math.max(0, sale - purchase) * (sale > 0 ? deposit / sale : 0)),
    };
  }

  const fullMargin = roundMoney2(Math.max(0, sale - purchase));
  const depositRatio = sale > 0 ? deposit / sale : 0;
  const marginPortion = roundMoney2(fullMargin * depositRatio);
  const remittanceVat = roundMoney2((marginPortion * rate) / (100 + rate));
  const taxBasisAmount = roundMoney2(marginPortion - remittanceVat);

  return {
    customerInvoice,
    remittanceVat,
    taxBasisAmount,
    vatType: "MARGIN_VAT" as const,
    marginPortion,
  };
}

export function effectivePurchaseContractAmount(vehicle: {
  purchaseContractAmount?: string;
  purchasePrice?: string;
}): number {
  const locked = parseAmount(vehicle.purchaseContractAmount ?? "");
  if (locked > 0) return locked;
  return parseAmount(vehicle.purchasePrice ?? "");
}

export function effectiveSaleContractAmount(vehicle: {
  saleContractAmount?: string;
  expectedSalePrice?: string;
  soldPrice?: string;
}): number {
  const locked = parseAmount(vehicle.saleContractAmount ?? "");
  if (locked > 0) return locked;
  const sold = parseAmount(vehicle.soldPrice ?? "");
  if (sold > 0) return sold;
  return parseAmount(vehicle.expectedSalePrice ?? "");
}
