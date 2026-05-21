import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { parseContractPhotosJson } from "@/lib/vehicle-inspection-items";
import { HiringContractEditor, type InstallmentRow, type VehicleRow } from "./HiringContractEditor";

export default async function HiringContractDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [contract, clients] = await Promise.all([
    prisma.hiringContract.findUnique({
      where: { id },
      include: { vehicles: { orderBy: { lineIndex: "asc" } }, installments: { orderBy: { sequence: "asc" } } },
    }),
    prisma.client.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!contract) notFound();

  const initialVehicles: VehicleRow[] = contract.vehicles.map((v) => ({
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
    amount: m.amount.toString(),
    percent: m.percent != null ? m.percent.toString() : "",
  }));

  return (
    <HiringContractEditor
      contractId={contract.id}
      contractCode={contract.code}
      clients={clients}
        initialClientId={contract.clientId}
        initialTitle={contract.title}
        initialVehicleCount={contract.vehicleCount}
        initialPriceExVat={contract.pricePerVehicleExVat.toString()}
        initialVatRate={contract.vatRate.toString()}
        initialNotes={contract.notes}
        initialStatus={contract.status}
        initialVehicles={initialVehicles}
        initialInstallments={initialInstallments}
    />
  );
}
