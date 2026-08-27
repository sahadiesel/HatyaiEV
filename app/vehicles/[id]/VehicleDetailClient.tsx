"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { PrintDocIconButton } from "@/components/PrintDocIconButton";
import { CASH_ACCOUNT_ID, channelForAccountId, listBankAccountsClient } from "@/lib/bank-accounts-client";
import { parseAmount } from "@/lib/documents/calc";
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

const inp =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

export function VehicleDetailClient({
  vehicle: initial,
  entities,
}: {
  vehicle: VehicleRecord;
  entities: EntityRecord[];
}) {
  const [pending, startTransition] = useTransition();
  const [vehicle, setVehicle] = useState(initial);
  const [msg, setMsg] = useState<string | null>(null);
  const [msgOk, setMsgOk] = useState(true);
  const [expectedSalePrice, setExpectedSalePrice] = useState(initial.expectedSalePrice);
  const [commissionAmount, setCommissionAmount] = useState(initial.commissionAmount);
  const [costCategory, setCostCategory] = useState<VehicleCostCategory>("PARTS");
  const [createPvNoBill, setCreatePvNoBill] = useState(false);
  const [payCreatePv, setPayCreatePv] = useState(false);
  const [payAccountId, setPayAccountId] = useState("");
  const [banks, setBanks] = useState<BankAccountRecord[]>([]);
  const [docPack, setDocPack] = useState<VehicleDocumentPack | null>(null);

  function reloadDocPack() {
    void loadVehicleDocumentPack(vehicle.id).then(setDocPack);
  }

  useEffect(() => {
    reloadDocPack();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when vehicle id changes
  }, [vehicle.id]);

  useEffect(() => {
    void listBankAccountsClient().then((rows) => {
      setBanks(rows);
      const primary = rows.find((b) => b.isPrimary && b.kind !== "CASH") || rows.find((b) => b.kind !== "CASH");
      setPayAccountId((prev) => prev || primary?.id || CASH_ACCOUNT_ID);
    });
  }, []);

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
    const amount = String(fd.get("amount") ?? "0");
    const entityId = String(fd.get("entityId") ?? "").trim() || null;
    const billNo = String(fd.get("billNo") ?? "").trim();
    const entity = entityId ? entities.find((x) => x.id === entityId) || null : null;
    const vehicleLabel =
      `${vehicle.code || ""} ${vehicle.brand} ${vehicle.model} ${vehicle.licensePlate || ""}`.trim();

    startTransition(async () => {
      if (category === "LABOR" && !entity) {
        flash(false, "ค่าแรงต้องเลือกคู่ค้า");
        return;
      }
      if ((category === "PARTS" || category === "REPAIR") && !billNo && createPvNoBill && !entity) {
        flash(false, "ไม่มีเลขบิล — เลือกคู่ค้าเพื่อสร้างใบสำคัญจ่าย");
        return;
      }

      const docs = await createDocsForVehicleCostExpense({
        category,
        amount,
        date,
        description,
        entity,
        billNo,
        createPaymentVoucher: createPvNoBill,
        vehicleId: vehicle.id,
        vehicleLabel,
      });
      if (!docs.ok) {
        flash(false, docs.message);
        return;
      }

      const res = await addVehicleCostLineClient(
        vehicle.id,
        {
          date,
          category,
          description,
          amount,
          entityId,
          billNo: billNo || null,
          documentId: docs.paymentVoucherDocumentId,
          withholdingDocumentId: docs.withholdingDocumentId,
          paymentVoucherDocumentId: docs.paymentVoucherDocumentId,
        },
        {
          postCashbook: fd.get("postCash") === "1",
          cashOutAmount: docs.cashOutAmount,
          withholdingAmount: docs.withholdingAmount,
          withholdingDocumentNumber: docs.withholdingDocumentNumber,
          paymentVoucherDocumentNumber: docs.paymentVoucherDocumentNumber,
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
        if (docs.withholdingAmount > 0) {
          parts.push(
            `ตัดบัญชี ฿${docs.cashOutAmount.toLocaleString("th-TH", { minimumFractionDigits: 2 })}`,
          );
        }
      }
      if (docs.paymentVoucherDocumentNumber) {
        parts.push(`ใบสำคัญจ่าย ${docs.paymentVoucherDocumentNumber}`);
      }
      flash(true, parts.join(" · "));
      form.reset();
      setCostCategory("PARTS");
      setCreatePvNoBill(false);
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
            </div>
          </div>
          {eco.saleVat && (
            <p className="mt-3 text-xs text-slate-500">
              VAT เมื่อขาย ({eco.saleVat.scheme === "MARGIN" ? "Margin Scheme ป.111" : "ยอดขายเต็ม"}): ฿
              {formatBaht(eco.saleVat.vatAmount)} · ฐานภาษี ฿{formatBaht(eco.saleVat.taxableBase)}
            </p>
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
            ค่าแรง → สร้างใบสำคัญจ่าย (+ ใบหัก ณ ที่จ่ายอัตโนมัติ) · อะไหล่ → บันทึกเลขบิล หรือสร้างใบสำคัญจ่ายเมื่อไม่มีบิล
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
                onChange={(e) => {
                  setCostCategory(e.target.value as VehicleCostCategory);
                  setCreatePvNoBill(false);
                }}
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
                คู่ค้า {costCategory === "LABOR" ? "*" : ""}
              </span>
              <select
                key={`${costCategory}-${createPvNoBill}`}
                name="entityId"
                className={inp}
                required={costCategory === "LABOR" || createPvNoBill}
                defaultValue=""
              >
                <option value="">— เลือกคู่ค้า —</option>
                {partnerOptions.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
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
              <span className="mb-1 block text-slate-600">จำนวนเงิน</span>
              <input name="amount" className={inp} required defaultValue="0" />
            </label>
            {(costCategory === "PARTS" || costCategory === "REPAIR") && (
              <label className="text-sm">
                <span className="mb-1 block text-slate-600">เลขที่บิล</span>
                <input
                  name="billNo"
                  className={inp}
                  placeholder="เช่น INV-001"
                  disabled={createPvNoBill}
                />
              </label>
            )}
            {costCategory === "LABOR" && (
              <p className="text-xs text-slate-600 sm:col-span-2">
                จะสร้างใบสำคัญจ่าย (+ ใบหัก ณ ที่จ่ายอัตโนมัติ ตามอัตราเริ่มต้นของคู่ค้า)
              </p>
            )}
            {(costCategory === "PARTS" || costCategory === "REPAIR") && (
              <label className="flex items-end gap-2 pb-2 text-sm text-slate-700 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={createPvNoBill}
                  onChange={(e) => setCreatePvNoBill(e.target.checked)}
                />
                ไม่มีบิล — สร้างใบสำคัญจ่าย
              </label>
            )}
            <label className="flex items-end gap-2 pb-2 text-sm text-slate-700 sm:col-span-2">
              <input type="checkbox" name="postCash" value="1" defaultChecked />
              ลงสมุดเงินสดด้วย (จ่ายออก)
            </label>
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
                      {p.billNo
                        ? `บิล ${p.billNo}`
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
          <form
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const fd = new FormData(form);
              const amount = String(fd.get("amount") ?? "0");
              const billNo = String(fd.get("billNo") ?? "").trim();
              startTransition(async () => {
                if (!docPack?.purchaseContract) {
                  flash(false, "ต้องสร้างสัญญาซื้อก่อนบันทึกการจ่ายค่าซื้อรถ");
                  return;
                }
                if (payCreatePv && !billNo && !vehicle.sellerEntityId) {
                  flash(false, "สร้างใบสำคัญจ่ายต้องมีผู้ขาย");
                  return;
                }
                if (!payAccountId) {
                  flash(false, "เลือกบัญชีที่ตัดเงิน");
                  return;
                }
                const channel = channelForAccountId(payAccountId, banks);
                const bankAccountId =
                  payAccountId === CASH_ACCOUNT_ID ? null : payAccountId;
                const res = await addVehiclePurchasePaymentClient(vehicle.id, {
                  date: String(fd.get("date") ?? "") || undefined,
                  amount,
                  billNo,
                  createPaymentVoucher: payCreatePv && !billNo,
                  channel,
                  bankAccountId,
                });
                if (!res.ok) {
                  flash(false, res.message);
                  return;
                }
                setVehicle(res.vehicle);
                setPayCreatePv(false);
                form.reset();
                flash(
                  true,
                  res.remaining > 0
                    ? `บันทึกจ่ายแล้ว · คงค้าง ฿${formatBaht(res.remaining)}`
                    : "จ่ายครบมูลค่าสัญญาแล้ว",
                );
              });
            }}
          >
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">วันที่จ่าย</span>
              <input
                name="date"
                type="date"
                className={inp}
                defaultValue={new Date().toISOString().slice(0, 10)}
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">จำนวนที่จ่าย (บาท)</span>
              <input
                name="amount"
                className={inp}
                required
                placeholder={`สูงสุด ${formatBaht(paySummary.remaining)}`}
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">ตัดจากบัญชี</span>
              <select
                className={inp}
                value={payAccountId}
                onChange={(e) => setPayAccountId(e.target.value)}
                required
              >
                {payAccountOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">เลขที่ใบเสร็จ / ใบกำกับ</span>
              <input
                name="billNo"
                className={inp}
                placeholder="ถ้ามีจากผู้ขาย"
                disabled={payCreatePv}
              />
            </label>
            <label className="flex items-end gap-2 pb-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={payCreatePv}
                onChange={(e) => setPayCreatePv(e.target.checked)}
              />
              ไม่มีใบเสร็จ/ใบกำกับ — สร้างใบสำคัญจ่าย
            </label>
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={pending}
                className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {pending ? "กำลังบันทึก…" : "บันทึกการจ่าย + ลงสมุดเงินสด"}
              </button>
            </div>
          </form>
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
