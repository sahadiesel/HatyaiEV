"use server";

import {
  createSubcontractAgreementDraft as createSubcontractDraftRepo,
  saveSubcontractAgreement,
} from "@/lib/subcontract-agreements-repository";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const SC_PATH = "/contracts/subcontract-agreements";

export async function createSubcontractAgreementDraft(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const contractorId = String(formData.get("contractorId") ?? "");
  const hiringContractId = String(formData.get("hiringContractId") ?? "");
  if (!contractorId || !hiringContractId) return;

  const c = await createSubcontractDraftRepo({ title, contractorId, hiringContractId });
  revalidatePath(SC_PATH);
  revalidatePath("/contracts");
  revalidatePath("/contracts/subcontract-agreements");
  redirect(`${SC_PATH}/${c.id}`);
}

export async function updateSubcontractAgreement(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false as const, message: "ไม่พบรหัสสัญญา" };

  const title = String(formData.get("title") ?? "").trim();
  const contractorId = String(formData.get("contractorId") ?? "");
  const hiringContractId = String(formData.get("hiringContractId") ?? "");
  const priceStr = String(formData.get("pricePerVehicleExVat") ?? "0").replace(/,/g, "");
  const vatStr = String(formData.get("vatRate") ?? "7").replace(/,/g, "");
  const notes = String(formData.get("notes") ?? "");
  const status = String(formData.get("status") ?? "DRAFT") as
    | "DRAFT"
    | "ACTIVE"
    | "COMPLETED"
    | "CANCELLED";

  const selectedJson = String(formData.get("selectedVehicleIdsJson") ?? "[]");
  let selectedIds: string[] = [];
  try {
    selectedIds = JSON.parse(selectedJson);
    if (!Array.isArray(selectedIds)) selectedIds = [];
  } catch {
    return { ok: false as const, message: "ข้อมูลรถที่เลือกไม่ถูกต้อง" };
  }

  const instJson = String(formData.get("installmentsJson") ?? "[]");
  let installments: { sequence: number; label: string; amount: string; percent: string }[] = [];
  try {
    installments = JSON.parse(instJson);
    if (!Array.isArray(installments)) installments = [];
  } catch {
    return { ok: false as const, message: "ข้อมูลงวดเงินไม่ถูกต้อง" };
  }

  const result = await saveSubcontractAgreement({
    id,
    title,
    contractorId,
    hiringContractId,
    vehicleCount: selectedIds.length,
    pricePerVehicleExVat: priceStr || "0",
    vatRate: vatStr || "7",
    notes,
    status,
    selectedVehicleIds: selectedIds,
    installments,
  });

  if (!result.ok) return result;

  revalidatePath(SC_PATH);
  revalidatePath(`${SC_PATH}/${id}`);
  revalidatePath("/contracts");
  return result;
}
