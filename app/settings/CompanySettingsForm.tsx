"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { isFirebaseConfigured } from "@/lib/firebase";
import { writeCompanySettingsToFirestore } from "@/lib/firestore";
import { saveCompanySettings } from "./actions";

export type CompanySettingsInitial = {
  companyName: string;
  address: string;
  taxId: string;
  phone: string;
  email: string;
  docPrefixInvoice: string;
  docPrefixTaxInvoice: string;
  docPrefixReceipt: string;
  docPrefixPo: string;
  docPrefixWht: string;
};

export function CompanySettingsForm({ initial }: { initial: CompanySettingsInitial }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setMessage(null);
    setError(null);

    const form = e.currentTarget;
    const formData = new FormData(form);

    const payload = {
      companyName: String(formData.get("companyName") ?? ""),
      address: String(formData.get("address") ?? ""),
      taxId: String(formData.get("taxId") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      email: String(formData.get("email") ?? ""),
      docPrefixInvoice: String(formData.get("docPrefixInvoice") ?? "INV"),
      docPrefixTaxInvoice: String(formData.get("docPrefixTaxInvoice") ?? "TAX"),
      docPrefixReceipt: String(formData.get("docPrefixReceipt") ?? "RC"),
      docPrefixPo: String(formData.get("docPrefixPo") ?? "PO"),
      docPrefixWht: String(formData.get("docPrefixWht") ?? "WHT"),
    };

    try {
      const saved = await saveCompanySettings(formData);
      if (!saved.ok) {
        setError(saved.message);
        return;
      }

      if (isFirebaseConfigured()) {
        const fs = await writeCompanySettingsToFirestore(payload);
        if (fs.ok) {
          setMessage("บันทึกแล้ว — ฐานในเครื่อง + Firestore (companySettings/main)");
        } else {
          setMessage(
            `บันทึกฐานในเครื่องแล้ว แต่ Firestore ไม่สำเร็จ: ${fs.message} (ตรวจ Rules / เน็ต / env)`,
          );
        }
      } else {
        setMessage("บันทึกลงฐานในเครื่องแล้ว — ยังไม่ได้ตั้งค่า Firebase ใน .env.local");
      }
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "บันทึกไม่สำเร็จ";
      setError(msg);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-3">
      {message && (
        <p className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900">{message}</p>
      )}
      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">{error}</p>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <Field label="ชื่อบริษัท / ร้าน" name="companyName" defaultValue={initial.companyName} />
        <Field label="ที่อยู่" name="address" defaultValue={initial.address} rows={3} />
        <Field label="เลขประจำตัวผู้เสียภาษี" name="taxId" defaultValue={initial.taxId} />
        <Field label="โทรศัพท์" name="phone" defaultValue={initial.phone} />
        <Field label="อีเมล" name="email" defaultValue={initial.email} />

        <fieldset className="space-y-2 border-t border-slate-100 pt-4">
          <legend className="text-sm font-medium text-slate-800">คำนำหน้าเลขที่เอกสาร</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="ใบแจ้งหนี้" name="docPrefixInvoice" defaultValue={initial.docPrefixInvoice} />
            <Field label="ใบกำกับภาษี" name="docPrefixTaxInvoice" defaultValue={initial.docPrefixTaxInvoice} />
            <Field label="ใบเสร็จรับเงิน" name="docPrefixReceipt" defaultValue={initial.docPrefixReceipt} />
            <Field label="ใบสั่งจ้าง" name="docPrefixPo" defaultValue={initial.docPrefixPo} />
            <Field label="หัก ณ ที่จ่าย" name="docPrefixWht" defaultValue={initial.docPrefixWht} />
          </div>
        </fieldset>

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {pending ? "กำลังบันทึก…" : "บันทึก"}
        </button>
      </form>
    </div>
  );
}

function Field({
  label,
  name,
  defaultValue,
  rows,
}: {
  label: string;
  name: string;
  defaultValue: string;
  rows?: number;
}) {
  return (
    <label className="block text-sm">
      <span className="font-medium text-slate-700">{label}</span>
      {rows ? (
        <textarea
          name={name}
          rows={rows}
          defaultValue={defaultValue}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      ) : (
        <input
          type="text"
          name={name}
          defaultValue={defaultValue}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      )}
    </label>
  );
}
