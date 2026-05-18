import { prisma } from "@/lib/prisma";

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * เลขที่สัญญารับจ้าง: HC-{ปี}-{ลำดับ 3 หลัก} เช่น HC-2026-001
 */
export async function nextHiringContractCode(now = new Date()): Promise<string> {
  const year = now.getFullYear();
  const prefix = `HC-${year}-`;
  const re = new RegExp(`^${escapeRegex(prefix)}(\\d+)$`);
  const rows = await prisma.hiringContract.findMany({
    where: { code: { startsWith: prefix } },
    select: { code: true },
  });
  let max = 0;
  for (const r of rows) {
    const m = r.code.match(re);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}

/**
 * เลขที่สัญญาว่าจ้าง: SA-{ปี}-{ลำดับ 3 หลัก} เช่น SA-2026-001
 */
export async function nextSubcontractAgreementCode(now = new Date()): Promise<string> {
  const year = now.getFullYear();
  const prefix = `SA-${year}-`;
  const re = new RegExp(`^${escapeRegex(prefix)}(\\d+)$`);
  const rows = await prisma.subcontractAgreement.findMany({
    where: { code: { startsWith: prefix } },
    select: { code: true },
  });
  let max = 0;
  for (const r of rows) {
    const m = r.code.match(re);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}
