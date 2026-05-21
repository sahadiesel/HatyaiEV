import { listClientsFromFirestore } from "@/lib/firestore-entities";
import { prisma } from "@/lib/prisma";
import { ClientPageShell, type ClientRow } from "./ClientPageShell";

export default async function ClientsPage() {
  const fsRows = await listClientsFromFirestore();
  const rows =
    fsRows !== null
      ? fsRows
      : await prisma.client.findMany({ orderBy: { createdAt: "desc" } });

  const initialClients: ClientRow[] = rows.map((c) => ({
    id: c.id,
    code: (c as { code?: string | null }).code ?? null,
    name: c.name,
    taxId: c.taxId,
    phone: c.phone,
    email: c.email,
  }));

  return <ClientPageShell initialClients={initialClients} />;
}
