/** URL หน้าพิมพ์เอกสาร — ส่งชื่อผู้ออกเอกสารผ่าน query (ชื่อผู้ login) */
export function documentPrintUrl(documentId: string, issuedByName?: string | null): string {
  const name = (issuedByName ?? "").trim();
  const q = name ? `?issuedBy=${encodeURIComponent(name)}` : "";
  return `/documents/print/${documentId}${q}`;
}
