import { listEntities } from "@/lib/entities-repository";
import { listRepairContracts } from "@/lib/repair-contracts-repository";
import { listVehicles } from "@/lib/vehicles-repository";
import { ServicesClient } from "./ServicesClient";

export const metadata = { title: "รับจ้างซ่อม — HYEV" };
export const dynamic = "force-dynamic";

export default async function ServicesPage() {
  const [contracts, entities, vehicles] = await Promise.all([
    listRepairContracts(),
    listEntities(),
    listVehicles(),
  ]);
  return <ServicesClient contracts={contracts} entities={entities} vehicles={vehicles} />;
}
