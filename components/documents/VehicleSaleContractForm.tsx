"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { BrandModelSelect } from "@/components/vehicles/BrandModelSelect";
import { listEntitiesClient } from "@/lib/entities-client";
import { buildVehicleSalePurchaseContractHtml } from "@/lib/documents/contract-print";
import { loadCompanyBrandClient, openPrintHtml } from "@/lib/documents/print-client";
import { parseAmount } from "@/lib/documents/calc";
import {
  calcInclusiveVatBreakdown,
  calcSaleDepositTaxInvoice,
  effectivePurchaseContractAmount,
} from "@/lib/finance/vat-margin";
import { saveLegalDocClient } from "@/lib/legal-documents-client";
import { ensurePrimaryBankAccount } from "@/lib/bank-accounts-client";
import { postCashbookEntryClient } from "@/lib/cashbook-client";
import { listVehiclesClient, updateVehicleFieldsClient } from "@/lib/vehicles-client";
import { formatBaht } from "@/lib/vehicles/calc";
import type { ContractPartySnapshot, EntityRecord, VehicleRecord } from "@/lib/domain-types";

const inp =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

function emptyParty(): ContractPartySnapshot {
  return {
    entityId: null,
    name: "",
    address: "",
    idOrTaxNo: "",
    phone: "",
    entityKind: "INDIVIDUAL",
  };
}

function fromEntity(e: EntityRecord): ContractPartySnapshot {
  return {
    entityId: e.id,
    name: e.name,
    address: e.address,
    idOrTaxNo: e.taxId,
    phone: e.phone,
    entityKind: e.entityKind,
  };
}

const DEFAULT_IMPROVEMENTS = [
  "พ่นสีตัวถังทั้งคัน",
  "ทำความสะอาดภายในและเบาะโดยรอบ",
  "ตรวจสอบและแก้ไขระบบไฟฟ้าทั้งหมด",
  "แก้ไขสนิมโครงรถ",
];

export function VehicleSaleContractForm({
  initialVehicleId = "",
}: {
  initialVehicleId?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [entities, setEntities] = useState<EntityRecord[]>([]);
  const [vehicles, setVehicles] = useState<VehicleRecord[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [msgOk, setMsgOk] = useState(true);
  const [savedNumber, setSavedNumber] = useState("");

  const [hyevRole, setHyevRole] = useState<"SELLER" | "BUYER">("SELLER");
  const [party, setParty] = useState<ContractPartySnapshot>(emptyParty());
  const [vehicleId, setVehicleId] = useState(initialVehicleId);
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [issuePlace, setIssuePlace] = useState("บริษัท หาดใหญ่ อี วี จำกัด");
  const [vehicleCondition, setVehicleCondition] = useState("มือสอง");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [licensePlate, setLicensePlate] = useState("");
  const [vin, setVin] = useState("");
  const [amount, setAmount] = useState("");
  const [depositPercent, setDepositPercent] = useState("70");
  const [balancePercent, setBalancePercent] = useState("30");
  const [bankName, setBankName] = useState("กสิกรไทย");
  const [bankAccount, setBankAccount] = useState("215-8-41628-2");
  const [bankAccountName, setBankAccountName] = useState("บริษัท หาดใหญ่ อี วี จำกัด");
  const [improvementsText, setImprovementsText] = useState(DEFAULT_IMPROVEMENTS.join("\n"));
  const [deliveryDeadline, setDeliveryDeadline] = useState("ภายใน 2 เดือนนับจากวันทำสัญญา");
  const [deliveryPlace, setDeliveryPlace] = useState("");
  const [authorizedDirectorName, setAuthorizedDirectorName] = useState("นายเวศน์ วันเพ็ญ");

  useEffect(() => {
    void (async () => {
      const [ents, vehs, brandCo] = await Promise.all([
        listEntitiesClient(),
        listVehiclesClient(),
        loadCompanyBrandClient(),
      ]);
      setEntities(ents);
      setVehicles(vehs);
      setIssuePlace(brandCo.companyName || "บริษัท หาดใหญ่ อี วี จำกัด");
      setBankAccountName(brandCo.companyName || "บริษัท หาดใหญ่ อี วี จำกัด");
      setDeliveryPlace(brandCo.address || "");
      const pickId = initialVehicleId || vehicleId;
      if (pickId) {
        const v = vehs.find((x) => x.id === pickId);
        if (v) {
          setVehicleId(v.id);
          setBrand(v.brand);
          setModel(v.model);
          setLicensePlate(v.licensePlate);
          setVin(v.vin);
          const sale =
            parseAmount(v.saleContractAmount) > 0
              ? v.saleContractAmount
              : parseAmount(v.expectedSalePrice) > 0
                ? v.expectedSalePrice
                : parseAmount(v.soldPrice) > 0
                  ? v.soldPrice
                  : "";
          if (sale) setAmount(sale);
          if (v.buyerEntityId) {
            const buyer = ents.find((e) => e.id === v.buyerEntityId);
            if (buyer) setParty(fromEntity(buyer));
          }
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialVehicleId]);

  const selectableVehicles = useMemo(
    () => vehicles.filter((v) => v.status === "IN_STOCK" || v.status === "RESERVED" || v.status === "SOLD"),
    [vehicles],
  );

  function onPickEntity(id: string) {
    const e = entities.find((x) => x.id === id);
    if (e) setParty(fromEntity(e));
  }

  function onPickVehicle(id: string) {
    setVehicleId(id);
    const v = vehicles.find((x) => x.id === id);
    if (!v) return;
    setBrand(v.brand);
    setModel(v.model);
    setLicensePlate(v.licensePlate);
    setVin(v.vin);
    const sale =
      parseAmount(v.saleContractAmount) > 0
        ? v.saleContractAmount
        : parseAmount(v.expectedSalePrice) > 0
          ? v.expectedSalePrice
          : parseAmount(v.soldPrice) > 0
            ? v.soldPrice
            : "";
    if (sale) setAmount(sale);
  }

  const selectedVehicle = vehicles.find((v) => v.id === vehicleId) ?? null;
  const saleAmt = parseAmount(amount);
  const depPct = parseAmount(depositPercent);
  const depositAmt = Math.round(((saleAmt * depPct) / 100) * 100) / 100;
  const customerBreakdown = calcInclusiveVatBreakdown(depositAmt, 7);
  const marginTax = selectedVehicle
    ? calcSaleDepositTaxInvoice({
        saleContractAmount: saleAmt,
        purchaseContractAmount: effectivePurchaseContractAmount(selectedVehicle),
        depositInclusive: depositAmt,
        purchaseType: selectedVehicle.purchaseType,
      })
    : null;

  async function buildHtml() {
    const company = await loadCompanyBrandClient();
    return buildVehicleSalePurchaseContractHtml({
      company,
      logoUrl: company.logoUrl,
      hyevRole,
      counterparty: party,
      issuePlace,
      issueDate,
      vehicleCondition,
      brand,
      model,
      licensePlate,
      vin,
      amount: parseAmount(amount),
      depositPercent: parseAmount(depositPercent),
      balancePercent: parseAmount(balancePercent),
      bankName,
      bankAccount,
      bankAccountName,
      improvements: improvementsText.split("\n").map((s) => s.trim()).filter(Boolean),
      deliveryDeadline,
      deliveryPlace,
      authorizedDirectorName,
    });
  }

  function validate(): string | null {
    if (!vehicleId) return "เลือกรถจากรายการรถยนต์ในระบบ";
    if (!party.name.trim()) return "กรอกหรือเลือกคู่สัญญา";
    if (!party.idOrTaxNo.trim()) return "กรอกเลขบัตรประชาชน / ทะเบียนการค้า ของคู่สัญญา";
    if (!party.phone.trim()) return "กรอกเบอร์โทรติดต่อของคู่สัญญา";
    if (parseAmount(amount) <= 0) return "กรอกราคาขาย";
    return null;
  }

  function onPrint() {
    const err = validate();
    if (err) {
      setMsgOk(false);
      setMsg(err);
      return;
    }
    startTransition(async () => {
      const html = await buildHtml();
      openPrintHtml(html);
      setMsgOk(true);
      setMsg("เปิดหน้าพิมพ์แล้ว");
    });
  }

  function onSave() {
    const err = validate();
    if (err) {
      setMsgOk(false);
      setMsg(err);
      return;
    }
    startTransition(async () => {
      const meta = {
        hyevRole,
        counterparty: party,
        vehicleCondition,
        brand,
        model,
        licensePlate,
        vin,
        bankName,
        bankAccount,
        bankAccountName,
        improvements: improvementsText.split("\n").map((s) => s.trim()).filter(Boolean),
        deliveryDeadline,
        deliveryPlace,
        authorizedDirectorName,
        issuePlace,
      };
      const res = await saveLegalDocClient({
        kind: "VEHICLE_SALE_CONTRACT",
        issueDate,
        vehicleId,
        repairContractId: null,
        sellerEntityId: hyevRole === "BUYER" ? party.entityId : null,
        buyerEntityId: hyevRole === "SELLER" ? party.entityId : null,
        hirerEntityId: null,
        contractorEntityId: null,
        paymentTermsJson: JSON.stringify({
          depositPercent,
          balancePercent,
        }),
        amount,
        depositPercent,
        balancePercent,
        notes: "",
        metaJson: JSON.stringify(meta),
      });
      if (!res.ok) {
        setMsgOk(false);
        setMsg(res.message);
        return;
      }
      setSavedNumber(res.number);

      // ล็อกมูลค่าสัญญาขายบนรถ
      await updateVehicleFieldsClient(vehicleId, {
        saleContractAmount: amount,
        expectedSalePrice: amount,
      });

      // ลงสมุดเงินสด: รับมัดจำเข้าบัญชีหลัก + เก็บ VAT ป.111 หลังบ้าน
      const primary = await ensurePrimaryBankAccount();
      if (primary && depositAmt > 0 && marginTax) {
        await postCashbookEntryClient({
          entryDate: issueDate,
          direction: "IN",
          entryType: "SALE_DEPOSIT",
          amount: depositAmt,
          description: `รับมัดจำขายรถ ${licensePlate || brand} ${model} (${depositPercent}%)`.trim(),
          channel: "BANK",
          bankAccountId: primary.id,
          vehicleId,
          entityId: party.entityId,
          documentId: `sale-deposit-${res.id}`,
          documentNumber: res.number,
          vatType: marginTax.vatType,
          taxBasisAmount: marginTax.taxBasisAmount,
          customerVatAmount: marginTax.customerInvoice.vatAmount,
          remittanceVatAmount: marginTax.remittanceVat,
          createdByName: "",
        });
      }

      setMsgOk(true);
      setMsg(`บันทึกแล้ว (${res.number}) — กลับไปหน้ารายการ`);
      router.push("/documents/vehicle-sale");
    });
  }

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-900">สัญญาขาย</h2>
        <Link href="/documents/vehicle-sale" className="text-sm text-blue-800 hover:underline">
          ← รายการ
        </Link>
      </div>
      {msg && (
        <p
          className={
            msgOk
              ? "rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
              : "rounded-md bg-red-50 px-3 py-2 text-sm text-red-800"
          }
        >
          {msg}
          {savedNumber ? ` · เลขที่ ${savedNumber}` : ""}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block text-slate-600">บทบาทของหาดใหญ่ อี วี *</span>
          <select
            className={inp}
            value={hyevRole}
            onChange={(e) => setHyevRole(e.target.value as "SELLER" | "BUYER")}
          >
            <option value="SELLER">เป็นผู้ขาย (คู่สัญญา = ผู้ซื้อ)</option>
            <option value="BUYER">เป็นผู้ซื้อ (คู่สัญญา = ผู้ขาย)</option>
          </select>
        </label>

        <label className="text-sm">
          <span className="mb-1 block text-slate-600">เลือกรถจากระบบ *</span>
          <select className={inp} value={vehicleId} onChange={(e) => onPickVehicle(e.target.value)} required>
            <option value="">— เลือกรถ —</option>
            {selectableVehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {(v.licensePlate || v.code || v.id).trim()} · {v.brand} {v.model}
              </option>
            ))}
          </select>
          {selectableVehicles.length === 0 && (
            <span className="mt-1 block text-xs text-amber-700">ยังไม่มีรถในระบบ — เพิ่มที่เมนูรถยนต์และต้นทุน</span>
          )}
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">วันที่ทำสัญญา</span>
          <input type="date" className={inp} value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
        </label>

        <label className="text-sm">
          <span className="mb-1 block text-slate-600">
            เลือกคู่สัญญา ({hyevRole === "SELLER" ? "ผู้ซื้อ" : "ผู้ขาย"}) จากคู่ค้า
          </span>
          <select className={inp} defaultValue="" onChange={(e) => onPickEntity(e.target.value)}>
            <option value="">— กรอกเอง / เลือก —</option>
            {entities.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">ทำที่</span>
          <input className={inp} value={issuePlace} onChange={(e) => setIssuePlace(e.target.value)} />
        </label>

        <label className="text-sm">
          <span className="mb-1 block text-slate-600">ชื่อคู่สัญญา *</span>
          <input className={inp} value={party.name} onChange={(e) => setParty((p) => ({ ...p, name: e.target.value }))} required />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">ประเภทคู่สัญญา</span>
          <select
            className={inp}
            value={party.entityKind}
            onChange={(e) =>
              setParty((p) => ({ ...p, entityKind: e.target.value as "INDIVIDUAL" | "COMPANY" }))
            }
          >
            <option value="INDIVIDUAL">บุคคลธรรมดา</option>
            <option value="COMPANY">นิติบุคคล</option>
          </select>
        </label>
        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block text-slate-600">ที่อยู่คู่สัญญา</span>
          <textarea
            className={inp}
            rows={2}
            value={party.address}
            onChange={(e) => setParty((p) => ({ ...p, address: e.target.value }))}
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">เลขบัตรประชาชน / ทะเบียนการค้า *</span>
          <input
            className={inp}
            value={party.idOrTaxNo}
            onChange={(e) => setParty((p) => ({ ...p, idOrTaxNo: e.target.value }))}
            required
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">เบอร์โทรติดต่อ *</span>
          <input
            className={inp}
            value={party.phone}
            onChange={(e) => setParty((p) => ({ ...p, phone: e.target.value }))}
            required
          />
        </label>

        <label className="text-sm">
          <span className="mb-1 block text-slate-600">สภาพรถ</span>
          <input className={inp} value={vehicleCondition} onChange={(e) => setVehicleCondition(e.target.value)} />
        </label>
        <div className="sm:col-span-2">
          <BrandModelSelect
            brand={brand}
            model={model}
            onBrandChange={setBrand}
            onModelChange={setModel}
            required={false}
          />
        </div>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">ทะเบียน</span>
          <input className={inp} value={licensePlate} onChange={(e) => setLicensePlate(e.target.value)} />
        </label>
        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block text-slate-600">เลขตัวถัง (VIN)</span>
          <input className={inp} value={vin} onChange={(e) => setVin(e.target.value)} />
        </label>

        <label className="text-sm">
          <span className="mb-1 block text-slate-600">ราคาขาย (บาท) *</span>
          <input className={inp} value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">มัดจำ (%)</span>
          <input className={inp} value={depositPercent} onChange={(e) => setDepositPercent(e.target.value)} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">ส่วนที่เหลือ (%)</span>
          <input className={inp} value={balancePercent} onChange={(e) => setBalancePercent(e.target.value)} />
        </label>
      </div>

      {saleAmt > 0 && (
        <div className="rounded-md border border-blue-200 bg-blue-50/60 p-4 text-sm text-slate-800">
          <p className="font-semibold text-slate-900">ใบกำกับภาษีมัดจำ (แสดงลูกค้า) + VAT ป.111 (หลังบ้าน)</p>
          <p className="mt-2">
            มัดจำ {depositPercent}% = <strong>฿{formatBaht(depositAmt)}</strong>
            {" → "}
            ฐาน ฿{formatBaht(customerBreakdown.base)} + VAT 7% ฿{formatBaht(customerBreakdown.vatAmount)}
          </p>
          {marginTax && selectedVehicle?.purchaseType === "INDIVIDUAL_NO_VAT" && (
            <p className="mt-1 text-xs text-slate-600">
              นำส่งสรรพากรตาม Margin: กำไรส่วนมัดจำ ฿{formatBaht(marginTax.marginPortion)} · VAT นำส่ง ฿
              {formatBaht(marginTax.remittanceVat)} (ไม่ใช้ VAT จากยอดเต็มของลูกค้า)
            </p>
          )}
          {selectedVehicle && (
            <p className="mt-1 text-xs text-slate-500">
              ฐานซื้อสัญญา ฿{formatBaht(effectivePurchaseContractAmount(selectedVehicle))} · ขายสัญญา ฿
              {formatBaht(saleAmt)}
            </p>
          )}
          <p className="mt-2 text-xs">
            หลังบันทึก: ล็อก sale_contract_amount บนรถ + ลงสมุดเงินสดเข้าบัญชีกสิกรไทยอัตโนมัติ
          </p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">ธนาคาร</span>
          <input className={inp} value={bankName} onChange={(e) => setBankName(e.target.value)} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">เลขบัญชี</span>
          <input className={inp} value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">ชื่อบัญชี</span>
          <input className={inp} value={bankAccountName} onChange={(e) => setBankAccountName(e.target.value)} />
        </label>

        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block text-slate-600">เงื่อนไขปรับปรุงรถ (หนึ่งรายการต่อบรรทัด)</span>
          <textarea
            className={inp}
            rows={4}
            value={improvementsText}
            onChange={(e) => setImprovementsText(e.target.value)}
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">กำหนดส่งมอบ</span>
          <input className={inp} value={deliveryDeadline} onChange={(e) => setDeliveryDeadline(e.target.value)} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">สถานที่ส่งมอบ</span>
          <input className={inp} value={deliveryPlace} onChange={(e) => setDeliveryPlace(e.target.value)} />
        </label>
        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block text-slate-600">ชื่อกรรมการผู้มีอำนาจ (เมื่อ HYEV เป็นคู่สัญญา)</span>
          <input
            className={inp}
            value={authorizedDirectorName}
            onChange={(e) => setAuthorizedDirectorName(e.target.value)}
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={onSave}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {pending ? "กำลังบันทึก…" : "บันทึก"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={onPrint}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-800 hover:bg-slate-50 disabled:opacity-50"
        >
          พิมพ์
        </button>
        <Link
          href="/documents/vehicle-sale"
          className="rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
        >
          ยกเลิก
        </Link>
      </div>
      <p className="text-xs text-slate-500">
        หลังบันทึก สัญญาจะอยู่ในหน้ารายการ — ใช้ปุ่ม แก้ไข / พิมพ์ ท้ายแถวได้
      </p>
    </div>
  );
}
