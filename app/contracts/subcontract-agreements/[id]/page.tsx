import { notFound } from "next/navigation";
import { listContractors } from "@/lib/contractors-repository";
import { listHiringContracts } from "@/lib/hiring-contracts-repository";
import { getSubcontractAgreement } from "@/lib/subcontract-agreements-repository";
import type { InstallmentRow } from "../../hiring-contracts/[id]/HiringContractEditor";
import { SubcontractAgreementEditor } from "./SubcontractAgreementEditor";

export default async function SubcontractAgreementDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [agreement, contractors, hiringList] = await Promise.all([
    getSubcontractAgreement(id),
    listContractors(),
    listHiringContracts(),
  ]);

  if (!agreement) notFound();

  const hiringOptions = hiringList.map((h) => ({
    id: h.id,
    code: h.code,
    clientName: h.clientName,
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

  const initialInstallments: InstallmentRow[] = agreement.installments.map((m) => ({
    sequence: m.sequence,
    label: m.label,
    amount: m.amount,
    percent: m.percent,
  }));

  return (
    <SubcontractAgreementEditor
      agreementId={agreement.id}
      code={agreement.code}
      contractors={contractors.map((c) => ({ id: c.id, name: c.name }))}
      hiringOptions={hiringOptions}
      vehiclesByHiringId={vehiclesByHiringId}
      initialContractorId={agreement.contractorId}
      initialHiringContractId={agreement.hiringContractId}
      initialTitle={agreement.title}
      initialPriceExVat={agreement.pricePerVehicleExVat}
      initialVatRate={agreement.vatRate}
      initialNotes={agreement.notes}
      initialStatus={agreement.status}
      initialSelectedVehicleIds={agreement.selectedVehicleIds}
      initialInstallments={initialInstallments}
    />
  );
}
