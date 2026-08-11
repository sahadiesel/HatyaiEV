import { LegalVehiclePrintClient } from "./LegalVehiclePrintClient";

export const dynamic = "force-dynamic";

export default async function LegalVehiclePrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ kind: string }>;
  searchParams: Promise<{ vehicleId?: string; contractId?: string }>;
}) {
  const { kind } = await params;
  const sp = await searchParams;

  return (
    <LegalVehiclePrintClient
      kind={kind}
      vehicleId={sp.vehicleId ?? ""}
      contractId={sp.contractId ?? ""}
    />
  );
}
