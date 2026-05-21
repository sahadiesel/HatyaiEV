"use server";

import {
  loadCompanySettingsFull,
  saveCompanySettingsAdmin,
  type CompanySettingsFull,
} from "@/lib/company-settings-server";
import { canWriteFirestore, FIRESTORE_WRITE_HINT, isFirestorePrimary } from "@/lib/data-primary";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export type SaveCompanySettingsResult =
  | { ok: true }
  | { ok: false; message: string };

export async function saveCompanySettings(formData: FormData): Promise<SaveCompanySettingsResult> {
  const payload: CompanySettingsFull = {
    companyName: String(formData.get("companyName") ?? ""),
    address: String(formData.get("address") ?? ""),
    taxId: String(formData.get("taxId") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    email: String(formData.get("email") ?? ""),
    docPrefixInvoice: String(formData.get("docPrefixInvoice") ?? "INV"),
    docPrefixTaxInvoice: String(formData.get("docPrefixTaxInvoice") ?? "TAX"),
    docPrefixReceipt: String(formData.get("docPrefixReceipt") ?? "RC"),
    docPrefixPo: String(formData.get("docPrefixPo") ?? "PO"),
    docPrefixWht: String(formData.get("docPrefixWht") ?? "WHT"),
  };

  if (isFirestorePrimary()) {
    if (!canWriteFirestore()) {
      return { ok: false, message: FIRESTORE_WRITE_HINT };
    }
    try {
      await saveCompanySettingsAdmin(payload);
    } catch (e) {
      const message = e instanceof Error ? e.message : "บันทึก Firestore ไม่สำเร็จ";
      console.error("[saveCompanySettings] firestore", e);
      return { ok: false, message };
    }
    revalidatePath("/settings");
    revalidatePath("/");
    return { ok: true };
  }

  try {
    await prisma.companySettings.upsert({
      where: { id: 1 },
      create: { id: 1, ...payload },
      update: payload,
    });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : typeof e === "string" ? e : "บันทึก SQLite ไม่สำเร็จ";
    console.error("[saveCompanySettings] prisma", e);
    return { ok: false, message };
  }

  revalidatePath("/settings");
  revalidatePath("/");
  return { ok: true };
}

export async function getCompanySettingsForForm(): Promise<CompanySettingsFull | null> {
  return loadCompanySettingsFull();
}
