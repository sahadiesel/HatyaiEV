import { loadCompanySettingsFull } from "@/lib/company-settings-server";
import {
  DEFAULT_COMPANY_BRAND,
  type CompanyBrand,
} from "@/lib/documents/company-brand-defaults";

export { COMPANY_LOGO_STORAGE_PATH } from "@/lib/documents/company-logo-path";
export { DEFAULT_COMPANY_BRAND, type CompanyBrand } from "@/lib/documents/company-brand-defaults";

/** Logo ใน Firebase Storage — Company/Logo_HYEV.png */
export async function loadCompanyBrand(): Promise<CompanyBrand> {
  const logoUrl =
    process.env.NEXT_PUBLIC_COMPANY_LOGO_URL?.trim() || DEFAULT_COMPANY_BRAND.logoUrl;

  const fs = await loadCompanySettingsFull();
  if (fs) {
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

  return {
    ...DEFAULT_COMPANY_BRAND,
    logoUrl,
    docPrefixInvoice: "INV",
    docPrefixTaxInvoice: "TAX",
    docPrefixReceipt: "RT",
    docPrefixWht: "WHT",
  };
}
