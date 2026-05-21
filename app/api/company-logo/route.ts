import { NextResponse } from "next/server";
import { companyLogoPublicUrl, fetchCompanyLogoDataUrl } from "@/lib/documents/company-logo";

/** แสดง logo บริษัท — ใช้ในหน้าพิมพ์ / preview */
export async function GET() {
  const dataUrl = await fetchCompanyLogoDataUrl();
  if (dataUrl.startsWith("data:")) {
    const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (m) {
      const body = Buffer.from(m[2], "base64");
      return new NextResponse(body, {
        headers: {
          "Content-Type": m[1],
          "Cache-Control": "public, max-age=3600",
        },
      });
    }
  }

  const fallback = companyLogoPublicUrl();
  return NextResponse.redirect(fallback);
}
