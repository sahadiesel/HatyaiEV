import { COMPANY_LOGO_STORAGE_PATH } from "./company-logo-path";

/** Token จาก Firebase Console (อัปเดตเมื่ออัปโหลด Logo_HYEV.png ใหม่) */
const DEFAULT_LOGO_ACCESS_TOKEN = "25341e05-002c-4e94-adb4-a6858377e417";

function storageBucketHost(): string {
  const raw =
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.replace(/^gs:\/\//, "") ??
    "auto-repair-management.firebasestorage.app";
  return raw.replace(/\.appspot\.com$/i, ".firebasestorage.app");
}

/** URL ดาวน์โหลด logo จาก Firebase Storage */
export function companyLogoDownloadUrls(): string[] {
  const bucket = storageBucketHost();
  const encoded = encodeURIComponent(COMPANY_LOGO_STORAGE_PATH);
  const base = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encoded}?alt=media`;
  const withToken = `${base}&token=${DEFAULT_LOGO_ACCESS_TOKEN}`;
  return [
    process.env.NEXT_PUBLIC_COMPANY_LOGO_URL?.trim(),
    withToken,
    base,
  ].filter((u): u is string => Boolean(u));
}

/** @deprecated ใช้ companyLogoDownloadUrls */
export function companyLogoPublicUrl(): string {
  return companyLogoDownloadUrls()[0] ?? "";
}

async function fetchUrlAsDataUrl(url: string): Promise<string> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return "";
  const contentType = res.headers.get("content-type") ?? "image/png";
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length === 0) return "";
  return `data:${contentType};base64,${buf.toString("base64")}`;
}

/** โหลด logo เป็น data URL สำหรับฝังใน HTML พิมพ์ (ไม่พึ่ง CORS/token ฝั่งเบราว์เซอร์) */
export async function fetchCompanyLogoDataUrl(): Promise<string> {
  for (const url of companyLogoDownloadUrls()) {
    try {
      const data = await fetchUrlAsDataUrl(url);
      if (data) return data;
    } catch {
      /* ลอง URL ถัดไป */
    }
  }
  return "";
}

/** โหลดรูปจาก URL (ลายเซ็น / ตรายาง) เป็น data URL สำหรับพิมพ์ */
export async function fetchImageAsDataUrl(url: string | null | undefined): Promise<string> {
  if (!url?.trim()) return "";
  try {
    return (await fetchUrlAsDataUrl(url.trim())) || "";
  } catch {
    return "";
  }
}
