"use client";

import {
  DEFAULT_COMPANY_BRAND,
  type CompanyBrand,
} from "@/lib/documents/company-brand-defaults";
import { readCompanySettingsFromFirestore } from "@/lib/firestore";

export async function loadCompanyBrandClient(): Promise<CompanyBrand> {
  const logoUrl =
    process.env.NEXT_PUBLIC_COMPANY_LOGO_URL?.trim() || DEFAULT_COMPANY_BRAND.logoUrl;
  const fs = await readCompanySettingsFromFirestore();
  if (!fs) {
    return {
      ...DEFAULT_COMPANY_BRAND,
      logoUrl,
      docPrefixInvoice: "INV",
      docPrefixTaxInvoice: "TAX",
      docPrefixReceipt: "RT",
      docPrefixWht: "WHT",
    };
  }
  return {
    companyName: fs.companyName || DEFAULT_COMPANY_BRAND.companyName,
    address: fs.address || DEFAULT_COMPANY_BRAND.address,
    taxId: fs.taxId || DEFAULT_COMPANY_BRAND.taxId,
    phone: fs.phone || DEFAULT_COMPANY_BRAND.phone,
    email: fs.email || DEFAULT_COMPANY_BRAND.email,
    logoUrl,
    signatureUrl: fs.signatureUrl || "",
    stampUrl: fs.stampUrl || "",
    docPrefixInvoice: fs.docPrefixInvoice || "INV",
    docPrefixTaxInvoice: fs.docPrefixTaxInvoice || "TAX",
    docPrefixReceipt: fs.docPrefixReceipt || "RT",
    docPrefixWht: fs.docPrefixWht || "WHT",
  };
}

export function openPrintHtml(html: string) {
  const w = window.open("", "_blank");
  if (!w) {
    alert("เบราว์เซอร์บล็อกหน้าต่างพิมพ์ — อนุญาต pop-up แล้วลองอีกครั้ง");
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}
