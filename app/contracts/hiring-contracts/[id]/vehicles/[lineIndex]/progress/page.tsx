import { notFound } from "next/navigation";
import { getHiringContractVehicle } from "@/app/contracts/hiring-contracts/vehicle-actions";
import { parseInspectionJson } from "@/lib/vehicle-inspection-items";
import { VehicleProgressEditor } from "./VehicleProgressEditor";

export default async function VehicleProgressPage({
  params,
}: {
  params: Promise<{ id: string; lineIndex: string }>;
}) {
  const { id, lineIndex: lineIndexStr } = await params;
  const lineIndex = parseInt(lineIndexStr, 10);
  if (!lineIndex || lineIndex < 1) notFound();

  const vehicle = await getHiringContractVehicle(id, lineIndex);
  if (!vehicle) notFound();

  return (
    <VehicleProgressEditor
      contractId={id}
      contractCode={vehicle.hiringContract.code}
      lineIndex={lineIndex}
      licensePlate={vehicle.licensePlate}
      brand={vehicle.brand}
      model={vehicle.model}
      year={vehicle.year}
      initialRows={parseInspectionJson(vehicle.inspectionJson)}
    />
  );
}
