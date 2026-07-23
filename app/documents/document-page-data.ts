import type { DocumentKind } from "@/lib/documents-firestore-types";
import { notFound } from "next/navigation";
import { listEntities } from "@/lib/entities-repository";
import { entityHasRoleGroup } from "@/lib/entity-roles";
import { getDocument } from "@/lib/documents-repository";
import {
  defaultCommercialMeta,
  defaultWithholdingMeta,
  parseLinesJson,
  parseMetaJson,
  type CommercialDocumentMeta,
  type WithholdingDocumentMeta,
} from "@/lib/documents/types";

/** ลูกค้า/ผู้ซื้อ (+ ผู้ว่าจ้าง) จากทะเบียนคู่ค้า */
export async function loadClientsForDocument() {
  const rows = await listEntities();
  return rows
    .filter(
      (e) =>
        entityHasRoleGroup(e.roles, "CUSTOMER_BUYER") || entityHasRoleGroup(e.roles, "HIRER"),
    )
    .map((e) => ({
      id: e.id,
      name: e.name,
      taxId: e.taxId,
      address: e.address,
      phone: e.phone,
      branchHeadOffice: e.branchHeadOffice,
      branchNo: e.branchNo,
    }));
}

export async function loadContractorsForDocument() {
  const rows = await listEntities();
  return rows
    .filter((e) => entityHasRoleGroup(e.roles, "CONTRACTOR"))
    .map((e) => ({
      id: e.id,
      name: e.name,
      taxId: e.taxId,
      address: e.address,
      defaultWhtPercent: e.defaultWhtPercent,
    }));
}

export async function loadCommercialDocument(id: string, kind: DocumentKind) {
  const doc = await getDocument(id);
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
  const doc = await getDocument(id);
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
