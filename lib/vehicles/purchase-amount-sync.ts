"use client";

import { parseAmount } from "@/lib/documents/calc";
import type { LegalDocRecord, VehicleRecord } from "@/lib/domain-types";
import { listLegalDocsClient } from "@/lib/legal-documents-client";
import { updateVehicleFieldsClient } from "@/lib/vehicles-client";

function amountsDiffer(a: number, b: number): boolean {
  return Math.abs(a - b) > 0.009;
}

/** ราคาจากสัญญาซื้อ (เอกสาร) เป็นแหล่งความจริง — ผูกกลับเข้า purchasePrice / purchaseContractAmount */
export async function reconcileVehiclePurchaseFromContractClient(
  vehicle: VehicleRecord,
  purchaseContract?: LegalDocRecord | null,
): Promise<{ vehicle: VehicleRecord; synced: boolean; contractAmount: number | null }> {
  let contract = purchaseContract;
  if (contract === undefined) {
    const rows = await listLegalDocsClient("PURCHASE_CONTRACT");
    contract = rows.find((r) => r.vehicleId === vehicle.id) || null;
  }
  if (!contract) {
    return { vehicle, synced: false, contractAmount: null };
  }
  const contractAmount = parseAmount(contract.amount);
  if (contractAmount <= 0) {
    return { vehicle, synced: false, contractAmount: null };
  }

  const needSync =
    amountsDiffer(parseAmount(vehicle.purchaseContractAmount), contractAmount) ||
    amountsDiffer(parseAmount(vehicle.purchasePrice), contractAmount);

  if (!needSync) {
    return { vehicle, synced: false, contractAmount };
  }

  const res = await updateVehicleFieldsClient(vehicle.id, {
    purchaseContractAmount: String(contractAmount),
    purchasePrice: String(contractAmount),
  });
  if (!res.ok) {
    return { vehicle, synced: false, contractAmount };
  }

  return {
    vehicle: {
      ...vehicle,
      purchaseContractAmount: String(contractAmount),
      purchasePrice: String(contractAmount),
    },
    synced: true,
    contractAmount,
  };
}

/** ซิงก์ราคาซื้อจากสัญญาซื้อเข้าทุกรถในรายการ */
export async function reconcileAllVehiclePurchaseAmountsClient(
  vehicles: VehicleRecord[],
): Promise<VehicleRecord[]> {
  if (vehicles.length === 0) return vehicles;
  const contracts = await listLegalDocsClient("PURCHASE_CONTRACT");
  const byVehicle = new Map(
    contracts.filter((c) => c.vehicleId).map((c) => [c.vehicleId as string, c]),
  );

  const out: VehicleRecord[] = [];
  for (const v of vehicles) {
    const contract = byVehicle.get(v.id) || null;
    const { vehicle } = await reconcileVehiclePurchaseFromContractClient(v, contract);
    out.push(vehicle);
  }
  return out;
}
