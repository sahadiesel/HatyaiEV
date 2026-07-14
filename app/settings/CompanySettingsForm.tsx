"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { isFirebaseConfigured } from "@/lib/firebase";
import { uploadCompanyAsset } from "@/lib/firebase-storage";
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
  signatureUrl: string;
  signatureStoragePath: string;
  stampUrl: string;
  stampStoragePath: string;
};

export function CompanySettingsForm({ initial }: { initial: CompanySettingsInitial }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [signatureUrl, setSignatureUrl] = useState(initial.signatureUrl);
  const [signatureStoragePath, setSignatureStoragePath] = useState(initial.signatureStoragePath);
  const [stampUrl, setStampUrl] = useState(initial.stampUrl);
  const [stampStoragePath, setStampStoragePath] = useState(initial.stampStoragePath);
  const [uploading, setUploading] = useState<"signature" | "stamp" | null>(null);

  async function handleUpload(kind: "signature" | "stamp", file: File | null) {
    if (!file) return;
    setUploading(kind);
    setError(null);
    try {
      const result = await uploadCompanyAsset(kind, file);
      if (kind === "signature") {
        setSignatureUrl(result.downloadUrl);
        setSignatureStoragePath(result.storagePath);
      } else {
        setStampUrl(result.downloadUrl);
        setStampStoragePath(result.storagePath);
      }
      const label = kind === "signature" ? "ลายเซ็น" : "ตรายาง";
      setMessage(
        result.wasCompressed
          ? `อัปโหลด${label}แล้ว (ระบบย่อขนาดให้อัตโนมัติเพราะไฟล์เกิน 1 MB) — กดบันทึกเพื่อเก็บลงระบบ`
          : `อัปโหลด${label}แล้ว — กดบันทึกเพื่อเก็บลงระบบ`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "อัปโหลดไม่สำเร็จ");
    } finally {
      setUploading(null);
    }
  }

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
      signatureUrl,
      signatureStoragePath,
      stampUrl,
      stampStoragePath,
    };

    formData.set("signatureUrl", signatureUrl);
    formData.set("signatureStoragePath", signatureStoragePath);
    formData.set("stampUrl", stampUrl);
    formData.set("stampStoragePath", stampStoragePath);

    try {
      if (isFirebaseConfigured()) {
        const fs = await writeCompanySettingsToFirestore(payload);
        if (!fs.ok) {
          setError(fs.message);
          return;
        }
        try {
          await saveCompanySettings(formData);
        } catch {
          /* ignore admin mirror failure */
        }
        setMessage("บันทึกแล้ว — รวมลายเซ็นและตรายางเรียบร้อย");
      } else {
        const saved = await saveCompanySettings(formData);
        if (!saved.ok) {
          setError(saved.message);
          return;
        }
        setMessage("บันทึกลงฐานในเครื่องแล้ว — ตั้งค่า Firebase เพื่อบันทึกบนคลาวด์");
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

        <fieldset className="space-y-3 border-t border-slate-100 pt-4">
          <legend className="text-sm font-medium text-slate-800">ลายเซ็นและตรายาง (ใช้ในเอกสาร)</legend>
          <p className="text-xs text-slate-500">
            อัปโหลดไฟล์ PNG/JPG — ถ้าเกิน 1 MB ระบบจะย่อขนาดให้อัตโนมัติ (แนะนำพื้นหลังโปร่งใส) — แสดงในช่องลงนามตอนพิมพ์ PDF
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <ImageAssetField
              label="ลายเซ็นผู้มีอำนาจ"
              previewUrl={signatureUrl}
              uploading={uploading === "signature"}
              onFile={(f) => void handleUpload("signature", f)}
              onClear={() => {
                setSignatureUrl("");
                setSignatureStoragePath("");
              }}
            />
            <ImageAssetField
              label="ตรายางบริษัท"
              previewUrl={stampUrl}
              uploading={uploading === "stamp"}
              onFile={(f) => void handleUpload("stamp", f)}
              onClear={() => {
                setStampUrl("");
                setStampStoragePath("");
              }}
            />
          </div>
        </fieldset>

        <button
          type="submit"
          disabled={pending || uploading !== null}
          className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {pending ? "กำลังบันทึก…" : "บันทึก"}
        </button>
      </form>
    </div>
  );
}

function ImageAssetField({
  label,
  previewUrl,
  uploading,
  onFile,
  onClear,
}: {
  label: string;
  previewUrl: string;
  uploading: boolean;
  onFile: (file: File | null) => void;
  onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <p className="text-sm font-medium text-slate-700">{label}</p>
      <div className="mt-2 flex min-h-[120px] items-center justify-center rounded-md border border-dashed border-slate-300 bg-white p-3">
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt={label} className="max-h-28 max-w-full object-contain" />
        ) : (
          <p className="text-xs text-slate-400">ยังไม่มีรูป</p>
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            onFile(e.target.files?.[0] ?? null);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-60"
        >
          {uploading ? "กำลังอัปโหลด…" : previewUrl ? "เปลี่ยนรูป" : "เลือกไฟล์"}
        </button>
        {previewUrl && (
          <button
            type="button"
            disabled={uploading}
            onClick={onClear}
            className="rounded-md border border-red-200 px-3 py-1.5 text-xs text-red-700 hover:bg-red-50"
          >
            ลบ
          </button>
        )}
      </div>
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
