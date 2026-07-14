import { notFound } from "next/navigation";
import { getHiringContractVehicle } from "@/app/contracts/hiring-contracts/vehicle-actions";
import { parseBillingJson } from "@/lib/vehicle-inspection-items";
import { VehicleBillingEditor } from "./VehicleBillingEditor";

export default async function VehicleBillingPage({
  params,
}: {
  params: Promise<{ id: string; lineIndex: string }>;
}) {
  const { id, lineIndex: lineIndexStr } = await params;
  const lineIndex = parseInt(lineIndexStr, 10);
  if (!lineIndex || lineIndex < 1) notFound();

  const vehicle = await getHiringContractVehicle(id, lineIndex);
  if (!vehicle) notFound();

  const price = Number(vehicle.hiringContract.pricePerVehicleExVat);
  const vatRate = Number(vehicle.hiringContract.vatRate);
  const contractAmountInclVat = price * (1 + vatRate / 100);

  return (
    <VehicleBillingEditor
      contractId={id}
      contractCode={vehicle.hiringContract.code}
      lineIndex={lineIndex}
      licensePlate={vehicle.licensePlate}
      brand={vehicle.brand}
      model={vehicle.model}
      year={vehicle.year}
      contractAmountInclVat={contractAmountInclVat}
      initialRecords={parseBillingJson(vehicle.billingJson)}
    />
  );
}
