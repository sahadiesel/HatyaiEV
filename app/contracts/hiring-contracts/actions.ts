"use server";

import { serializeContractPhotosForDb } from "@/lib/vehicle-inspection-items";
import {
  createHiringContractDraft as createHiringDraftRepo,
  saveHiringContract,
} from "@/lib/hiring-contracts-repository";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const HC_PATH = "/contracts/hiring-contracts";

export async function createHiringContractDraft(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const clientId = String(formData.get("clientId") ?? "");
  if (!clientId) return;

  const c = await createHiringDraftRepo({ title, clientId });
  revalidatePath(HC_PATH);
  redirect(`${HC_PATH}/${c.id}`);
}

export async function updateHiringContract(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false as const, message: "ไม่พบรหัสสัญญา" };

  const title = String(formData.get("title") ?? "").trim();
  const clientId = String(formData.get("clientId") ?? "");
  const vehicleCount = Math.max(0, parseInt(String(formData.get("vehicleCount") ?? "0"), 10) || 0);
  const priceStr = String(formData.get("pricePerVehicleExVat") ?? "0").replace(/,/g, "");
  const vatStr = String(formData.get("vatRate") ?? "7").replace(/,/g, "");
  const notes = String(formData.get("notes") ?? "");
  const status = String(formData.get("status") ?? "DRAFT") as
    | "DRAFT"
    | "ACTIVE"
    | "COMPLETED"
    | "CANCELLED";

  const vehiclesJson = String(formData.get("vehiclesJson") ?? "[]");
  let vehicles: {
    id?: string;
    lineIndex: number;
    licensePlate: string;
    brand: string;
    model: string;
    year: string;
    color: string;
    engineType: string;
    engineSize: string;
    extraNotes: string;
    contractPhotos: { id: string; fileName: string; storagePath?: string; dataUrl?: string }[];
  }[] = [];
  try {
    vehicles = JSON.parse(vehiclesJson);
    if (!Array.isArray(vehicles)) vehicles = [];
  } catch {
    return { ok: false as const, message: "ข้อมูลรายการรถไม่ถูกต้อง" };
  }

  const instJson = String(formData.get("installmentsJson") ?? "[]");
  let installments: { sequence: number; label: string; amount: string; percent: string }[] = [];
  try {
    installments = JSON.parse(instJson);
    if (!Array.isArray(installments)) installments = [];
  } catch {
    return { ok: false as const, message: "ข้อมูลงวดเงินไม่ถูกต้อง" };
  }

  const mappedVehicles = vehicles.map((v) => {
    const engineType =
      v.engineType === "DIESEL" || v.engineType === "ELECTRIC" ? v.engineType : "GASOLINE";
    return {
      id: v.id,
      lineIndex: Number(v.lineIndex) || 0,
      licensePlate: String(v.licensePlate ?? ""),
      brand: String(v.brand ?? ""),
      model: String(v.model ?? ""),
      year: String(v.year ?? ""),
      color: String(v.color ?? ""),
      engineType: engineType as "GASOLINE" | "DIESEL" | "ELECTRIC",
      engineSize: String(v.engineSize ?? ""),
      extraNotes: String(v.extraNotes ?? ""),
      contractPhotos: serializeContractPhotosForDb(v.contractPhotos),
    };
  });

  const result = await saveHiringContract({
    id,
    title,
    clientId,
    vehicleCount,
    pricePerVehicleExVat: priceStr || "0",
    vatRate: vatStr || "7",
    notes,
    status,
    vehicles: mappedVehicles,
    installments,
  });

  if (!result.ok) return result;

  revalidatePath(HC_PATH);
  revalidatePath(`${HC_PATH}/${id}`);
  revalidatePath("/contracts");
  return result;
}
