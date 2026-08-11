"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { parseAmount } from "@/lib/documents/calc";
import { buildPurchaseContractHtml } from "@/lib/documents/legal-print";
import { loadCompanyBrandClient, openPrintHtml } from "@/lib/documents/print-client";
import {
  newPaymentLine,
  parsePurchaseContractTerms,
  serializePurchaseContractTerms,
  sumPaymentLines,
  type PurchaseContractPaymentLine,
} from "@/lib/documents/purchase-contract-terms";
import type { EntityRecord, LegalDocRecord, VehicleRecord } from "@/lib/domain-types";
import { listEntitiesClient } from "@/lib/entities-client";
import { listLegalDocsClient, saveLegalDocClient } from "@/lib/legal-documents-client";
import { calcPurchasePaymentSummary, formatBaht } from "@/lib/vehicles/calc";
import {
  getVehicleClient,
  listVehiclesClient,
  updateVehicleFieldsClient,
} from "@/lib/vehicles-client";

const inp =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

export function PurchaseContractForm({
  vehicleId: initialVehicleId = "",
  docId = "",
}: {
  vehicleId?: string;
  docId?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [vehicles, setVehicles] = useState<VehicleRecord[]>([]);
  const [vehicleId, setVehicleId] = useState(initialVehicleId);
  const [vehicle, setVehicle] = useState<VehicleRecord | null>(null);
  const [seller, setSeller] = useState<EntityRecord | null>(null);
  const [existing, setExisting] = useState<LegalDocRecord | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [msgOk, setMsgOk] = useState(true);
  const [loading, setLoading] = useState(true);

  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState("");
  const [lines, setLines] = useState<PurchaseContractPaymentLine[]>([]);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const [vehs, ents, legalAll] = await Promise.all([
        listVehiclesClient(),
        listEntitiesClient(),
        listLegalDocsClient("PURCHASE_CONTRACT"),
      ]);
      setVehicles(vehs);

      let doc: LegalDocRecord | null = null;
      if (docId) {
        doc = legalAll.find((r) => r.id === docId) || null;
      } else if (initialVehicleId) {
        doc = legalAll.find((r) => r.vehicleId === initialVehicleId) || null;
      }
      setExisting(doc);

      const vid = doc?.vehicleId || initialVehicleId || "";
      setVehicleId(vid);

      const v = vid ? (await getVehicleClient(vid)) || vehs.find((x) => x.id === vid) || null : null;
      setVehicle(v);
      if (v) {
        const s = v.sellerEntityId ? ents.find((e) => e.id === v.sellerEntityId) || null : null;
        setSeller(s);
        if (doc) {
          setIssueDate(doc.issueDate || v.purchaseDate || new Date().toISOString().slice(0, 10));
          setAmount(doc.amount || String(calcPurchasePaymentSummary(v).obligation || ""));
          setLines(parsePurchaseContractTerms(doc.paymentTermsJson).paymentLines);
          setNotes(doc.notes || "");
        } else {
          setIssueDate(v.purchaseDate || new Date().toISOString().slice(0, 10));
          setAmount(String(calcPurchasePaymentSummary(v).obligation || v.purchasePrice || ""));
          setLines([]);
          setNotes(`สัญญาซื้อเข้า ${v.brand} ${v.model} ${v.licensePlate || ""}`.trim());
        }
      }
      setLoading(false);
    })();
  }, [docId, initialVehicleId]);

  async function onPickVehicle(id: string) {
    setVehicleId(id);
    if (!id) {
      setVehicle(null);
      setSeller(null);
      return;
    }
    const [v, ents, legal] = await Promise.all([
      getVehicleClient(id),
      listEntitiesClient(),
      listLegalDocsClient("PURCHASE_CONTRACT"),
    ]);
    setVehicle(v);
    if (!v) return;
    setSeller(v.sellerEntityId ? ents.find((e) => e.id === v.sellerEntityId) || null : null);
    const doc = legal.find((r) => r.vehicleId === id) || null;
    setExisting(doc);
    if (doc) {
      setIssueDate(doc.issueDate || v.purchaseDate || new Date().toISOString().slice(0, 10));
      setAmount(doc.amount || String(calcPurchasePaymentSummary(v).obligation || ""));
      setLines(parsePurchaseContractTerms(doc.paymentTermsJson).paymentLines);
      setNotes(doc.notes || "");
    } else {
      setIssueDate(v.purchaseDate || new Date().toISOString().slice(0, 10));
      setAmount(String(calcPurchasePaymentSummary(v).obligation || v.purchasePrice || ""));
      setLines([]);
      setNotes(`สัญญาซื้อเข้า ${v.brand} ${v.model} ${v.licensePlate || ""}`.trim());
    }
  }

  const linesSum = useMemo(() => sumPaymentLines(lines), [lines]);
  const contractAmount = parseAmount(amount);

  function updateLine(id: string, patch: Partial<PurchaseContractPaymentLine>) {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  function validate(): string | null {
    if (!vehicle) return "เลือกรถก่อน";
    if (contractAmount <= 0) return "กรอกราคาซื้อในสัญญา";
    if (lines.length === 0) return "เพิ่มเงื่อนไขชำระเงินอย่างน้อย 1 รายการ";
    for (const l of lines) {
      if (!l.label.trim()) return "กรอกชื่อรายการชำระเงิน";
      if (parseAmount(l.amount) < 0) return "จำนวนเงินต้องไม่ติดลบ";
    }
    return null;
  }

  async function buildHtml(docNumber?: string) {
    if (!vehicle) throw new Error("ไม่พบรถ");
    const company = await loadCompanyBrandClient();
    return buildPurchaseContractHtml({
      company,
      logoUrl: company.logoUrl || "",
      vehicle,
      seller,
      amount: contractAmount,
      paymentLines: lines.map((l) => ({
        label: l.label.trim(),
        amount: parseAmount(l.amount),
        note: l.note.trim(),
      })),
      docNumber: docNumber || existing?.number,
      issueDate,
    });
  }

  async function saveDoc(): Promise<{ ok: true; id: string; number: string } | { ok: false; message: string }> {
    if (!vehicle) return { ok: false, message: "เลือกรถก่อน" };
    // บันทึกสัญญา + ผูกมูลค่าสัญญากลับเข้ารถ — ไม่แตะงวดจ่าย / cashbook
    const res = await saveLegalDocClient({
      id: existing?.id,
      number: existing?.number,
      kind: "PURCHASE_CONTRACT",
      issueDate,
      vehicleId: vehicle.id,
      repairContractId: null,
      sellerEntityId: vehicle.sellerEntityId,
      buyerEntityId: null,
      hirerEntityId: null,
      contractorEntityId: null,
      paymentTermsJson: serializePurchaseContractTerms({ paymentLines: lines }),
      amount: String(contractAmount),
      depositPercent: "0",
      balancePercent: "100",
      notes,
      metaJson: JSON.stringify({
        licensePlate: vehicle.licensePlate,
        vin: vehicle.vin,
        purchaseType: vehicle.purchaseType,
        cashbookIndependent: true,
      }),
    });
    if (!res.ok) return res;

    const vehSync = await updateVehicleFieldsClient(vehicle.id, {
      purchaseContractAmount: String(contractAmount),
      // ต้นทุนซื้อเข้าให้สอดคล้องมูลค่าสัญญา (ไม่แตะยอดที่จ่ายแล้ว / cashbook)
      purchasePrice: String(contractAmount),
      ...(issueDate ? { purchaseDate: issueDate } : {}),
    });
    if (!vehSync.ok) {
      return {
        ok: false,
        message: `บันทึกสัญญาแล้ว แต่ผูกมูลค่าเข้าหน้ารถไม่สำเร็จ: ${vehSync.message}`,
      };
    }
    setVehicle((v) =>
      v
        ? {
            ...v,
            purchaseContractAmount: String(contractAmount),
            purchasePrice: String(contractAmount),
            purchaseDate: issueDate || v.purchaseDate,
          }
        : v,
    );
    return res;
  }

  function onSave() {
    const err = validate();
    if (err) {
      setMsgOk(false);
      setMsg(err);
      return;
    }
    startTransition(async () => {
      const res = await saveDoc();
      if (!res.ok) {
        setMsgOk(false);
        setMsg(res.message);
        return;
      }
      setMsgOk(true);
      setMsg(`บันทึกสัญญา ${res.number} และผูกมูลค่าเข้าหน้ารถแล้ว`);
      router.push("/documents/purchase-contract");
    });
  }

  function onPrint() {
    if (!existing?.number && !existing?.id) {
      setMsgOk(false);
      setMsg("บันทึกสัญญาก่อน แล้วพิมพ์จากหน้ารายการ หรือกดบันทึกก่อน");
      return;
    }
    const err = validate();
    if (err) {
      setMsgOk(false);
      setMsg(err);
      return;
    }
    startTransition(async () => {
      const res = await saveDoc();
      if (!res.ok) {
        setMsgOk(false);
        setMsg(res.message);
        return;
      }
      setExisting((prev) =>
        prev
          ? { ...prev, id: res.id, number: res.number, amount: String(contractAmount), issueDate }
          : null,
      );
      openPrintHtml(await buildHtml(res.number));
      setMsgOk(true);
      setMsg(`เปิดพิมพ์ ${res.number}`);
    });
  }

  if (loading) {
    return <p className="text-sm text-slate-600">กำลังโหลด…</p>;
  }

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-900">สัญญาซื้อ</h2>
        <Link href="/documents/purchase-contract" className="text-sm text-blue-800 hover:underline">
          ← รายการ
        </Link>
      </div>

      <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
        ราคาในสัญญานี้ผูกกับ <strong>มูลค่าสัญญา</strong> ในหน้ารถคันเดียวกัน —{" "}
        <strong>ไม่ซิงก์กับ cashbook</strong> ถ้าจ่าย/รับเงินผิด ให้ไปแก้หรือลบในสมุดเงินสดเอง
      </p>

      {msg && (
        <p
          className={
            msgOk
              ? "rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
              : "rounded-md bg-red-50 px-3 py-2 text-sm text-red-800"
          }
        >
          {msg}
        </p>
      )}

      <label className="block text-sm">
        <span className="text-slate-600">เลือกรถ *</span>
        <select
          className={inp}
          value={vehicleId}
          onChange={(e) => void onPickVehicle(e.target.value)}
          disabled={Boolean(docId && existing)}
        >
          <option value="">— เลือกรถ —</option>
          {vehicles.map((v) => (
            <option key={v.id} value={v.id}>
              {(v.licensePlate || v.code || v.id).trim()} · {v.brand} {v.model}
            </option>
          ))}
        </select>
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="text-slate-600">เลขที่เอกสาร</span>
          <input className={inp} value={existing?.number || "(บันทึกแล้วจะได้เลข)"} disabled />
        </label>
        <label className="block text-sm">
          <span className="text-slate-600">วันที่สัญญา</span>
          <input
            type="date"
            className={inp}
            value={issueDate}
            onChange={(e) => setIssueDate(e.target.value)}
          />
        </label>
      </div>

      {vehicle && (
        <div className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          <div>
            <strong>รถ:</strong> {vehicle.brand} {vehicle.model} · ทะเบียน{" "}
            {vehicle.licensePlate || "—"} · VIN {vehicle.vin || "—"}
          </div>
          <div>
            <strong>ผู้ขาย:</strong> {seller?.name || "—"}
            {seller?.phone ? ` · ${seller.phone}` : ""}
          </div>
        </div>
      )}

      <label className="block text-sm">
        <span className="text-slate-600">ราคาซื้อในสัญญา (บาท)</span>
        <input
          className={inp}
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="เช่น 300000"
        />
      </label>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-900">เงื่อนไขการชำระเงิน</h3>
          <button
            type="button"
            className="rounded-md border border-slate-300 px-2.5 py-1 text-xs hover:bg-slate-50"
            onClick={() => setLines((prev) => [...prev, newPaymentLine()])}
          >
            + เพิ่มรายการ
          </button>
        </div>
        <p className="text-xs text-slate-500">
          ระบุเอง เช่น มัดจำ / งวดที่ 2 — ไม่บังคับเปอร์เซ็นต์อัตโนมัติ
        </p>
        {lines.length === 0 ? (
          <p className="text-sm text-slate-500">ยังไม่มีรายการ — กดเพิ่มรายการ</p>
        ) : (
          <div className="space-y-2">
            {lines.map((line, idx) => (
              <div
                key={line.id}
                className="grid gap-2 rounded-md border border-slate-200 p-3 sm:grid-cols-[1fr_140px_1fr_auto]"
              >
                <label className="block text-xs">
                  <span className="text-slate-500">รายการ #{idx + 1}</span>
                  <input
                    className={inp}
                    value={line.label}
                    onChange={(e) => updateLine(line.id, { label: e.target.value })}
                    placeholder="เช่น มัดจำ"
                  />
                </label>
                <label className="block text-xs">
                  <span className="text-slate-500">จำนวนเงิน</span>
                  <input
                    className={inp}
                    inputMode="decimal"
                    value={line.amount}
                    onChange={(e) => updateLine(line.id, { amount: e.target.value })}
                    placeholder="0"
                  />
                </label>
                <label className="block text-xs">
                  <span className="text-slate-500">หมายเหตุ / กำหนดจ่าย</span>
                  <input
                    className={inp}
                    value={line.note}
                    onChange={(e) => updateLine(line.id, { note: e.target.value })}
                    placeholder="เช่น จ่ายในวันทำสัญญา"
                  />
                </label>
                <div className="flex items-end">
                  <button
                    type="button"
                    className="rounded-md px-2 py-2 text-xs text-red-700 hover:bg-red-50"
                    onClick={() => setLines((prev) => prev.filter((l) => l.id !== line.id))}
                  >
                    ลบ
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-slate-600">
          รวมรายการชำระ: {formatBaht(linesSum)}
          {contractAmount > 0 && linesSum !== contractAmount ? (
            <span className="text-amber-700">
              {" "}
              (ต่างจากราคาในสัญญา {formatBaht(contractAmount)})
            </span>
          ) : null}
        </p>
      </div>

      <label className="block text-sm">
        <span className="text-slate-600">หมายเหตุภายใน (ไม่บังคับ)</span>
        <input className={inp} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>

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
          disabled={pending || !existing}
          onClick={onPrint}
          title={!existing ? "บันทึกก่อน แล้วพิมพ์จากหน้ารายการ" : "พิมพ์"}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
        >
          พิมพ์
        </button>
        <Link
          href="/documents/purchase-contract"
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
