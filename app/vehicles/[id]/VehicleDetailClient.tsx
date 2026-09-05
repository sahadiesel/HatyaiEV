"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { PrintDocIconButton } from "@/components/PrintDocIconButton";
import { CASH_ACCOUNT_ID, channelForAccountId, listBankAccountsClient } from "@/lib/bank-accounts-client";
import { calcWithholdingTotals, parseAmount } from "@/lib/documents/calc";
import { printDocumentClient } from "@/lib/documents-client";
import type {
  BankAccountRecord,
  EntityRecord,
  VehicleCostCategory,
  VehicleRecord,
  VehicleStatus,
} from "@/lib/domain-types";
import { entityHasRoleGroup } from "@/lib/entity-roles";
import { formatDateThBE } from "@/lib/format-date-th";
import {
  addVehicleCostLineClient,
  addVehiclePurchasePaymentClient,
  removeVehicleCostLineClient,
  saveVehicleClient,
  updateVehicleFieldsClient,
} from "@/lib/vehicles-client";
import {
  calcPurchasePaymentSummary,
  COST_CATEGORY_LABELS,
  formatBaht,
  PURCHASE_TYPE_LABELS,
  summarizeVehicleEconomics,
  VEHICLE_STATUS_LABELS,
} from "@/lib/vehicles/calc";
import { createDocsForVehicleCostExpense } from "@/lib/vehicles/cost-expense-docs";
import { printLegalVehicleDocClient } from "@/lib/documents/legal-print-client";
import {
  ensureReceivingTicketClient,
  loadVehicleDocumentPack,
  type VehicleDocumentPack,
} from "@/lib/vehicles/document-pack";
import { reconcileVehiclePurchaseFromContractClient } from "@/lib/vehicles/purchase-amount-sync";

const inp =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

export function VehicleDetailClient({
  vehicle: initial,
  entities,
}: {
  vehicle: VehicleRecord;
  entities: EntityRecord[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [vehicle, setVehicle] = useState(initial);
  const [msg, setMsg] = useState<string | null>(null);
  const [msgOk, setMsgOk] = useState(true);
  const [payMsg, setPayMsg] = useState<string | null>(null);
  const [payMsgOk, setPayMsgOk] = useState(true);
  const [expectedSalePrice, setExpectedSalePrice] = useState(initial.expectedSalePrice);
  const [commissionAmount, setCommissionAmount] = useState(initial.commissionAmount);
  const [costCategory, setCostCategory] = useState<VehicleCostCategory>("PARTS");
  const [createPvNoBill, setCreatePvNoBill] = useState(false);
  const [costPostCash, setCostPostCash] = useState(true);
  const [costAccountId, setCostAccountId] = useState("");
  const [costHasVat, setCostHasVat] = useState(false);
  const [costHasWht, setCostHasWht] = useState(false);
  const [costAmount, setCostAmount] = useState("");
  const [costBillNo, setCostBillNo] = useState("");
  const [costReceiptNo, setCostReceiptNo] = useState("");
  const [costEntityId, setCostEntityId] = useState("");
  const [payCreatePv, setPayCreatePv] = useState(false);
  const [payAccountId, setPayAccountId] = useState("");
  const [payHasVat, setPayHasVat] = useState(false);
  const [payBillNo, setPayBillNo] = useState("");
  const [payReceiptNo, setPayReceiptNo] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [paySaving, setPaySaving] = useState(false);
  const [banks, setBanks] = useState<BankAccountRecord[]>([]);
  const [docPack, setDocPack] = useState<VehicleDocumentPack | null>(null);

  function reloadDocPack() {
    void loadVehicleDocumentPack(vehicle.id).then(async (pack) => {
      setDocPack(pack);
      const rec = await reconcileVehiclePurchaseFromContractClient(
        vehicle,
        pack.purchaseContract,
      );
      if (rec.synced) {
        setVehicle(rec.vehicle);
        flash(
          true,
          `ซิงก์ราคาซื้อจากสัญญาซื้อเป็น ฿${formatBaht(rec.contractAmount || 0)} แล้ว`,
        );
      }
    });
  }

  useEffect(() => {
    reloadDocPack();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when vehicle id changes
  }, [vehicle.id]);

  useEffect(() => {
    void listBankAccountsClient().then((rows) => {
      setBanks(rows);
      const primary = rows.find((b) => b.isPrimary && b.kind !== "CASH") || rows.find((b) => b.kind !== "CASH");
      const fallback = primary?.id || CASH_ACCOUNT_ID;
      setPayAccountId((prev) => prev || fallback);
      setCostAccountId((prev) => prev || fallback);
    });
  }, []);

  useEffect(() => {
    setPayHasVat(vehicle.purchaseType === "COMPANY_VAT_7");
  }, [vehicle.purchaseType]);

  useEffect(() => {
    setCostHasWht(costCategory === "LABOR");
    setCreatePvNoBill(false);
  }, [costCategory]);

  const payAccountOptions = useMemo(() => {
    const opts: { id: string; label: string }[] = [
      { id: CASH_ACCOUNT_ID, label: "เงินสดหน้าร้าน" },
    ];
    for (const b of banks) {
      if (b.kind === "CASH") {
        opts.push({ id: b.id, label: `เงินสด · ${b.accountName}` });
      } else {
        opts.push({
          id: b.id,
          label: `${b.bankName} ${b.accountNumber}${b.isPrimary ? " (หลัก)" : ""}`,
        });
      }
    }
    return opts;
  }, [banks]);

  const costPartner = useMemo(
    () => entities.find((e) => e.id === costEntityId) || null,
    [entities, costEntityId],
  );

  const costWhtPreview = useMemo(() => {
    const gross = Number(String(costAmount).replace(/,/g, "")) || 0;
    if (!costHasWht || !costPartner || gross <= 0) {
      return { gross, wht: 0, net: gross };
    }
    const rate = Number(String(costPartner.defaultWhtPercent || "3").replace(/,/g, "")) || 0;
    const wht = calcWithholdingTotals({
      base: gross,
      vatRatePercent: 0,
      whtRatePercent: rate,
    }).withholdingAmount;
    return { gross, wht, net: Math.max(0, gross - wht) };
  }, [costAmount, costHasWht, costPartner]);

  const eco = useMemo(
    () =>
      summarizeVehicleEconomics({
        ...vehicle,
        expectedSalePrice,
        commissionAmount,
      }),
    [vehicle, expectedSalePrice, commissionAmount],
  );

  const seller = entities.find((e) => e.id === vehicle.sellerEntityId);
  const buyer = entities.find((e) => e.id === vehicle.buyerEntityId);
  const paySummary = useMemo(() => calcPurchasePaymentSummary(vehicle), [vehicle]);

  useEffect(() => {
    if (paySummary.remaining > 0) {
      setPayAmount((prev) => {
        if (prev.trim()) return prev;
        return String(paySummary.remaining);
      });
    }
  }, [paySummary.remaining]);

  async function onSavePurchasePayment() {
    const amountNum = Number(String(payAmount).replace(/,/g, "")) || 0;
    const billNo = payBillNo.trim();
    const receiptNo = payReceiptNo.trim();
    setPayMsg(null);

    if (amountNum <= 0) {
      setPayMsgOk(false);
      setPayMsg("กรอกจำนวนที่จ่าย");
      return;
    }
    if (amountNum > paySummary.remaining + 0.001) {
      setPayMsgOk(false);
      setPayMsg(`จ่ายเกินยอดคงค้าง (คงเหลือ ฿${formatBaht(paySummary.remaining)})`);
      return;
    }
    if (payHasVat) {
      if (!billNo) {
        setPayMsgOk(false);
        setPayMsg("มี VAT — กรอกเลขที่บิล / ใบกำกับภาษี");
        return;
      }
      if (!receiptNo) {
        setPayMsgOk(false);
        setPayMsg("มี VAT — กรอกเลขที่ใบเสร็จ");
        return;
      }
    }
    if (payCreatePv && !payHasVat && !billNo && !vehicle.sellerEntityId) {
      setPayMsgOk(false);
      setPayMsg("สร้างใบสำคัญจ่ายต้องมีผู้ขาย");
      return;
    }
    if (!payAccountId) {
      setPayMsgOk(false);
      setPayMsg("เลือกบัญชีที่ตัดเงิน");
      return;
    }

    setPaySaving(true);
    try {
      const channel = channelForAccountId(payAccountId, banks);
      const bankAccountId = payAccountId === CASH_ACCOUNT_ID ? null : payAccountId;
      const entryDate =
        (document.getElementById("pay-entry-date") as HTMLInputElement | null)?.value ||
        new Date().toISOString().slice(0, 10);

      const res = await addVehiclePurchasePaymentClient(vehicle.id, {
        date: entryDate,
        amount: amountNum,
        billNo: billNo || null,
        receiptNo: receiptNo || null,
        createPaymentVoucher: payCreatePv && !payHasVat,
        hasVat: payHasVat,
        channel,
        bankAccountId,
      });
      if (!res.ok) {
        setPayMsgOk(false);
        setPayMsg(res.message || "บันทึกไม่สำเร็จ");
        return;
      }

      setVehicle(res.vehicle);
      setPayCreatePv(false);
      setPayBillNo("");
      setPayReceiptNo("");
      setPayAmount("");
      const okText =
        res.remaining > 0
          ? `บันทึกจ่ายแล้ว · คงค้าง ฿${formatBaht(res.remaining)}`
          : "จ่ายครบมูลค่าสัญญาแล้ว";
      setPayMsgOk(true);
      setPayMsg(okText);
      flash(true, `${okText} — กำลังกลับหน้ารถยนต์และต้นทุน…`);
      router.push("/vehicles");
      router.refresh();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setPayMsgOk(false);
      setPayMsg(`เกิดข้อผิดพลาด: ${message}`);
      console.error("[onSavePurchasePayment]", e);
    } finally {
      setPaySaving(false);
    }
  }

  const partnerOptions = useMemo(() => {
    if (costCategory === "LABOR") {
      return entities.filter(
        (e) =>
          entityHasRoleGroup(e.roles, "CONTRACTOR") ||
          entityHasRoleGroup(e.roles, "SELLER_SUPPLIER"),
      );
    }
    if (costCategory === "PARTS" || costCategory === "REPAIR") {
      return entities.filter((e) => entityHasRoleGroup(e.roles, "SELLER_SUPPLIER"));
    }
    return entities;
  }, [entities, costCategory]);

  function flash(ok: boolean, text: string) {
    setMsgOk(ok);
    setMsg(text);
  }

  function printDoc(documentId: string) {
    startTransition(async () => {
      const res = await printDocumentClient(documentId);
      if (!res.ok) flash(false, res.message);
    });
  }

  function savePricing() {
    startTransition(async () => {
      const res = await updateVehicleFieldsClient(vehicle.id, {
        expectedSalePrice,
        commissionAmount,
      });
      if (!res.ok) {
        flash(false, res.message);
        return;
      }
      setVehicle((v) => ({ ...v, expectedSalePrice, commissionAmount }));
      flash(true, "อัปเดตราคาตั้งขายแล้ว");
    });
  }

  function addCost(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const category =
      (String(fd.get("category") ?? costCategory) as VehicleCostCategory) || "PARTS";
    const date = String(fd.get("date") ?? new Date().toISOString().slice(0, 10));
    const description = String(fd.get("description") ?? "");
    const amount = String(fd.get("amount") ?? costAmount ?? "0");
    const entityId = costEntityId.trim() || null;
    const billNo = costBillNo.trim();
    const receiptNo = costReceiptNo.trim();
    const entity = entityId ? entities.find((x) => x.id === entityId) || null : null;
    const vehicleLabel =
      `${vehicle.code || ""} ${vehicle.brand} ${vehicle.model} ${vehicle.licensePlate || ""}`.trim();
    const postCash = costPostCash;

    startTransition(async () => {
      if (category === "LABOR" && !entity) {
        flash(false, "ค่าแรงต้องเลือกคู่ค้า");
        return;
      }
      if (costHasWht && !entity) {
        flash(false, "หัก ณ ที่จ่ายต้องเลือกคู่ค้า");
        return;
      }
      if (
        (category === "PARTS" || category === "REPAIR") &&
        !billNo &&
        !receiptNo &&
        createPvNoBill &&
        !entity
      ) {
        flash(false, "ไม่มีเลขบิล — เลือกคู่ค้าเพื่อสร้างใบสำคัญจ่าย");
        return;
      }
      if (postCash && !costAccountId) {
        flash(false, "เลือกบัญชีที่ตัดเงิน");
        return;
      }
      if (costHasVat) {
        if (!billNo) {
          flash(false, "มี VAT — กรอกเลขที่บิล / ใบกำกับภาษี");
          return;
        }
        if (!receiptNo) {
          flash(false, "มี VAT — กรอกเลขที่ใบเสร็จ");
          return;
        }
      }

      const channel = channelForAccountId(costAccountId || CASH_ACCOUNT_ID, banks);
      const bankAccountId =
        !costAccountId || costAccountId === CASH_ACCOUNT_ID ? null : costAccountId;

      const docs = await createDocsForVehicleCostExpense({
        category,
        amount,
        date,
        description,
        entity,
        billNo,
        receiptNo,
        createPaymentVoucher: createPvNoBill && !costHasVat,
        withholdingEnabled: costHasWht,
        vehicleId: vehicle.id,
        vehicleLabel,
        channel,
      });
      if (!docs.ok) {
        flash(false, docs.message);
        return;
      }

      const docRef = [billNo && `บิล ${billNo}`, receiptNo && `ใบเสร็จ ${receiptNo}`]
        .filter(Boolean)
        .join(" · ");

      const res = await addVehicleCostLineClient(
        vehicle.id,
        {
          date,
          category,
          description,
          amount,
          entityId,
          billNo: docRef || billNo || null,
          documentId: docs.paymentVoucherDocumentId,
          withholdingDocumentId: docs.withholdingDocumentId,
          paymentVoucherDocumentId: docs.paymentVoucherDocumentId,
        },
        {
          postCashbook: postCash,
          cashOutAmount: docs.cashOutAmount,
          withholdingAmount: docs.withholdingAmount,
          withholdingDocumentNumber: docs.withholdingDocumentNumber,
          paymentVoucherDocumentNumber: docs.paymentVoucherDocumentNumber,
          channel,
          bankAccountId,
          vatType: costHasVat ? "FULL_VAT" : "NO_VAT",
        },
      );
      if (!res.ok) {
        flash(false, res.message);
        return;
      }
      setVehicle(res.vehicle);
      const parts: string[] = ["เพิ่มต้นทุนสะสมแล้ว"];
      if (docs.withholdingDocumentNumber) {
        parts.push(`หัก ณ ที่จ่าย ${docs.withholdingDocumentNumber}`);
      }
      if (docs.withholdingAmount > 0 && postCash) {
        parts.push(
          `ตัดบัญชี ฿${docs.cashOutAmount.toLocaleString("th-TH", { minimumFractionDigits: 2 })}`,
        );
      } else if (postCash) {
        parts.push(
          `ตัดบัญชี ฿${docs.cashOutAmount.toLocaleString("th-TH", { minimumFractionDigits: 2 })}`,
        );
      }
      if (docs.paymentVoucherDocumentNumber) {
        parts.push(`ใบสำคัญจ่าย ${docs.paymentVoucherDocumentNumber}`);
      }
      flash(true, parts.join(" · "));
      form.reset();
      setCostCategory("PARTS");
      setCreatePvNoBill(false);
      setCostHasVat(false);
      setCostHasWht(false);
      setCostAmount("");
      setCostBillNo("");
      setCostReceiptNo("");
      setCostEntityId("");
      setCostPostCash(true);
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/vehicles" className="text-sm text-blue-800 hover:underline">
            ← รถยนต์และต้นทุน
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">
            {vehicle.brand} {vehicle.model}
          </h1>
          <p className="text-sm text-slate-600">
            {vehicle.code} · {vehicle.licensePlate || "ไม่มีทะเบียน"} · VIN {vehicle.vin || "—"}
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700">
          {VEHICLE_STATUS_LABELS[vehicle.status]}
        </span>
      </div>

      {msg && (
        <p
          className={
            msgOk
              ? "rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
              : "rounded-md bg-red-50 px-3 py-2 text-sm text-red-700"
          }
        >
          {msg}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:col-span-1">
          <p className="text-sm text-slate-500">ต้นทุนรวมปัจจุบัน (Real-time)</p>
          <p className="mt-1 text-3xl font-bold tabular-nums text-slate-900">
            ฿{formatBaht(eco.totalCost)}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            ซื้อเข้า ฿{formatBaht(Number(vehicle.purchasePrice) || 0)} + สะสม ฿
            {formatBaht(eco.totalCost - (Number(vehicle.purchasePrice) || 0))}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:col-span-2">
          <p className="mb-3 text-sm font-semibold text-slate-800">ราคาตั้งขาย / ค่าคอม / กำไรขั้นต้น</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">ราคาตั้งขาย</span>
              <input
                className={inp}
                value={expectedSalePrice}
                onChange={(e) => setExpectedSalePrice(e.target.value)}
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">หักค่าคอมมิชชั่น</span>
              <input
                className={inp}
                value={commissionAmount}
                onChange={(e) => setCommissionAmount(e.target.value)}
              />
            </label>
            <div>
              <p className="mb-1 text-sm text-slate-600">กำไรขั้นต้นประมาณ</p>
              <p
                className={
                  eco.grossProfit >= 0
                    ? "text-2xl font-bold tabular-nums text-emerald-700"
                    : "text-2xl font-bold tabular-nums text-red-600"
                }
              >
                ฿{formatBaht(eco.grossProfit)}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500">ราคาก่อนภาษี − ต้นทุนไม่รวมภาษี − คอม</p>
            </div>
          </div>
          {eco.saleVat && (
            <div className="mt-3 space-y-1 rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              <p>
                ราคาตั้งขายรวม VAT ฿{formatBaht(eco.saleVat.salePriceInclusive)} = ก่อน VAT ฿
                {formatBaht(eco.saleVat.priceBeforeVat)} + VAT 7% ฿{formatBaht(eco.saleVat.vatAmount)}
              </p>
              <p>
                VAT นำส่ง (ภ.พ.30) ฿{formatBaht(eco.saleVat.vatAmount)}
                {vehicle.purchaseType === "INDIVIDUAL_NO_VAT"
                  ? " · ภาษีซื้อ ≈ 0 (ซื้อจากบุคคลไม่มีใบกำกับ)"
                  : ""}
              </p>
            </div>
          )}
          <button
            type="button"
            onClick={savePricing}
            disabled={pending}
            className="mt-3 rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-50"
          >
            บันทึกราคาตั้งขาย
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <form onSubmit={addCost} className="space-y-3 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-slate-900">เพิ่มต้นทุนสะสม</h2>
          <p className="text-xs text-slate-500">
            ต้นทุนรถเก็บยอดเต็ม — ถ้าหัก ณ ที่จ่าย ยอดตัดสมุดเงินสดจะเป็นยอดสุทธิหลังหัก
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">วันที่</span>
              <input
                name="date"
                type="date"
                className={inp}
                defaultValue={new Date().toISOString().slice(0, 10)}
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">หมวด</span>
              <select
                name="category"
                className={inp}
                value={costCategory}
                onChange={(e) => setCostCategory(e.target.value as VehicleCostCategory)}
              >
                {(Object.keys(COST_CATEGORY_LABELS) as VehicleCostCategory[]).map((k) => (
                  <option key={k} value={k}>
                    {COST_CATEGORY_LABELS[k]}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block text-slate-600">
                คู่ค้า {costCategory === "LABOR" || costHasWht ? "*" : ""}
              </span>
              <select
                name="entityId"
                className={inp}
                value={costEntityId}
                onChange={(e) => setCostEntityId(e.target.value)}
                required={costCategory === "LABOR" || costHasWht || createPvNoBill}
              >
                <option value="">— เลือกคู่ค้า —</option>
                {partnerOptions.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                    {e.defaultWhtPercent ? ` (หัก ${e.defaultWhtPercent}%)` : ""}
                  </option>
                ))}
              </select>
              {partnerOptions.length === 0 && (
                <span className="mt-1 block text-xs text-amber-700">
                  ยังไม่มีคู่ค้าในบทบาทที่เหมาะสม — เพิ่มที่เมนูคู่ค้าก่อน
                </span>
              )}
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block text-slate-600">รายละเอียด</span>
              <input name="description" className={inp} placeholder="เช่น แบตเตอรี่, ค่าแรงเปลี่ยนยาง" required />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">จำนวนเงิน (ต้นทุน) *</span>
              <input
                name="amount"
                className={inp}
                required
                value={costAmount}
                onChange={(e) => setCostAmount(e.target.value)}
                placeholder="0.00"
              />
            </label>
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              <p>
                ตัดบัญชี:{" "}
                <span className="font-semibold tabular-nums text-slate-900">
                  ฿{formatBaht(costWhtPreview.net)}
                </span>
              </p>
              {costHasWht && costWhtPreview.wht > 0 ? (
                <p className="mt-0.5">
                  ยอดเต็ม ฿{formatBaht(costWhtPreview.gross)} − หัก{" "}
                  {costPartner?.defaultWhtPercent || "3"}% = ฿{formatBaht(costWhtPreview.wht)}
                </p>
              ) : (
                <p className="mt-0.5">ยังไม่หัก ณ ที่จ่าย — ตัดตามยอดเต็ม</p>
              )}
            </div>

            <fieldset className="sm:col-span-2 space-y-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-3">
              <legend className="px-1 text-sm font-medium text-slate-800">ภาษีมูลค่าเพิ่ม</legend>
              <div className="flex flex-wrap gap-4 text-sm">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    checked={!costHasVat}
                    onChange={() => setCostHasVat(false)}
                  />
                  ไม่มี VAT
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    checked={costHasVat}
                    onChange={() => {
                      setCostHasVat(true);
                      setCreatePvNoBill(false);
                    }}
                  />
                  มี VAT
                </label>
              </div>
              {costHasVat ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-sm">
                    <span className="mb-1 block text-slate-600">เลขที่บิล / ใบกำกับ *</span>
                    <input
                      className={inp}
                      value={costBillNo}
                      onChange={(e) => setCostBillNo(e.target.value)}
                      required
                    />
                  </label>
                  <label className="text-sm">
                    <span className="mb-1 block text-slate-600">เลขที่ใบเสร็จ *</span>
                    <input
                      className={inp}
                      value={costReceiptNo}
                      onChange={(e) => setCostReceiptNo(e.target.value)}
                      required
                    />
                  </label>
                </div>
              ) : (costCategory === "PARTS" || costCategory === "REPAIR") ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-sm">
                    <span className="mb-1 block text-slate-600">เลขที่เอกสาร (ถ้ามี)</span>
                    <input
                      className={inp}
                      value={costBillNo}
                      onChange={(e) => setCostBillNo(e.target.value)}
                      placeholder="เช่น INV-001"
                      disabled={createPvNoBill}
                    />
                  </label>
                  <label className="flex items-end gap-2 pb-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={createPvNoBill}
                      onChange={(e) => setCreatePvNoBill(e.target.checked)}
                    />
                    ไม่มีบิล — สร้างใบสำคัญจ่าย
                  </label>
                </div>
              ) : null}
            </fieldset>

            <fieldset className="sm:col-span-2 space-y-2 rounded-md border border-amber-200 bg-amber-50/50 px-3 py-3">
              <legend className="px-1 text-sm font-medium text-slate-800">หักภาษี ณ ที่จ่าย</legend>
              <div className="flex flex-wrap gap-4 text-sm">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    checked={!costHasWht}
                    onChange={() => setCostHasWht(false)}
                  />
                  ไม่มีหัก ณ ที่จ่าย
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    checked={costHasWht}
                    onChange={() => setCostHasWht(true)}
                  />
                  มีหัก ณ ที่จ่าย
                </label>
              </div>
              {costHasWht && (
                <p className="text-xs text-amber-900">
                  จะสร้างใบสำคัญจ่าย + ใบหัก ณ ที่จ่าย ตามอัตราของคู่ค้า (
                  {costPartner?.defaultWhtPercent || "3"}%) — ยอดตัดบัญชี = ยอดต้นทุน − ยอดหัก
                </p>
              )}
            </fieldset>

            <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
              <input
                type="checkbox"
                checked={costPostCash}
                onChange={(e) => setCostPostCash(e.target.checked)}
              />
              ลงสมุดเงินสดด้วย (จ่ายออก)
            </label>
            {costPostCash && (
              <label className="text-sm sm:col-span-2">
                <span className="mb-1 block text-slate-600">ตัดเงินจากบัญชี *</span>
                <select
                  className={inp}
                  value={costAccountId}
                  onChange={(e) => setCostAccountId(e.target.value)}
                  required
                >
                  {payAccountOptions.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
          >
            {pending ? "กำลังบันทึก…" : "+ เพิ่มต้นทุนสะสม"}
          </button>
        </form>

        <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-slate-900">ข้อมูลรถ / การซื้อ</h2>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
            <dt className="text-slate-500">ประเภทซื้อ</dt>
            <dd>{PURCHASE_TYPE_LABELS[vehicle.purchaseType]}</dd>
            <dt className="text-slate-500">ผู้ขาย</dt>
            <dd>{seller?.name || "—"}</dd>
            <dt className="text-slate-500">วันที่ซื้อ</dt>
            <dd>{formatDateThBE(vehicle.purchaseDate)}</dd>
            <dt className="text-slate-500">มูลค่าสัญญา</dt>
            <dd className="tabular-nums">
              ฿{formatBaht(paySummary.obligation)}
              {docPack?.purchaseContract ? (
                <span className="ml-1 text-xs font-normal text-slate-500">
                  ({docPack.purchaseContract.number}
                  {parseAmount(docPack.purchaseContract.amount) > 0 &&
                  parseAmount(docPack.purchaseContract.amount) !== paySummary.obligation
                    ? " · ยังไม่ตรงกับสัญญา — เปิดแก้ไขสัญญาแล้วกดบันทึกอีกครั้ง"
                    : ""}
                  )
                </span>
              ) : null}
            </dd>
            <dt className="text-slate-500">จ่ายแล้ว / คงค้าง</dt>
            <dd className="tabular-nums">
              ฿{formatBaht(paySummary.paid)}
              <span className={paySummary.remaining > 0 ? " text-amber-700" : " text-emerald-700"}>
                {" "}
                · คงค้าง ฿{formatBaht(paySummary.remaining)}
              </span>
            </dd>
            <dt className="text-slate-500">ผู้ซื้อ (ถ้าขายแล้ว)</dt>
            <dd>{buyer?.name || "—"}</dd>
            <dt className="text-slate-500">สี / ปี / ไมล์</dt>
            <dd>
              {vehicle.color || "—"} / {vehicle.year || "—"} / {vehicle.mileage || "—"}
            </dd>
          </dl>
          <div className="space-y-2 pt-2">
            <p className="text-xs font-medium text-slate-700">เอกสารประกอบ (ซื้อ → ขาย → กำกับ → เสร็จ)</p>
            <ul className="space-y-1 text-xs text-slate-600">
              <li>
                สัญญาซื้อ:{" "}
                {docPack?.purchaseContract ? (
                  <span className="text-emerald-700">{docPack.purchaseContract.number}</span>
                ) : (
                  <span className="text-amber-700">ยังไม่มี</span>
                )}
              </li>
              <li>
                สัญญาขาย:{" "}
                {docPack?.saleContract ? (
                  <span className="text-emerald-700">{docPack.saleContract.number}</span>
                ) : (
                  <span className="text-slate-500">ยังไม่มี</span>
                )}
              </li>
              <li>
                ใบกำกับภาษี:{" "}
                {docPack && docPack.taxInvoices.length > 0 ? (
                  <span className="text-emerald-700">
                    {docPack.taxInvoices.map((t) => t.number || t.id).join(", ")}
                  </span>
                ) : (
                  <span className="text-slate-500">ยังไม่มี</span>
                )}
              </li>
              <li>
                ใบเสร็จ:{" "}
                {docPack && docPack.receipts.length > 0 ? (
                  <span className="text-emerald-700">
                    {docPack.receipts.map((t) => t.number || t.id).join(", ")}
                  </span>
                ) : (
                  <span className="text-slate-500">ยังไม่มี</span>
                )}
              </li>
            </ul>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/documents/purchase-contract/new?vehicleId=${vehicle.id}`}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
              >
                {docPack?.purchaseContract ? "แก้ไข/พิมพ์สัญญาซื้อ" : "สร้างสัญญาซื้อ"}
              </Link>
              <button
                type="button"
                disabled={pending}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50"
                onClick={() => {
                  startTransition(async () => {
                    const res = await ensureReceivingTicketClient(vehicle);
                    if (!res.ok) {
                      flash(false, res.message);
                      return;
                    }
                    reloadDocPack();
                    const printed = await printLegalVehicleDocClient("receiving", vehicle.id);
                    if (!printed.ok) {
                      flash(false, printed.message);
                      return;
                    }
                    flash(true, `บันทึกใบรับรถ ${res.number} — เปิดพิมพ์แล้ว`);
                  });
                }}
              >
                {docPack?.receivingTicket ? "พิมพ์ใบรับรถ" : "สร้าง+พิมพ์ใบรับรถ"}
              </button>
              <Link
                href={`/documents/vehicle-sale/new?vehicleId=${vehicle.id}`}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
              >
                {docPack?.saleContract ? "แก้ไขสัญญาขาย" : "สร้างสัญญาขาย"}
              </Link>
              {docPack?.saleContract ? (
                <Link
                  href={`/documents/tax-invoice/new?vehicleId=${vehicle.id}`}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
                >
                  ออกใบกำกับภาษี
                </Link>
              ) : (
                <button
                  type="button"
                  disabled
                  title="ต้องมีสัญญาขายก่อน"
                  className="cursor-not-allowed rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-400"
                >
                  ออกใบกำกับภาษี
                </button>
              )}
              {docPack && docPack.taxInvoices[0] ? (
                <Link
                  href={`/documents/receipt/new?taxInvoiceId=${docPack.taxInvoices[0].id}&vehicleId=${vehicle.id}`}
                  className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-800"
                >
                  ออกใบเสร็จ (อ้างอิงใบกำกับ)
                </Link>
              ) : (
                <button
                  type="button"
                  disabled
                  title="ต้องมีใบกำกับภาษีก่อน"
                  className="cursor-not-allowed rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-400"
                >
                  ออกใบเสร็จ
                </button>
              )}
            </div>
            <p className="text-[11px] text-slate-500">
              ลำดับ: สัญญาซื้อ → สัญญาขาย → ใบกำกับภาษี → ใบเสร็จรับเงิน (ลงสมุดเงินสดอัตโนมัติเมื่อออกใบเสร็จ)
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50/30 p-5 shadow-sm">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="font-semibold text-slate-900">จ่ายค่าซื้อรถ</h2>
            <p className="text-xs text-slate-600">
              สัญญา ฿{formatBaht(paySummary.obligation)} · จ่ายแล้ว ฿{formatBaht(paySummary.paid)} · คงค้าง{" "}
              <span className="font-semibold text-amber-800">฿{formatBaht(paySummary.remaining)}</span>
            </p>
          </div>
        </div>

        {(vehicle.purchasePayments?.length ?? 0) > 0 && (
          <div className="mb-4 overflow-x-auto rounded-md border border-slate-200 bg-white">
            <table className="min-w-full text-sm">
              <thead className="border-b bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-3 py-2">วันที่</th>
                  <th className="px-3 py-2">จำนวน</th>
                  <th className="px-3 py-2">เอกสาร</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {vehicle.purchasePayments.map((p) => (
                  <tr key={p.id} className="border-b border-slate-100">
                    <td className="px-3 py-2">{formatDateThBE(p.date)}</td>
                    <td className="px-3 py-2 tabular-nums">฿{formatBaht(Number(p.amount) || 0)}</td>
                    <td className="px-3 py-2 text-xs text-slate-600">
                      {p.billNo || p.receiptNo
                        ? [p.billNo && `บิล ${p.billNo}`, p.receiptNo && `ใบเสร็จ ${p.receiptNo}`]
                            .filter(Boolean)
                            .join(" · ")
                        : p.paymentVoucherDocumentNumber
                          ? `ใบสำคัญจ่าย ${p.paymentVoucherDocumentNumber}`
                          : "—"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {p.paymentVoucherDocumentId && (
                        <PrintDocIconButton
                          label="จ่าย"
                          disabled={pending}
                          onClick={() => printDoc(p.paymentVoucherDocumentId!)}
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {paySummary.remaining > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {payMsg && (
              <p
                className={
                  payMsgOk
                    ? "sm:col-span-2 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
                    : "sm:col-span-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700"
                }
              >
                {payMsg}
              </p>
            )}
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">วันที่จ่าย</span>
              <input
                id="pay-entry-date"
                type="date"
                className={inp}
                defaultValue={new Date().toISOString().slice(0, 10)}
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">จำนวนที่จ่าย (บาท)</span>
              <input
                className={inp}
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                placeholder={`สูงสุด ${formatBaht(paySummary.remaining)}`}
              />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block text-slate-600">ตัดจากบัญชี *</span>
              <select
                className={inp}
                value={payAccountId}
                onChange={(e) => setPayAccountId(e.target.value)}
              >
                {payAccountOptions.length === 0 ? (
                  <option value="">กำลังโหลดบัญชี…</option>
                ) : (
                  payAccountOptions.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))
                )}
              </select>
            </label>
            <fieldset className="sm:col-span-2 space-y-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-3">
              <legend className="px-1 text-sm font-medium text-slate-800">ภาษีมูลค่าเพิ่ม</legend>
              <div className="flex flex-wrap gap-4 text-sm">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    checked={!payHasVat}
                    onChange={() => setPayHasVat(false)}
                  />
                  ไม่มี VAT
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    checked={payHasVat}
                    onChange={() => {
                      setPayHasVat(true);
                      setPayCreatePv(false);
                    }}
                  />
                  มี VAT
                </label>
              </div>
              {payHasVat ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-sm">
                    <span className="mb-1 block text-slate-600">เลขที่บิล / ใบกำกับ *</span>
                    <input
                      className={inp}
                      value={payBillNo}
                      onChange={(e) => setPayBillNo(e.target.value)}
                    />
                  </label>
                  <label className="text-sm">
                    <span className="mb-1 block text-slate-600">เลขที่ใบเสร็จ *</span>
                    <input
                      className={inp}
                      value={payReceiptNo}
                      onChange={(e) => setPayReceiptNo(e.target.value)}
                    />
                  </label>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-sm">
                    <span className="mb-1 block text-slate-600">เลขที่เอกสาร (ถ้ามี)</span>
                    <input
                      className={inp}
                      value={payBillNo}
                      onChange={(e) => setPayBillNo(e.target.value)}
                      disabled={payCreatePv}
                    />
                  </label>
                  <label className="flex items-end gap-2 pb-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={payCreatePv}
                      onChange={(e) => setPayCreatePv(e.target.checked)}
                    />
                    ไม่มีเอกสาร — สร้างใบสำคัญจ่าย
                  </label>
                </div>
              )}
            </fieldset>
            <div className="sm:col-span-2">
              <button
                type="button"
                disabled={paySaving || pending}
                onClick={() => void onSavePurchasePayment()}
                className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {paySaving ? "กำลังบันทึก…" : "บันทึกการจ่าย + ลงสมุดเงินสด"}
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-emerald-800">จ่ายครบมูลค่าสัญญาแล้ว — ไม่มียอดคงค้าง</p>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="border-b bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-3 py-2">วันที่</th>
              <th className="px-3 py-2">หมวด</th>
              <th className="px-3 py-2">รายละเอียด</th>
              <th className="px-3 py-2 text-right">จำนวน</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {vehicle.costLines.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                  ยังไม่มีต้นทุนสะสม
                </td>
              </tr>
            )}
            {vehicle.costLines.map((l) => {
              const partner = l.entityId ? entities.find((e) => e.id === l.entityId) : null;
              return (
                <tr key={l.id} className="border-b border-slate-100">
                  <td className="px-3 py-2">{formatDateThBE(l.date)}</td>
                  <td className="px-3 py-2">{COST_CATEGORY_LABELS[l.category] ?? l.category}</td>
                  <td className="px-3 py-2">
                    {l.description}
                    {partner && (
                      <span className="ml-1 text-xs text-slate-400">({partner.name})</span>
                    )}
                    {l.billNo && (
                      <span className="ml-1 text-xs text-slate-400">บิล {l.billNo}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatBaht(Number(l.amount) || 0)}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap items-center justify-end gap-1">
                      {l.withholdingDocumentId && (
                        <PrintDocIconButton
                          label="หัก"
                          disabled={pending}
                          onClick={() => printDoc(l.withholdingDocumentId!)}
                        />
                      )}
                      {l.paymentVoucherDocumentId && (
                        <PrintDocIconButton
                          label="จ่าย"
                          disabled={pending}
                          onClick={() => printDoc(l.paymentVoucherDocumentId!)}
                        />
                      )}
                      <button
                        type="button"
                        className="text-red-600 hover:underline disabled:opacity-50"
                        disabled={pending}
                        onClick={() => {
                          startTransition(async () => {
                            const res = await removeVehicleCostLineClient(vehicle.id, l.id);
                            if (!res.ok) {
                              flash(false, res.message);
                              return;
                            }
                            setVehicle(res.vehicle);
                            flash(true, "ลบต้นทุนแล้ว");
                          });
                        }}
                      >
                        ลบ
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <form
        className="space-y-3 rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          startTransition(async () => {
            const res = await saveVehicleClient({
              id: vehicle.id,
              code: vehicle.code,
              licensePlate: vehicle.licensePlate,
              brand: vehicle.brand,
              model: vehicle.model,
              year: vehicle.year,
              color: vehicle.color,
              vin: vehicle.vin,
              engineNo: vehicle.engineNo,
              mileage: vehicle.mileage,
              status: (String(fd.get("status") ?? vehicle.status) as VehicleStatus) || vehicle.status,
              purchaseType: vehicle.purchaseType,
              sellerEntityId: vehicle.sellerEntityId,
              purchaseDate: vehicle.purchaseDate,
              purchasePrice: vehicle.purchasePrice,
              purchaseContractAmount: vehicle.purchaseContractAmount,
              purchasePayments: vehicle.purchasePayments ?? [],
              saleContractAmount: vehicle.saleContractAmount,
              costLines: vehicle.costLines,
              expectedSalePrice,
              commissionAmount,
              soldDate: vehicle.soldDate,
              soldPrice: vehicle.soldPrice,
              buyerEntityId: vehicle.buyerEntityId,
              notes: String(fd.get("notes") ?? ""),
            });
            if (!res.ok) {
              flash(false, res.message);
              return;
            }
            setVehicle((v) => ({
              ...v,
              status: (String(fd.get("status") ?? v.status) as VehicleStatus) || v.status,
              notes: String(fd.get("notes") ?? ""),
              expectedSalePrice,
              commissionAmount,
            }));
            flash(true, "บันทึกข้อมูลรถแล้ว");
          });
        }}
      >
        <h2 className="font-semibold text-slate-900">อัปเดตสถานะ / หมายเหตุ</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">สถานะ</span>
            <select name="status" className={inp} defaultValue={vehicle.status}>
              {Object.entries(VEHICLE_STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="mb-1 block text-slate-600">หมายเหตุ</span>
            <input name="notes" className={inp} defaultValue={vehicle.notes} />
          </label>
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
        >
          บันทึกสถานะ
        </button>
      </form>
    </div>
  );
}
