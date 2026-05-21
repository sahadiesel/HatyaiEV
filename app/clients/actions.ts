"use server";

import {
  createClientRecord,
  deleteClientRecord,
  updateClientRecord,
} from "@/lib/clients-repository";
import { revalidatePath } from "next/cache";

export async function createClient(formData: FormData) {
  const r = await createClientRecord({
    name: String(formData.get("name") ?? ""),
    taxId: String(formData.get("taxId") ?? ""),
    address: String(formData.get("address") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    email: String(formData.get("email") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  });
  if (!r.ok) return r;
  revalidatePath("/clients");
  revalidatePath("/");
  return r;
}

export async function updateClient(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const r = await updateClientRecord(id, {
    name: String(formData.get("name") ?? ""),
    taxId: String(formData.get("taxId") ?? ""),
    address: String(formData.get("address") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    email: String(formData.get("email") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  });
  if (!r.ok) return r;
  revalidatePath("/clients");
  revalidatePath("/");
  revalidatePath(`/clients/${id}/edit`);
  return r;
}

export async function deleteClient(id: string) {
  const r = await deleteClientRecord(id);
  if (!r.ok) return r;
  revalidatePath("/clients");
  revalidatePath("/");
  return r;
}
