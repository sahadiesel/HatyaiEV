import { prisma } from "@/lib/prisma";

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** ผู้ว่าจ้าง: CL-{ปี}-{ลำดับ} */
export async function nextClientCode(now = new Date()): Promise<string> {
  const year = now.getFullYear();
  const prefix = `CL-${year}-`;
  const re = new RegExp(`^${escapeRegex(prefix)}(\\d+)$`);
  const rows = await prisma.client.findMany({
    where: { code: { startsWith: prefix } },
    select: { code: true },
  });
  let max = 0;
  for (const r of rows) {
    const c = r.code;
    if (!c) continue;
    const m = c.match(re);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}

/** ผู้รับเหมา: CR-{ปี}-{ลำดับ} */
export async function nextContractorCode(now = new Date()): Promise<string> {
  const year = now.getFullYear();
  const prefix = `CR-${year}-`;
  const re = new RegExp(`^${escapeRegex(prefix)}(\\d+)$`);
  const rows = await prisma.contractor.findMany({
    where: { code: { startsWith: prefix } },
    select: { code: true },
  });
  let max = 0;
  for (const r of rows) {
    const c = r.code;
    if (!c) continue;
    const m = c.match(re);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}
