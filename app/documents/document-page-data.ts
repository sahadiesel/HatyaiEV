import type { DocumentKind } from "@prisma/client";
import { notFound } from "next/navigation";
import { listClients } from "@/lib/clients-repository";
import { listContractors } from "@/lib/contractors-repository";
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
  const rows = await listClients();
  return rows.map((c) => ({
    id: c.id,
    name: c.name,
    taxId: c.taxId,
    address: c.address,
    phone: c.phone,
  }));
}

export async function loadContractorsForDocument() {
  const rows = await listContractors();
  return rows.map((c) => ({
    id: c.id,
    name: c.name,
    taxId: c.taxId,
    address: c.address,
    defaultWhtPercent: c.defaultWhtPercent,
  }));
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
