"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { listEntitiesClient } from "@/lib/entities-client";
import { buildHireContractHtml } from "@/lib/documents/contract-print";
import { loadCompanyBrandClient, openPrintHtml } from "@/lib/documents/print-client";
import { parseAmount } from "@/lib/documents/calc";
import { saveLegalDocClient } from "@/lib/legal-documents-client";
import type { ContractPartySnapshot, EntityRecord } from "@/lib/domain-types";

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

export function HireContractForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [entities, setEntities] = useState<EntityRecord[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [msgOk, setMsgOk] = useState(true);
  const [savedNumber, setSavedNumber] = useState("");

  const [hyevRole, setHyevRole] = useState<"HIRER" | "CONTRACTOR">("HIRER");
  const [party, setParty] = useState<ContractPartySnapshot>(emptyParty());
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [issuePlace, setIssuePlace] = useState("บริษัท หาดใหญ่ อี วี จำกัด");
  const [title, setTitle] = useState("ว่าจ้างซ่อม / บริการ");
  const [scopeOfWork, setScopeOfWork] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("ชำระเมื่อส่งมอบงานครบถ้วน หรือตามใบแจ้งหนี้");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState("");
  const [workPlace, setWorkPlace] = useState("");
  const [authorizedDirectorName, setAuthorizedDirectorName] = useState("นายเวศน์ วันเพ็ญ");

  useEffect(() => {
    void (async () => {
      const [ents, brandCo] = await Promise.all([listEntitiesClient(), loadCompanyBrandClient()]);
      setEntities(ents);
      setIssuePlace(brandCo.companyName || "บริษัท หาดใหญ่ อี วี จำกัด");
      setWorkPlace(brandCo.address || "");
    })();
  }, []);

  function onPickEntity(id: string) {
    const e = entities.find((x) => x.id === id);
    if (e) setParty(fromEntity(e));
  }

  async function buildHtml() {
    const company = await loadCompanyBrandClient();
    return buildHireContractHtml({
      company,
      logoUrl: company.logoUrl,
      hyevRole,
      counterparty: party,
      issuePlace,
      issueDate,
      title,
      scopeOfWork,
      amount: parseAmount(amount),
      paymentTerms,
      startDate,
      endDate,
      workPlace,
      authorizedDirectorName,
    });
  }

  function validate(): string | null {
    if (!party.name.trim()) return "กรอกหรือเลือกคู่สัญญา";
    if (!party.idOrTaxNo.trim()) return "กรอกเลขบัตรประชาชน / ทะเบียนการค้า ของคู่สัญญา";
    if (!party.phone.trim()) return "กรอกเบอร์โทรติดต่อของคู่สัญญา";
    if (!scopeOfWork.trim()) return "กรอกขอบเขตงาน";
    if (parseAmount(amount) <= 0) return "กรอกค่าจ้าง";
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
      openPrintHtml(await buildHtml());
      setMsgOk(true);
      setMsg("เปิดหน้าพิมพ์แล้ว");
    });
  }

  function onSaveAndPrint() {
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
        title,
        scopeOfWork,
        paymentTerms,
        startDate,
        endDate,
        workPlace,
        authorizedDirectorName,
        issuePlace,
      };
      const res = await saveLegalDocClient({
        kind: "HIRE_CONTRACT",
        issueDate,
        vehicleId: null,
        repairContractId: null,
        sellerEntityId: null,
        buyerEntityId: null,
        hirerEntityId: hyevRole === "CONTRACTOR" ? party.entityId : null,
        contractorEntityId: hyevRole === "HIRER" ? party.entityId : null,
        paymentTermsJson: JSON.stringify({ paymentTerms }),
        amount,
        depositPercent: "0",
        balancePercent: "100",
        notes: "",
        metaJson: JSON.stringify(meta),
      });
      if (!res.ok) {
        setMsgOk(false);
        setMsg(res.message);
        return;
      }
      setSavedNumber(res.number);
      openPrintHtml(await buildHtml());
      setMsgOk(true);
      setMsg(`บันทึกแล้ว (${res.number}) และเปิดหน้าพิมพ์`);
      router.push("/documents/hire-contract");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-900">สัญญาว่าจ้าง</h2>
        <Link href="/documents/hire-contract" className="text-sm text-blue-800 hover:underline">
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
            onChange={(e) => setHyevRole(e.target.value as "HIRER" | "CONTRACTOR")}
          >
            <option value="HIRER">เป็นผู้ว่าจ้าง (คู่สัญญา = ผู้รับจ้าง)</option>
            <option value="CONTRACTOR">เป็นผู้รับจ้าง (คู่สัญญา = ผู้ว่าจ้าง)</option>
          </select>
        </label>

        <label className="text-sm">
          <span className="mb-1 block text-slate-600">
            เลือกคู่สัญญา ({hyevRole === "HIRER" ? "ผู้รับจ้าง" : "ผู้ว่าจ้าง"}) จากคู่ค้า
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
          <span className="mb-1 block text-slate-600">วันที่ทำสัญญา</span>
          <input type="date" className={inp} value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
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
          <span className="mb-1 block text-slate-600">หัวข้อสัญญา</span>
          <input className={inp} value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">ทำที่</span>
          <input className={inp} value={issuePlace} onChange={(e) => setIssuePlace(e.target.value)} />
        </label>
        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block text-slate-600">ขอบเขตงาน *</span>
          <textarea
            className={inp}
            rows={4}
            value={scopeOfWork}
            onChange={(e) => setScopeOfWork(e.target.value)}
            required
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">ค่าจ้าง (บาท) *</span>
          <input className={inp} value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">เงื่อนไขชำระเงิน</span>
          <input className={inp} value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">วันเริ่มงาน</span>
          <input type="date" className={inp} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">วันสิ้นสุดงาน</span>
          <input type="date" className={inp} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </label>
        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block text-slate-600">สถานที่ปฏิบัติงาน</span>
          <input className={inp} value={workPlace} onChange={(e) => setWorkPlace(e.target.value)} />
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
          onClick={onSaveAndPrint}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {pending ? "กำลังสร้าง…" : "บันทึกและพิมพ์สัญญา"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={onPrint}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-800 hover:bg-slate-50 disabled:opacity-50"
        >
          พิมพ์อย่างเดียว
        </button>
      </div>
    </div>
  );
}
