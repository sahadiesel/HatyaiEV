import { notFound } from "next/navigation";
import { listClients } from "@/lib/clients-repository";
import { getHiringContract } from "@/lib/hiring-contracts-repository";
import { parseContractPhotosJson } from "@/lib/vehicle-inspection-items";
import { HiringContractEditor, type InstallmentRow, type VehicleRow } from "./HiringContractEditor";

export default async function HiringContractDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [contract, clients] = await Promise.all([getHiringContract(id), listClients()]);

  if (!contract) notFound();

  const initialVehicles: VehicleRow[] = contract.vehicles.map((v) => ({
    id: v.id,
    lineIndex: v.lineIndex,
    licensePlate: v.licensePlate ?? "",
    brand: v.brand ?? "",
    model: v.model ?? "",
    year: v.year ?? "",
    color: v.color ?? "",
    engineType: v.engineType,
    engineSize: v.engineSize ?? "",
    extraNotes: v.extraNotes ?? "",
    contractPhotos: parseContractPhotosJson(v.contractPhotos),
  }));

  const initialInstallments: InstallmentRow[] = contract.installments.map((m) => ({
    sequence: m.sequence,
    label: m.label,
    amount: m.amount,
    percent: m.percent,
  }));

  return (
    <HiringContractEditor
      contractId={contract.id}
      contractCode={contract.code}
      clients={clients.map((c) => ({ id: c.id, name: c.name }))}
      initialClientId={contract.clientId}
      initialTitle={contract.title}
      initialVehicleCount={contract.vehicleCount}
      initialPriceExVat={contract.pricePerVehicleExVat}
      initialVatRate={contract.vatRate}
      initialNotes={contract.notes}
      initialStatus={contract.status}
      initialVehicles={initialVehicles}
      initialInstallments={initialInstallments}
    />
  );
}
