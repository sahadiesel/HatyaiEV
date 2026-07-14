import { listClientCodesFromFirestore, listContractorCodesFromFirestore } from "@/lib/firestore-entities";

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function nextCodeFromList(codes: string[], prefix: string): string {
  const re = new RegExp(`^${escapeRegex(prefix)}(\\d+)$`);
  let max = 0;
  for (const c of codes) {
    const m = c.match(re);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}

/** ผู้ว่าจ้าง: CL-{ปี}-{ลำดับ} */
export async function nextClientCode(now = new Date()): Promise<string> {
  const year = now.getFullYear();
  const prefix = `CL-${year}-`;
  return nextCodeFromList(await listClientCodesFromFirestore(), prefix);
}

/** ผู้รับเหมา: CR-{ปี}-{ลำดับ} */
export async function nextContractorCode(now = new Date()): Promise<string> {
  const year = now.getFullYear();
  const prefix = `CR-${year}-`;
  return nextCodeFromList(await listContractorCodesFromFirestore(), prefix);
}
