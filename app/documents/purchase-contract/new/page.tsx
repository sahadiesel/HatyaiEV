import { PurchaseContractForm } from "@/components/documents/PurchaseContractForm";

export const dynamic = "force-dynamic";

export default async function NewPurchaseContractPage({
  searchParams,
}: {
  searchParams: Promise<{ vehicleId?: string; id?: string }>;
}) {
  const sp = await searchParams;
  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6">
      <PurchaseContractForm vehicleId={sp.vehicleId ?? ""} docId={sp.id ?? ""} />
    </div>
  );
}
