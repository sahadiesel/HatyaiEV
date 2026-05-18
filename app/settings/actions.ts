"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export type SaveCompanySettingsResult =
  | { ok: true }
  | { ok: false; message: string };

export async function saveCompanySettings(formData: FormData): Promise<SaveCompanySettingsResult> {
  const companyName = String(formData.get("companyName") ?? "");
  const address = String(formData.get("address") ?? "");
  const taxId = String(formData.get("taxId") ?? "");
  const phone = String(formData.get("phone") ?? "");
  const email = String(formData.get("email") ?? "");
  const docPrefixInvoice = String(formData.get("docPrefixInvoice") ?? "INV");
  const docPrefixTaxInvoice = String(formData.get("docPrefixTaxInvoice") ?? "TAX");
  const docPrefixReceipt = String(formData.get("docPrefixReceipt") ?? "RC");
  const docPrefixPo = String(formData.get("docPrefixPo") ?? "PO");
  const docPrefixWht = String(formData.get("docPrefixWht") ?? "WHT");

  try {
    await prisma.companySettings.upsert({
      where: { id: 1 },
      create: {
        id: 1,
        companyName,
        address,
        taxId,
        phone,
        email,
        docPrefixInvoice,
        docPrefixTaxInvoice,
        docPrefixReceipt,
        docPrefixPo,
        docPrefixWht,
      },
      update: {
        companyName,
        address,
        taxId,
        phone,
        email,
        docPrefixInvoice,
        docPrefixTaxInvoice,
        docPrefixReceipt,
        docPrefixPo,
        docPrefixWht,
      },
    });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : typeof e === "string" ? e : "บันทึก SQLite ไม่สำเร็จ";
    console.error("[saveCompanySettings]", e);
    return { ok: false, message };
  }

  revalidatePath("/settings");
  revalidatePath("/");
  return { ok: true };
}
