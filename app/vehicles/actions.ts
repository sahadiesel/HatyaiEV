"use server";

import { revalidatePath } from "next/cache";
import {
  addVehicleCostLine,
  createVehicle,
  deleteVehicle,
  removeVehicleCostLine,
  updateVehicle,
} from "@/lib/vehicles-repository";
import type { VehicleCostCategory, VehiclePurchaseType, VehicleStatus } from "@/lib/domain-types";
import { postCashbookEntry } from "@/lib/cashbook-repository";

function revalidate(id?: string) {
  revalidatePath("/vehicles");
  revalidatePath("/");
  if (id) revalidatePath(`/vehicles/${id}`);
  revalidatePath("/cashbook");
}

export async function saveVehicleAction(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  const payload = {
    licensePlate: String(formData.get("licensePlate") ?? ""),
    brand: String(formData.get("brand") ?? ""),
    model: String(formData.get("model") ?? ""),
    year: String(formData.get("year") ?? ""),
    color: String(formData.get("color") ?? ""),
    vin: String(formData.get("vin") ?? ""),
    engineNo: String(formData.get("engineNo") ?? ""),
    mileage: String(formData.get("mileage") ?? ""),
    status: (String(formData.get("status") ?? "IN_STOCK") as VehicleStatus) || "IN_STOCK",
    purchaseType:
      (String(formData.get("purchaseType") ?? "INDIVIDUAL_NO_VAT") as VehiclePurchaseType) ||
      "INDIVIDUAL_NO_VAT",
    sellerEntityId: String(formData.get("sellerEntityId") ?? "").trim() || null,
    purchaseDate: String(formData.get("purchaseDate") ?? ""),
    purchasePrice: String(formData.get("purchasePrice") ?? "0"),
    expectedSalePrice: String(formData.get("expectedSalePrice") ?? "0"),
    commissionAmount: String(formData.get("commissionAmount") ?? "0"),
    soldDate: String(formData.get("soldDate") ?? ""),
    soldPrice: String(formData.get("soldPrice") ?? "0"),
    buyerEntityId: String(formData.get("buyerEntityId") ?? "").trim() || null,
    notes: String(formData.get("notes") ?? ""),
  };

  if (id) {
    const result = await updateVehicle(id, payload);
    if (result.ok) revalidate(id);
    return result;
  }

  const result = await createVehicle(payload);
  if (result.ok) {
    revalidate(result.id);
    // Auto cashbook: จ่ายซื้อรถ
    const price = Number(String(payload.purchasePrice).replace(/,/g, "")) || 0;
    if (price > 0) {
      await postCashbookEntry({
        entryDate: payload.purchaseDate || undefined,
        direction: "OUT",
        entryType: "VEHICLE_PURCHASE",
        amount: price,
        description: `ซื้อรถเข้า ${payload.licensePlate || payload.brand} ${payload.model}`.trim(),
        vehicleId: result.id,
        entityId: payload.sellerEntityId,
      });
    }
  }
  return result;
}

export async function addCostLineAction(formData: FormData) {
  const vehicleId = String(formData.get("vehicleId") ?? "").trim();
  if (!vehicleId) return { ok: false as const, message: "ไม่พบรหัสรถ" };

  const amount = String(formData.get("amount") ?? "0");
  const description = String(formData.get("description") ?? "");
  const category = (String(formData.get("category") ?? "PARTS") as VehicleCostCategory) || "PARTS";
  const date = String(formData.get("date") ?? new Date().toISOString().slice(0, 10));
  const postCash = formData.get("postCash") === "1";

  const result = await addVehicleCostLine(vehicleId, {
    date,
    category,
    description,
    amount,
    documentId: null,
  });
  if (!result.ok) return result;

  if (postCash) {
    const amt = Number(String(amount).replace(/,/g, "")) || 0;
    if (amt > 0) {
      await postCashbookEntry({
        entryDate: date,
        direction: "OUT",
        entryType: "PARTS",
        amount: amt,
        description: `ต้นทุนรถ: ${description || category}`,
        vehicleId,
      });
    }
  }

  revalidate(vehicleId);
  return result;
}

export async function removeCostLineAction(vehicleId: string, lineId: string) {
  const result = await removeVehicleCostLine(vehicleId, lineId);
  if (result.ok) revalidate(vehicleId);
  return result;
}

export async function deleteVehicleAction(id: string) {
  const result = await deleteVehicle(id);
  if (result.ok) revalidate();
  return result;
}

export async function updateSalePricingAction(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { ok: false as const, message: "ไม่พบรหัสรถ" };
  const result = await updateVehicle(id, {
    expectedSalePrice: String(formData.get("expectedSalePrice") ?? "0"),
    commissionAmount: String(formData.get("commissionAmount") ?? "0"),
  });
  if (result.ok) revalidate(id);
  return result;
}
