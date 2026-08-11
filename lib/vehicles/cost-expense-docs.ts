"use client";

import {
  savePaymentVoucherClient,
  saveWithholdingDocumentClient,
} from "@/lib/documents-client";
import { calcWithholdingTotals, withholdingVatRatePercent } from "@/lib/documents/calc";
import type { EntityRecord, VehicleCostCategory } from "@/lib/domain-types";
import {
  defaultPaymentVoucherMeta,
  defaultWithholdingMeta,
} from "@/lib/documents/types";

export type CostExpenseDocsResult = {
  ok: true;
  withholdingDocumentId: string | null;
  withholdingDocumentNumber: string | null;
  paymentVoucherDocumentId: string | null;
  paymentVoucherDocumentNumber: string | null;
};

/** สร้างเอกสารตามประเภทต้นทุน — ค่าแรง: หัก ณ ที่จ่าย + ใบสำคัญจ่าย / อะไหล่: ใบสำคัญจ่ายเมื่อไม่มีบิล */
export async function createDocsForVehicleCostExpense(opts: {
  category: VehicleCostCategory;
  amount: string | number;
  date: string;
  description: string;
  entity: EntityRecord | null;
  billNo?: string | null;
  /** อะไหล่ไม่มีบิล — สร้างใบสำคัญจ่าย */
  createPaymentVoucher?: boolean;
  vehicleId: string;
  vehicleLabel: string;
  issuedByName?: string;
}): Promise<CostExpenseDocsResult | { ok: false; message: string }> {
  const amountNum = Number(String(opts.amount).replace(/,/g, "")) || 0;
  if (amountNum <= 0) return { ok: false, message: "จำนวนเงินต้องมากกว่า 0" };

  const isLabor = opts.category === "LABOR";
  const isParts = opts.category === "PARTS" || opts.category === "REPAIR";
  const billNo = (opts.billNo ?? "").trim();

  if (isLabor && !opts.entity) {
    return { ok: false, message: "ค่าแรงต้องเลือกคู่ค้า (ผู้รับจ้าง)" };
  }

  let withholdingDocumentId: string | null = null;
  let withholdingDocumentNumber: string | null = null;
  let paymentVoucherDocumentId: string | null = null;
  let paymentVoucherDocumentNumber: string | null = null;

  if (isLabor && opts.entity) {
    const whtRate = opts.entity.defaultWhtPercent || "3";
    const whtMeta = {
      ...defaultWithholdingMeta(),
      payeeName: opts.entity.name,
      payeeTaxId: opts.entity.taxId,
      payeeAddress: opts.entity.address,
      payeeBranchHeadOffice: opts.entity.branchHeadOffice !== false,
      payeeBranchNo: opts.entity.branchNo || "",
      payeeEntityKind:
        opts.entity.entityKind === "COMPANY" ? ("COMPANY" as const) : ("INDIVIDUAL" as const),
      vatRatePercent: opts.entity.entityKind === "COMPANY" ? "7" : "0",
      incomeTypeLabel: "ค่าจ้างทำของ / ค่าแรง",
      jobDescription: opts.description || `ค่าแรง — ${opts.vehicleLabel}`,
      withholdingTaxRatePercent: whtRate,
      withholdingTaxBase: String(amountNum),
      paymentDate: opts.date,
      paymentMethod: "TRANSFER" as const,
      referenceNo: opts.vehicleLabel,
    };
    const wht = await saveWithholdingDocumentClient({
      contractorId: opts.entity.id,
      issueDate: opts.date,
      metaJson: JSON.stringify(whtMeta),
      assignNumber: true,
      issuedByName: opts.issuedByName,
      notes: `จากต้นทุนรถ ${opts.vehicleLabel}`,
    });
    if (!wht.ok) return wht;
    withholdingDocumentId = wht.id;
    withholdingDocumentNumber = wht.number;

    const whtTotals = calcWithholdingTotals({
      base: amountNum,
      vatRatePercent: withholdingVatRatePercent(whtMeta),
      whtRatePercent: Number(whtRate) || 0,
    });

    const pvMeta = {
      ...defaultPaymentVoucherMeta(),
      payeeName: opts.entity.name,
      payeeAddress: opts.entity.address,
      payeeTaxId: opts.entity.taxId,
      payeePhone: opts.entity.phone,
      paymentMethod: "TRANSFER" as const,
      purpose: opts.description || `จ่ายค่าแรง — ${opts.vehicleLabel}`,
      vehicleId: opts.vehicleId,
      vehicleLabel: opts.vehicleLabel,
      withholdingDocumentNumber: withholdingDocumentNumber || undefined,
      withholdingTaxRatePercent: whtRate,
      withholdingTaxBase: String(amountNum),
      withholdingAmount: String(whtTotals.withholdingAmount),
    };
    const pv = await savePaymentVoucherClient({
      issueDate: opts.date,
      totalAmount: amountNum,
      metaJson: JSON.stringify(pvMeta),
      assignNumber: true,
      issuedByName: opts.issuedByName,
      postCashbook: false,
      notes: withholdingDocumentNumber
        ? `อ้างอิงหัก ณ ที่จ่าย ${withholdingDocumentNumber}`
        : `จากต้นทุนรถ ${opts.vehicleLabel}`,
    });
    if (!pv.ok) return pv;
    paymentVoucherDocumentId = pv.id;
    paymentVoucherDocumentNumber = pv.number;
  } else if (isParts && !billNo && opts.createPaymentVoucher) {
    if (!opts.entity) {
      return { ok: false, message: "สร้างใบสำคัญจ่ายต้องเลือกคู่ค้า" };
    }
    const pvMeta = {
      ...defaultPaymentVoucherMeta(),
      payeeName: opts.entity.name,
      payeeAddress: opts.entity.address,
      payeeTaxId: opts.entity.taxId,
      payeePhone: opts.entity.phone,
      paymentMethod: "TRANSFER" as const,
      purpose: opts.description || `จ่ายค่าอะไหล่ — ${opts.vehicleLabel}`,
      vehicleId: opts.vehicleId,
      vehicleLabel: opts.vehicleLabel,
    };
    const pv = await savePaymentVoucherClient({
      issueDate: opts.date,
      totalAmount: amountNum,
      metaJson: JSON.stringify(pvMeta),
      assignNumber: true,
      issuedByName: opts.issuedByName,
      postCashbook: false,
      notes: `จากต้นทุนรถ ${opts.vehicleLabel}`,
    });
    if (!pv.ok) return pv;
    paymentVoucherDocumentId = pv.id;
    paymentVoucherDocumentNumber = pv.number;
  }

  return {
    ok: true,
    withholdingDocumentId,
    withholdingDocumentNumber,
    paymentVoucherDocumentId,
    paymentVoucherDocumentNumber,
  };
}
