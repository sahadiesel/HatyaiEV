"use client";

import { getDocumentClient, savePaymentVoucherClient } from "@/lib/documents-client";
import { calcWithholdingTotals, withholdingVatRatePercent } from "@/lib/documents/calc";
import type { CashChannel, EntityRecord, VehicleCostCategory } from "@/lib/domain-types";
import {
  defaultPaymentVoucherMeta,
  parseMetaJson,
  type PaymentVoucherMeta,
} from "@/lib/documents/types";

export type CostExpenseDocsResult = {
  ok: true;
  withholdingDocumentId: string | null;
  withholdingDocumentNumber: string | null;
  paymentVoucherDocumentId: string | null;
  paymentVoucherDocumentNumber: string | null;
  /** ยอดหัก ณ ที่จ่าย (บาท) — 0 ถ้าไม่มี */
  withholdingAmount: number;
  /** ยอดที่ต้องตัดบัญชีจริง = ยอดต้นทุน − หัก ณ ที่จ่าย */
  cashOutAmount: number;
};

/** สร้างเอกสารตามประเภทต้นทุน — ค่าแรง/อะไหล่ + ตัวเลือกหัก ณ ที่จ่าย */
export async function createDocsForVehicleCostExpense(opts: {
  category: VehicleCostCategory;
  amount: string | number;
  date: string;
  description: string;
  entity: EntityRecord | null;
  billNo?: string | null;
  receiptNo?: string | null;
  /** อะไหล่ไม่มีบิล — สร้างใบสำคัญจ่าย */
  createPaymentVoucher?: boolean;
  /** มีหัก ณ ที่จ่าย */
  withholdingEnabled?: boolean;
  vehicleId: string;
  vehicleLabel: string;
  issuedByName?: string;
  channel?: CashChannel;
}): Promise<CostExpenseDocsResult | { ok: false; message: string }> {
  const amountNum = Number(String(opts.amount).replace(/,/g, "")) || 0;
  if (amountNum <= 0) return { ok: false, message: "จำนวนเงินต้องมากกว่า 0" };

  const isLabor = opts.category === "LABOR";
  const isParts = opts.category === "PARTS" || opts.category === "REPAIR";
  const billNo = (opts.billNo ?? "").trim();
  const receiptNo = (opts.receiptNo ?? "").trim();
  const wantWht = opts.withholdingEnabled === true;
  const paymentMethod =
    opts.channel === "CASH" ? ("CASH" as const) : ("TRANSFER" as const);

  if (isLabor && !opts.entity) {
    return { ok: false, message: "ค่าแรงต้องเลือกคู่ค้า (ผู้รับจ้าง)" };
  }
  if (wantWht && !opts.entity) {
    return { ok: false, message: "หัก ณ ที่จ่ายต้องเลือกคู่ค้า" };
  }

  const wantPv =
    wantWht ||
    isLabor ||
    (isParts && !billNo && !receiptNo && opts.createPaymentVoucher === true);

  let withholdingDocumentId: string | null = null;
  let withholdingDocumentNumber: string | null = null;
  let paymentVoucherDocumentId: string | null = null;
  let paymentVoucherDocumentNumber: string | null = null;
  let withholdingAmount = 0;

  if (wantPv && opts.entity) {
    if (wantWht) {
      const whtRate = opts.entity.defaultWhtPercent || "3";
      const whtTotals = calcWithholdingTotals({
        base: amountNum,
        vatRatePercent: withholdingVatRatePercent({
          payeeEntityKind:
            opts.entity.entityKind === "COMPANY" ? "COMPANY" : "INDIVIDUAL",
          vatRatePercent: opts.entity.entityKind === "COMPANY" ? "7" : "0",
        }),
        whtRatePercent: Number(whtRate) || 0,
      });
      withholdingAmount = whtTotals.withholdingAmount;
    }

    const purpose =
      opts.description ||
      (isLabor
        ? `จ่ายค่าแรง — ${opts.vehicleLabel}`
        : `จ่ายค่าอะไหล่ — ${opts.vehicleLabel}`);

    const pvMeta = {
      ...defaultPaymentVoucherMeta(),
      payeeName: opts.entity.name,
      payeeAddress: opts.entity.address,
      payeeTaxId: opts.entity.taxId,
      payeePhone: opts.entity.phone,
      paymentMethod,
      purpose,
      vehicleId: opts.vehicleId,
      vehicleLabel: opts.vehicleLabel,
      withholdingEnabled: wantWht,
      withholdingTaxRatePercent: wantWht ? opts.entity.defaultWhtPercent || "3" : "0",
      withholdingTaxBase: wantWht ? String(amountNum) : "0",
      withholdingAmount: wantWht ? String(withholdingAmount) : "0",
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
    withholdingDocumentId = pv.withholdingDocumentId;
    withholdingDocumentNumber = pv.withholdingDocumentNumber;

    if (wantWht && pv.id) {
      const fresh = await getDocumentClient(pv.id);
      if (fresh) {
        const m = parseMetaJson<PaymentVoucherMeta>(fresh.metaJson, defaultPaymentVoucherMeta());
        const amt =
          Number(String(m.withholdingAmount ?? fresh.withholdingAmount).replace(/,/g, "")) || 0;
        if (amt > 0) withholdingAmount = amt;
      }
    }
  } else if (isParts && !billNo && !receiptNo && opts.createPaymentVoucher && !opts.entity) {
    return { ok: false, message: "สร้างใบสำคัญจ่ายต้องเลือกคู่ค้า" };
  }

  const cashOutAmount = Math.max(0, amountNum - withholdingAmount);

  return {
    ok: true,
    withholdingDocumentId,
    withholdingDocumentNumber,
    paymentVoucherDocumentId,
    paymentVoucherDocumentNumber,
    withholdingAmount,
    cashOutAmount,
  };
}
