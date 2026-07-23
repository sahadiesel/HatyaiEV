import type { DocumentKind } from "@/lib/documents-firestore-types";
import { DocumentsListClient } from "./DocumentsListClient";

export async function DocumentTable({ kind }: { kind: DocumentKind }) {
  return <DocumentsListClient kind={kind} />;
}
