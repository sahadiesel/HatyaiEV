import type { DocumentKind } from "@prisma/client";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  defaultCommercialMeta,
  defaultWithholdingMeta,
  parseLinesJson,
  parseMetaJson,
  type CommercialDocumentMeta,
  type WithholdingDocumentMeta,
} from "@/lib/documents/types";

export async function loadClientsForDocument() {
  return prisma.client.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, taxId: true, address: true, phone: true },
  });
}

export async function loadContractorsForDocument() {
  return prisma.contractor.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      taxId: true,
      address: true,
      defaultWhtPercent: true,
    },
  });
}

export async function loadCommercialDocument(id: string, kind: DocumentKind) {
  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc || doc.kind !== kind) notFound();
  return {
    id: doc.id,
    number: doc.number,
    issueDate: doc.issueDate.toISOString().slice(0, 10),
    clientId: doc.clientId,
    lines: parseLinesJson(doc.linesJson),
    meta: parseMetaJson<CommercialDocumentMeta>(doc.metaJson, defaultCommercialMeta()),
    notes: doc.notes,
  };
}

export async function loadWithholdingDocument(id: string) {
  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc || doc.kind !== "WITHHOLDING_TAX") notFound();
  return {
    id: doc.id,
    number: doc.number,
    issueDate: doc.issueDate.toISOString().slice(0, 10),
    contractorId: doc.contractorId,
    meta: parseMetaJson<WithholdingDocumentMeta>(doc.metaJson, defaultWithholdingMeta()),
    notes: doc.notes,
    subtotal: Number(doc.subtotal),
    withholdingAmount: Number(doc.withholdingAmount),
  };
}
