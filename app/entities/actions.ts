"use server";

import { revalidatePath } from "next/cache";
import {
  createEntity,
  deleteEntity,
  updateEntity,
} from "@/lib/entities-repository";
import type { EntityKind, EntityRole } from "@/lib/domain-types";

function revalidate() {
  revalidatePath("/entities");
  revalidatePath("/");
}

export async function saveEntityAction(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  const rolesRaw = String(formData.get("roles") ?? "CUSTOMER");
  const roles = rolesRaw
    .split(",")
    .map((r) => r.trim())
    .filter(Boolean) as EntityRole[];

  const payload = {
    name: String(formData.get("name") ?? ""),
    entityKind: (String(formData.get("entityKind") ?? "INDIVIDUAL") === "COMPANY"
      ? "COMPANY"
      : "INDIVIDUAL") as EntityKind,
    roles: roles.length ? roles : (["CUSTOMER"] as EntityRole[]),
    taxId: String(formData.get("taxId") ?? ""),
    address: String(formData.get("address") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    email: String(formData.get("email") ?? ""),
    branchHeadOffice: formData.get("branchHeadOffice") !== "0",
    branchNo: String(formData.get("branchNo") ?? ""),
    bankName: String(formData.get("bankName") ?? ""),
    bankAccount: String(formData.get("bankAccount") ?? ""),
    defaultWhtPercent: String(formData.get("defaultWhtPercent") ?? "3"),
    notes: String(formData.get("notes") ?? ""),
  };

  const result = id ? await updateEntity(id, payload) : await createEntity(payload);
  if (result.ok) revalidate();
  return result;
}

export async function deleteEntityAction(id: string) {
  const result = await deleteEntity(id);
  if (result.ok) revalidate();
  return result;
}
