import Link from "next/link";
import { notFound } from "next/navigation";
import { getContractor } from "@/lib/contractors-repository";
import { ContractorEditForm } from "./ContractorEditForm";

export default async function ContractorEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const contractor = await getContractor(id);
  if (!contractor) notFound();

  const formValues = {
    id: contractor.id,
    code: contractor.code,
    name: contractor.name,
    taxId: contractor.taxId,
    address: contractor.address,
    phone: contractor.phone,
    email: contractor.email,
    bankName: contractor.bankName,
    bankAccount: contractor.bankAccount,
    defaultWhtPercent: contractor.defaultWhtPercent,
    notes: contractor.notes,
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <p className="text-sm text-slate-600">
        <Link href="/contractors" className="text-blue-800 hover:underline">
          ← ผู้รับเหมา
        </Link>
      </p>
      <div>
        <p className="font-mono text-sm text-slate-500">{formValues.code ?? "—"}</p>
        <h1 className="text-2xl font-bold text-slate-900">แก้ไขผู้รับเหมา</h1>
      </div>
      <ContractorEditForm contractor={formValues} />
    </div>
  );
}
