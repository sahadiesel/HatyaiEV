"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { BrandModelSelect } from "@/components/vehicles/BrandModelSelect";
import {
  CASH_ACCOUNT_ID,
  channelForAccountId,
  listBankAccountsClient,
} from "@/lib/bank-accounts-client";
import type {
  BankAccountRecord,
  EntityRecord,
  VehiclePurchaseType,
  VehicleStatus,
} from "@/lib/domain-types";
import { listEntitiesClient } from "@/lib/entities-client";
import {
  addVehiclePurchasePaymentClient,
  saveVehicleClient,
} from "@/lib/vehicles-client";
import { PURCHASE_TYPE_LABELS } from "@/lib/vehicles/calc";

const inp =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

export function NewVehicleForm({ entities }: { entities: EntityRecord[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [purchaseType, setPurchaseType] = useState<VehiclePurchaseType>("INDIVIDUAL_NO_VAT");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [entityOptions, setEntityOptions] = useState<EntityRecord[]>(entities);
  const [loadingEntities, setLoadingEntities] = useState(true);
  const [purchasePrice, setPurchasePrice] = useState("");
  const [contractAmount, setContractAmount] = useState("");
  const [payNow, setPayNow] = useState("");
  const [payTouched, setPayTouched] = useState(false);
  const [createPv, setCreatePv] = useState(false);
  const [hasVat, setHasVat] = useState(false);
  const [billNo, setBillNo] = useState("");
  const [receiptNo, setReceiptNo] = useState("");
  const [banks, setBanks] = useState<BankAccountRecord[]>([]);
  const [payAccountId, setPayAccountId] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoadingEntities(true);
    void listEntitiesClient().then((rows) => {
      if (cancelled) return;
      if (rows.length > 0) setEntityOptions(rows);
      else if (entities.length > 0) setEntityOptions(entities);
      setLoadingEntities(false);
    });
    return () => {
      cancelled = true;
    };
  }, [entities]);

  useEffect(() => {
    void listBankAccountsClient().then((rows) => {
      setBanks(rows);
      const primary =
        rows.find((b) => b.isPrimary && b.kind !== "CASH") ||
        rows.find((b) => b.kind !== "CASH");
      setPayAccountId((prev) => prev || primary?.id || CASH_ACCOUNT_ID);
    });
  }, []);

  useEffect(() => {
    setHasVat(purchaseType === "COMPANY_VAT_7");
    if (purchaseType === "COMPANY_VAT_7") setCreatePv(false);
  }, [purchaseType]);

  const obligation = useMemo(() => {
    const c = Number(String(contractAmount).replace(/,/g, "")) || 0;
    const p = Number(String(purchasePrice).replace(/,/g, "")) || 0;
    return c > 0 ? c : p;
  }, [contractAmount, purchasePrice]);

  useEffect(() => {
    if (!payTouched && obligation > 0) {
      setPayNow(String(obligation));
    }
  }, [obligation, payTouched]);

  const payAmount = Number(String(payNow).replace(/,/g, "")) || 0;
  const remainingPreview = Math.max(0, obligation - payAmount);

  const sellers = useMemo(
    () =>
      entityOptions
        // เฉพาะบทบาทผู้ขาย — ไม่ดึงลูกค้า/ผู้รับจ้าง/ซัพพลายเออร์อย่างเดียว
        .filter((e) => (e.roles ?? []).includes("SELLER"))
        .sort((a, b) => a.name.localeCompare(b.name, "th")),
    [entityOptions],
  );

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
          label: `${b.bankName} ${b.accountNumber}${b.isPrimary ? " · หลัก" : ""}`,
        });
      }
    }
    return opts;
  }, [banks]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!brand.trim() || !model.trim()) {
      setMsg("เลือกหรือกรอกยี่ห้อและรุ่น");
      return;
    }
    if (obligation <= 0) {
      setMsg("กรอกมูลค่าสัญญาซื้อ / ราคาซื้อ");
      return;
    }
    if (payAmount > obligation) {
      setMsg("ยอดจ่ายครั้งนี้เกินมูลค่าสัญญา");
      return;
    }

    const fd = new FormData(e.currentTarget);
    const sellerEntityId = String(fd.get("sellerEntityId") ?? "").trim();

    if (payAmount > 0) {
      if (!payAccountId) {
        setMsg("เลือกบัญชีที่ต้องการตัดเงิน");
        return;
      }
      if (hasVat) {
        if (!billNo.trim()) {
          setMsg("มี VAT — กรอกเลขที่บิล / ใบกำกับภาษี");
          return;
        }
        if (!receiptNo.trim()) {
          setMsg("มี VAT — กรอกเลขที่ใบเสร็จ");
          return;
        }
      }
      if (createPv && !hasVat && !sellerEntityId) {
        setMsg("สร้างใบสำคัญจ่ายต้องเลือกผู้ขาย");
        return;
      }
    }

    startTransition(async () => {
      const price = String(fd.get("purchasePrice") ?? "0");
      const contract = String(fd.get("purchaseContractAmount") ?? "").trim() || price;
      const res = await saveVehicleClient({
        licensePlate: String(fd.get("licensePlate") ?? ""),
        brand: brand.trim(),
        model: model.trim(),
        year: String(fd.get("year") ?? ""),
        color: String(fd.get("color") ?? ""),
        vin: String(fd.get("vin") ?? ""),
        engineNo: String(fd.get("engineNo") ?? ""),
        mileage: String(fd.get("mileage") ?? ""),
        status: "IN_STOCK" as VehicleStatus,
        purchaseType,
        sellerEntityId: sellerEntityId || null,
        purchaseDate: String(fd.get("purchaseDate") ?? ""),
        purchasePrice: price,
        purchaseContractAmount: contract,
        saleContractAmount: String(fd.get("saleContractAmount") ?? fd.get("expectedSalePrice") ?? "0"),
        expectedSalePrice: String(fd.get("expectedSalePrice") ?? "0"),
        commissionAmount: String(fd.get("commissionAmount") ?? "0"),
        soldDate: "",
        soldPrice: "0",
        buyerEntityId: null,
        notes: String(fd.get("notes") ?? ""),
        purchasePayments: [],
      });
      if (!res.ok) {
        setMsg(res.message);
        return;
      }

      if (payAmount > 0) {
        const channel = channelForAccountId(payAccountId, banks);
        const bankAccountId = payAccountId === CASH_ACCOUNT_ID ? null : payAccountId;
        const pay = await addVehiclePurchasePaymentClient(res.id, {
          date: String(fd.get("purchaseDate") ?? "") || undefined,
          amount: payAmount,
          billNo: billNo.trim() || null,
          receiptNo: receiptNo.trim() || null,
          createPaymentVoucher: createPv && !hasVat,
          hasVat,
          channel,
          bankAccountId,
        });
        if (!pay.ok) {
          setMsg(`บันทึกรถแล้ว แต่จ่ายเงินไม่สำเร็จ: ${pay.message}`);
          router.push(`/vehicles/${res.id}`);
          return;
        }
      }

      router.push(`/vehicles/${res.id}`);
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mx-auto max-w-3xl space-y-5 rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
    >
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">รับรถเข้าสต็อก</h1>
        <Link href="/vehicles" className="text-sm text-blue-800 hover:underline">
          ← กลับ
        </Link>
      </div>

      {msg && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{msg}</p>}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <BrandModelSelect
            brand={brand}
            model={model}
            onBrandChange={setBrand}
            onModelChange={setModel}
          />
        </div>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">ทะเบียน</span>
          <input name="licensePlate" className={inp} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">ปี</span>
          <input name="year" className={inp} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">สี</span>
          <input name="color" className={inp} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">เลขไมล์</span>
          <input name="mileage" className={inp} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">VIN / เลขตัวถัง</span>
          <input name="vin" className={inp} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">เลขเครื่อง</span>
          <input name="engineNo" className={inp} />
        </label>
      </div>

      <fieldset className="space-y-3 rounded-md border border-slate-200 p-4">
        <legend className="px-1 text-sm font-semibold text-slate-800">ข้อมูลการซื้อเข้า / สัญญา</legend>
        <p className="text-xs text-slate-500">
          มูลค่าสัญญาและราคาซื้อเป็นต้นทุนรถ — การตัดสมุดเงินสดอยู่ส่วนจ่ายเงินด้านล่าง
        </p>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">ประเภทการซื้อ *</span>
          <select
            name="purchaseType"
            className={inp}
            value={purchaseType}
            onChange={(e) => setPurchaseType(e.target.value as VehiclePurchaseType)}
          >
            {(Object.keys(PURCHASE_TYPE_LABELS) as VehiclePurchaseType[]).map((k) => (
              <option key={k} value={k}>
                {PURCHASE_TYPE_LABELS[k]}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-500">
            {purchaseType === "INDIVIDUAL_NO_VAT"
              ? "ซื้อจากบุคคล — ไม่มีภาษีซื้อ · ตอนขายออกใบกำกับบริษัท คิด VAT จากยอดขายเต็ม × 7/107"
              : "ซื้อจากบริษัทมีใบกำกับ · ตอนขายออกใบกำกับบริษัท คิด VAT จากยอดขายเต็ม × 7/107"}
          </p>
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">ผู้ขาย *</span>
            <select name="sellerEntityId" className={inp} defaultValue="" disabled={loadingEntities}>
              <option value="">
                {loadingEntities
                  ? "กำลังโหลด…"
                  : sellers.length === 0
                    ? "— ยังไม่มีผู้ขายในคู่ค้า —"
                    : "— เลือกผู้ขาย —"}
              </option>
              {sellers.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} ({e.entityKind === "COMPANY" ? "บริษัท" : "บุคคล"})
                </option>
              ))}
            </select>
            {!loadingEntities && sellers.length === 0 ? (
              <p className="mt-1 text-xs text-slate-500">
                แสดงเฉพาะคู่ค้าบทบาทผู้ขาย — เพิ่ม/แก้ที่เมนู{" "}
                <Link href="/entities" className="text-blue-800 underline">
                  คู่ค้า
                </Link>
                {" "}แล้วติ๊ก «ผู้ขาย/ซัพพลายเออร์»
              </p>
            ) : (
              <p className="mt-1 text-xs text-slate-500">แสดงเฉพาะคู่ค้าที่ตั้งบทบาทเป็นผู้ขาย</p>
            )}
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">วันที่ซื้อ</span>
            <input
              name="purchaseDate"
              type="date"
              className={inp}
              defaultValue={new Date().toISOString().slice(0, 10)}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">มูลค่าสัญญาซื้อเข้า (บาท) *</span>
            <input
              name="purchaseContractAmount"
              className={inp}
              required
              value={contractAmount}
              onChange={(e) => {
                setContractAmount(e.target.value);
                if (!purchasePrice || purchasePrice === contractAmount) {
                  setPurchasePrice(e.target.value);
                }
              }}
              placeholder="เช่น 300000"
            />
            <span className="mt-1 block text-xs text-slate-500">
              ยอดตามสัญญา — ใช้เป็นยอดที่ต้องจ่ายทั้งหมด และฐาน Margin ป.111
            </span>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">ราคาซื้อ / ต้นทุนรถ (บาท) *</span>
            <input
              name="purchasePrice"
              className={inp}
              required
              value={purchasePrice}
              onChange={(e) => setPurchasePrice(e.target.value)}
            />
            <span className="mt-1 block text-xs text-slate-500">
              ใช้คำนวณต้นทุนสต็อก (ปกติเท่ากับมูลค่าสัญญา)
            </span>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">ราคาตั้งขาย</span>
            <input name="expectedSalePrice" className={inp} defaultValue="0" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">หักค่าคอมมิชชั่น</span>
            <input name="commissionAmount" className={inp} defaultValue="0" />
          </label>
        </div>
      </fieldset>

      <fieldset className="space-y-3 rounded-md border border-amber-200 bg-amber-50/40 p-4">
        <legend className="px-1 text-sm font-semibold text-slate-800">จ่ายเงินค่าซื้อ + ตัดสมุดเงินสด</legend>
        <p className="text-xs text-slate-600">
          ใส่ยอดจ่ายและเลือกบัญชีที่ตัดเงิน — เหลือค้างจ่ายได้ แล้วกลับมาจ่ายทีหลังได้หลายครั้ง
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">จำนวนที่จ่ายครั้งนี้ (บาท)</span>
            <input
              className={inp}
              value={payNow}
              onChange={(e) => {
                setPayTouched(true);
                setPayNow(e.target.value);
              }}
              placeholder="0 = ยังไม่จ่าย"
            />
          </label>
          <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
            <p className="text-slate-500">ยอดคงค้างหลังบันทึก</p>
            <p className="text-lg font-semibold tabular-nums text-slate-900">
              ฿{remainingPreview.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-slate-500">
              สัญญา ฿{obligation.toLocaleString("th-TH", { minimumFractionDigits: 2 })} − จ่าย ฿
              {payAmount.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
            </p>
          </div>

          {payAmount > 0 && (
            <>
              <label className="text-sm sm:col-span-2">
                <span className="mb-1 block text-slate-600">ตัดเงินจากบัญชี *</span>
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

              <fieldset className="sm:col-span-2 space-y-2 rounded-md border border-slate-200 bg-white px-3 py-3">
                <legend className="px-1 text-sm font-medium text-slate-800">ภาษีมูลค่าเพิ่ม *</legend>
                <div className="flex flex-wrap gap-4 text-sm text-slate-800">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="radio"
                      name="hasVat"
                      checked={!hasVat}
                      onChange={() => {
                        setHasVat(false);
                      }}
                    />
                    ไม่มี VAT
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="radio"
                      name="hasVat"
                      checked={hasVat}
                      onChange={() => {
                        setHasVat(true);
                        setCreatePv(false);
                      }}
                    />
                    มี VAT
                  </label>
                </div>
                {hasVat ? (
                  <div className="grid gap-3 sm:grid-cols-2 pt-1">
                    <label className="text-sm">
                      <span className="mb-1 block text-slate-600">เลขที่บิล / ใบกำกับภาษี *</span>
                      <input
                        className={inp}
                        value={billNo}
                        onChange={(e) => setBillNo(e.target.value)}
                        placeholder="เช่น INV-001"
                        required
                      />
                    </label>
                    <label className="text-sm">
                      <span className="mb-1 block text-slate-600">เลขที่ใบเสร็จ *</span>
                      <input
                        className={inp}
                        value={receiptNo}
                        onChange={(e) => setReceiptNo(e.target.value)}
                        placeholder="เช่น RE-001"
                        required
                      />
                    </label>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 pt-1">
                    <label className="text-sm">
                      <span className="mb-1 block text-slate-600">เลขที่เอกสาร (ถ้ามี)</span>
                      <input
                        className={inp}
                        value={billNo}
                        onChange={(e) => setBillNo(e.target.value)}
                        placeholder="ใบเสร็จ/เอกสารอ้างอิง"
                        disabled={createPv}
                      />
                    </label>
                    <label className="flex items-end gap-2 pb-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={createPv}
                        onChange={(e) => setCreatePv(e.target.checked)}
                      />
                      ไม่มีเอกสาร — สร้างใบสำคัญจ่าย
                    </label>
                  </div>
                )}
              </fieldset>
            </>
          )}
        </div>
      </fieldset>

      <label className="block text-sm">
        <span className="mb-1 block text-slate-600">หมายเหตุ</span>
        <textarea name="notes" className={inp} rows={2} />
      </label>

      <input type="hidden" name="status" value="IN_STOCK" />

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
      >
        {pending
          ? "กำลังบันทึก…"
          : payAmount > 0
            ? "บันทึกและลงสมุดเงินสด (จ่ายซื้อรถ)"
            : "บันทึกรับรถเข้าสต็อก (ยังไม่ตัดเงินสด)"}
      </button>
    </form>
  );
}
