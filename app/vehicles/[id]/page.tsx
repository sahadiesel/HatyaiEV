import { notFound } from "next/navigation";
import { listEntities } from "@/lib/entities-repository";
import { getVehicle } from "@/lib/vehicles-repository";
import { VehicleDetailClient } from "./VehicleDetailClient";

export const dynamic = "force-dynamic";

export default async function VehicleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [vehicle, entities] = await Promise.all([getVehicle(id), listEntities()]);
  if (!vehicle) notFound();
  return <VehicleDetailClient vehicle={vehicle} entities={entities} />;
}
