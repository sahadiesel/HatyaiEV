import { VehicleSaleContractForm } from "@/components/documents/VehicleSaleContractForm";

export const dynamic = "force-dynamic";

export default async function NewVehicleSaleContractPage({
  searchParams,
}: {
  searchParams: Promise<{ vehicleId?: string }>;
}) {
  const sp = await searchParams;
  return <VehicleSaleContractForm initialVehicleId={sp.vehicleId ?? ""} />;
}
