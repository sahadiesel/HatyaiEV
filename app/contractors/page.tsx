import { listContractors } from "@/lib/contractors-repository";
import { ContractorPageShell, type ContractorRow } from "./ContractorPageShell";

export default async function ContractorsPage() {
  const rows = await listContractors();

  const initialRows: ContractorRow[] = rows.map((r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    taxId: r.taxId,
    defaultWhtPercent: r.defaultWhtPercent,
  }));

  return <ContractorPageShell initialRows={initialRows} />;
}
