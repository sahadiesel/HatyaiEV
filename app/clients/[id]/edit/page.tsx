import Link from "next/link";
import { notFound } from "next/navigation";
import { getClient } from "@/lib/clients-repository";
import { ClientEditForm } from "./ClientEditForm";

export default async function ClientEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await getClient(id);
  if (!client) notFound();

  const formValues = {
    id: client.id,
    name: client.name,
    taxId: client.taxId,
    address: client.address,
    phone: client.phone,
    email: client.email,
    notes: client.notes,
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <p className="text-sm text-slate-600">
        <Link href="/clients" className="text-blue-800 hover:underline">
          ← ผู้ว่าจ้าง
        </Link>
      </p>
      <div>
        <p className="font-mono text-sm text-slate-500">{client.code ?? "—"}</p>
        <h1 className="text-2xl font-bold text-slate-900">แก้ไขผู้ว่าจ้าง</h1>
      </div>
      <ClientEditForm client={formValues} />
    </div>
  );
}
