import { listClients } from "@/lib/clients-repository";
import { ClientPageShell, type ClientRow } from "./ClientPageShell";

export default async function ClientsPage() {
  const rows = await listClients();

  const initialClients: ClientRow[] = rows.map((c) => ({
    id: c.id,
    code: c.code,
    name: c.name,
    taxId: c.taxId,
    phone: c.phone,
    email: c.email,
  }));

  return <ClientPageShell initialClients={initialClients} />;
}
