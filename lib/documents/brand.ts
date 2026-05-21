import { prisma } from "@/lib/prisma";

/** Logo ใน Firebase Storage — Company/Logo_HYEV.png */
export const COMPANY_LOGO_STORAGE_PATH = "Company/Logo_HYEV.png";

/** ค่าเริ่มต้นตามตัวอย่างเอกสาร (หาดใหญ่ อี วี) */
export const DEFAULT_COMPANY_BRAND = {
  companyName: "บริษัท หาดใหญ่ อี วี จำกัด",
  address:
    "เลขที่ 302 หมู่ 2 ถ. สนามบิน-ลพบุรีราเมศวร์ ต.ควนลัง อ.หาดใหญ่ จ.สงขลา 90110",
  taxId: "0905568005208",
  phone: "089-4664749, 086-3261860",
  email: "",
  logoUrl:
    process.env.NEXT_PUBLIC_COMPANY_LOGO_URL ??
    "https://firebasestorage.googleapis.com/v0/b/auto-repair-management.firebasestorage.app/o/Company%2FLogo_HYEV.png?alt=media&token=25341e05-002c-4e94-adb4-a6858377e417",
};

export type CompanyBrand = typeof DEFAULT_COMPANY_BRAND & {
  docPrefixInvoice: string;
  docPrefixTaxInvoice: string;
  docPrefixReceipt: string;
  docPrefixWht: string;
};

export async function loadCompanyBrand(): Promise<CompanyBrand> {
  const row = await prisma.companySettings.findUnique({ where: { id: 1 } });
  return {
    companyName: row?.companyName || DEFAULT_COMPANY_BRAND.companyName,
    address: row?.address || DEFAULT_COMPANY_BRAND.address,
    taxId: row?.taxId || DEFAULT_COMPANY_BRAND.taxId,
    phone: row?.phone || DEFAULT_COMPANY_BRAND.phone,
    email: row?.email || DEFAULT_COMPANY_BRAND.email,
    logoUrl:
      process.env.NEXT_PUBLIC_COMPANY_LOGO_URL?.trim() || DEFAULT_COMPANY_BRAND.logoUrl,
    docPrefixInvoice: row?.docPrefixInvoice || "INV",
    docPrefixTaxInvoice: row?.docPrefixTaxInvoice || "TAX",
    docPrefixReceipt: row?.docPrefixReceipt || "RT",
    docPrefixWht: row?.docPrefixWht || "WHT",
  };
}
