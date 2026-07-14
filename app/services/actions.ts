"use server";

import { revalidatePath } from "next/cache";
import {
  createRepairContract,
  deleteRepairContract,
  updateRepairContract,
} from "@/lib/repair-contracts-repository";
import type { RepairContractKind, RepairContractStatus } from "@/lib/domain-types";

function revalidate(id?: string) {
  revalidatePath("/services");
  revalidatePath("/");
  if (id) revalidatePath(`/services/${id}`);
}

export async function saveRepairContractAction(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  const kind = (String(formData.get("kind") ?? "SERVICE_TO_CUSTOMER") as RepairContractKind) ||
    "SERVICE_TO_CUSTOMER";
  const payload = {
    kind,
    title: String(formData.get("title") ?? ""),
    status: (String(formData.get("status") ?? "DRAFT") as RepairContractStatus) || "DRAFT",
    counterpartyEntityId: String(formData.get("counterpartyEntityId") ?? "").trim() || null,
    vehicleId: String(formData.get("vehicleId") ?? "").trim() || null,
    customerVehicleLabel: String(formData.get("customerVehicleLabel") ?? ""),
    symptoms: String(formData.get("symptoms") ?? ""),
    agreedPriceExVat: String(formData.get("agreedPriceExVat") ?? "0"),
    vatRate: String(formData.get("vatRate") ?? "7"),
    notes: String(formData.get("notes") ?? ""),
    issueDate: String(formData.get("issueDate") ?? new Date().toISOString().slice(0, 10)),
  };

  if (id) {
    const result = await updateRepairContract(id, payload);
    if (result.ok) revalidate(id);
    return result;
  }

  const result = await createRepairContract(payload);
  if (result.ok) revalidate(result.id);
  return result;
}

export async function deleteRepairContractAction(id: string) {
  const result = await deleteRepairContract(id);
  if (result.ok) revalidate();
  return result;
}
