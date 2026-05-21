import { listContractorsFromFirestore } from "@/lib/firestore-entities";
import { prisma } from "@/lib/prisma";
import { ContractorPageShell, type ContractorRow } from "./ContractorPageShell";

export default async function ContractorsPage() {
  const fsRows = await listContractorsFromFirestore();
  const rows =
    fsRows !== null
      ? fsRows
      : await prisma.contractor.findMany({ orderBy: { createdAt: "desc" } });

  const initialRows: ContractorRow[] = rows.map((r) => ({
    id: r.id,
    code: (r as { code?: string | null }).code ?? null,
    name: r.name,
    taxId: r.taxId,
    defaultWhtPercent: String(r.defaultWhtPercent),
  }));

  return <ContractorPageShell initialRows={initialRows} />;
}
