import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { InstallmentRow } from "../../hiring-contracts/[id]/HiringContractEditor";
import { SubcontractAgreementEditor } from "./SubcontractAgreementEditor";

export default async function SubcontractAgreementDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [agreement, contractors, hiringList] = await Promise.all([
    prisma.subcontractAgreement.findUnique({
      where: { id },
      include: {
        vehicles: { include: { hiringContractVehicle: true } },
        installments: { orderBy: { sequence: "asc" } },
      },
    }),
    prisma.contractor.findMany({ orderBy: { name: "asc" } }),
    prisma.hiringContract.findMany({
      orderBy: { updatedAt: "desc" },
      include: { client: true, vehicles: { orderBy: { lineIndex: "asc" } } },
    }),
  ]);

  if (!agreement) notFound();

  const hiringOptions = hiringList.map((h) => ({
    id: h.id,
    code: h.code,
    clientName: h.client.name,
  }));

  const vehiclesByHiringId: Record<
    string,
    { id: string; lineIndex: number; brand: string; model: string; year: string; color: string }[]
  > = {};
  for (const h of hiringList) {
    vehiclesByHiringId[h.id] = h.vehicles.map((v) => ({
      id: v.id,
      lineIndex: v.lineIndex,
      brand: v.brand,
      model: v.model,
      year: v.year,
      color: v.color,
    }));
  }

  const initialSelectedVehicleIds = agreement.vehicles.map((l) => l.hiringContractVehicleId);

  const initialInstallments: InstallmentRow[] = agreement.installments.map((m) => ({
    sequence: m.sequence,
    label: m.label,
    amount: m.amount.toString(),
    percent: m.percent != null ? m.percent.toString() : "",
  }));

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-slate-600">
          <Link href="/contracts/subcontract-agreements" className="text-blue-800 hover:underline">
            ← สัญญาว่าจ้าง
          </Link>
        </p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">แก้ไขสัญญาว่าจ้าง</h1>
      </div>

      <SubcontractAgreementEditor
        agreementId={agreement.id}
        code={agreement.code}
        contractors={contractors}
        hiringOptions={hiringOptions}
        vehiclesByHiringId={vehiclesByHiringId}
        initialContractorId={agreement.contractorId}
        initialHiringContractId={agreement.hiringContractId}
        initialTitle={agreement.title}
        initialPriceExVat={agreement.pricePerVehicleExVat.toString()}
        initialVatRate={agreement.vatRate.toString()}
        initialNotes={agreement.notes}
        initialStatus={agreement.status}
        initialSelectedVehicleIds={initialSelectedVehicleIds}
        initialInstallments={initialInstallments}
      />
    </div>
  );
}
