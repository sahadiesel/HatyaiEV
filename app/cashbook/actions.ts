"use server";

import { revalidatePath } from "next/cache";
import {
  deleteCashbookEntry,
  postCashbookEntry,
  setOpeningBalance,
} from "@/lib/cashbook-repository";
import type { CashDirection } from "@/lib/domain-types";

function revalidate() {
  revalidatePath("/cashbook");
  revalidatePath("/");
}

export async function saveManualCashEntryAction(formData: FormData) {
  const direction = (String(formData.get("direction") ?? "OUT") as CashDirection) || "OUT";
  const result = await postCashbookEntry({
    entryDate: String(formData.get("entryDate") ?? "") || undefined,
    direction,
    entryType: "MANUAL",
    amount: String(formData.get("amount") ?? "0"),
    description: String(formData.get("description") ?? ""),
    createdByName: String(formData.get("createdByName") ?? ""),
  });
  if (result.ok) revalidate();
  return result;
}

export async function setOpeningBalanceAction(formData: FormData) {
  const result = await setOpeningBalance(String(formData.get("openingBalance") ?? "0"));
  if (result.ok) revalidate();
  return result;
}

export async function deleteCashEntryAction(id: string) {
  const result = await deleteCashbookEntry(id);
  if (result.ok) revalidate();
  return result;
}
