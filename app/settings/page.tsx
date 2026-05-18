import { prisma } from "@/lib/prisma";
import { CompanySettingsForm } from "./CompanySettingsForm";

export default async function SettingsPage() {
  const s = await prisma.companySettings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });

  const initial = {
    companyName: s.companyName,
    address: s.address,
    taxId: s.taxId,
    phone: s.phone,
    email: s.email,
    docPrefixInvoice: s.docPrefixInvoice,
    docPrefixTaxInvoice: s.docPrefixTaxInvoice,
    docPrefixReceipt: s.docPrefixReceipt,
    docPrefixPo: s.docPrefixPo,
    docPrefixWht: s.docPrefixWht,
  };

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">ตั้งค่าร้าน</h1>
        <p className="mt-1 text-sm text-slate-600">
          สาขาเดียว — บันทึกลงฐานในเครื่อง (SQLite) และถ้าตั้งค่า Firebase แล้ว จะซิงก์ไป{" "}
          <strong>Firestore</strong> ที่คอลเลกชัน <code className="rounded bg-slate-100 px-1">companySettings</code>{" "}
          เอกสาร <code className="rounded bg-slate-100 px-1">main</code>
          {" — "}
          ถ้าเขียน Firestore ไม่ได้ ให้ไปแท็บ <strong>Rules</strong> แล้ววางกฎจากไฟล์{" "}
          <code className="rounded bg-slate-100 px-1">firestore.rules</code> ในโปรเจกต์ (โหมด dev)
        </p>
      </div>

      <CompanySettingsForm initial={initial} />
    </div>
  );
}
