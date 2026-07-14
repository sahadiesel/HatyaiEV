import { listVehicles } from "@/lib/vehicles-repository";
import { VehiclesBoard } from "./VehiclesBoard";

export const metadata = { title: "รถยนต์และต้นทุน — HYEV" };
export const dynamic = "force-dynamic";

export default async function VehiclesPage() {
  const vehicles = await listVehicles();
  return <VehiclesBoard vehicles={vehicles} />;
}
