import { VehicleDetailLoader } from "./VehicleDetailLoader";

export const dynamic = "force-dynamic";

export default async function VehicleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <VehicleDetailLoader vehicleId={id} />;
}
