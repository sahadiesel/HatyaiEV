import { listEntities } from "@/lib/entities-repository";
import { NewVehicleForm } from "./NewVehicleForm";

export const metadata = { title: "รับรถเข้าสต็อก — HYEV" };
export const dynamic = "force-dynamic";

export default async function NewVehiclePage() {
  const entities = await listEntities();
  return <NewVehicleForm entities={entities} />;
}
