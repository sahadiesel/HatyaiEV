import { prisma } from "@/lib/prisma";
import { useFirestorePrimary } from "./data-primary";
import { listHiringContractsFromFirestore } from "./hiring-contracts-repository";
import { listSubcontractAgreementsFromFirestore } from "./subcontract-agreements-repository";

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function nextCodeFromList(codes: string[], prefix: string): string {
  const re = new RegExp(`^${escapeRegex(prefix)}(\\d+)$`);
  let max = 0;
  for (const code of codes) {
    const m = code.match(re);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}

/**
 * เลขที่สัญญารับจ้าง: HC-{ปี}-{ลำดับ 3 หลัก} เช่น HC-2026-001
 */
export async function nextHiringContractCode(now = new Date()): Promise<string> {
  const year = now.getFullYear();
  const prefix = `HC-${year}-`;

  if (useFirestorePrimary()) {
    const rows = await listHiringContractsFromFirestore();
    if (rows !== null) {
      return nextCodeFromList(
        rows.map((r) => r.code),
        prefix,
      );
    }
  }

  const rows = await prisma.hiringContract.findMany({
    where: { code: { startsWith: prefix } },
    select: { code: true },
  });
  return nextCodeFromList(
    rows.map((r) => r.code),
    prefix,
  );
}

/**
 * เลขที่สัญญาว่าจ้าง: SA-{ปี}-{ลำดับ 3 หลัก} เช่น SA-2026-001
 */
export async function nextSubcontractAgreementCode(now = new Date()): Promise<string> {
  const year = now.getFullYear();
  const prefix = `SA-${year}-`;

  if (useFirestorePrimary()) {
    const rows = await listSubcontractAgreementsFromFirestore();
    if (rows !== null) {
      return nextCodeFromList(
        rows.map((r) => r.code),
        prefix,
      );
    }
  }

  const rows = await prisma.subcontractAgreement.findMany({
    where: { code: { startsWith: prefix } },
    select: { code: true },
  });
  return nextCodeFromList(
    rows.map((r) => r.code),
    prefix,
  );
}
