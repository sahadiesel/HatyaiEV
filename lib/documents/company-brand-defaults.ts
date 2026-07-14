/** ค่าเริ่มต้นแบรนด์ — ใช้ได้ทั้ง client และ server (ไม่มี Admin SDK) */
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
  signatureUrl: "",
  stampUrl: "",
};

export type CompanyBrandBase = typeof DEFAULT_COMPANY_BRAND;

export type CompanyBrand = CompanyBrandBase & {
  docPrefixInvoice: string;
  docPrefixTaxInvoice: string;
  docPrefixReceipt: string;
  docPrefixWht: string;
};
