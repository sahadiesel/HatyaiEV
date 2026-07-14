"use server";

import {
  createContractorRecord,
  deleteContractorRecord,
  updateContractorRecord,
} from "@/lib/contractors-repository";
import { revalidatePath } from "next/cache";

export async function createContractor(formData: FormData) {
  const r = await createContractorRecord({
    name: String(formData.get("name") ?? ""),
    taxId: String(formData.get("taxId") ?? ""),
    address: String(formData.get("address") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    email: String(formData.get("email") ?? ""),
    bankName: String(formData.get("bankName") ?? ""),
    bankAccount: String(formData.get("bankAccount") ?? ""),
    defaultWhtPercent: String(formData.get("defaultWhtPercent") ?? "1"),
    notes: String(formData.get("notes") ?? ""),
  });
  if (!r.ok) return r;
  revalidatePath("/contractors");
  revalidatePath("/");
  return r;
}

export async function updateContractor(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const r = await updateContractorRecord(id, {
    name: String(formData.get("name") ?? ""),
    taxId: String(formData.get("taxId") ?? ""),
    address: String(formData.get("address") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    email: String(formData.get("email") ?? ""),
    bankName: String(formData.get("bankName") ?? ""),
    bankAccount: String(formData.get("bankAccount") ?? ""),
    defaultWhtPercent: String(formData.get("defaultWhtPercent") ?? "1"),
    notes: String(formData.get("notes") ?? ""),
  });
  if (!r.ok) return r;
  revalidatePath("/contractors");
  revalidatePath("/");
  revalidatePath(`/contractors/${id}/edit`);
  return r;
}

export async function deleteContractor(id: string) {
  const r = await deleteContractorRecord(id);
  if (!r.ok) return r;
  revalidatePath("/contractors");
  revalidatePath("/");
  return r;
}
