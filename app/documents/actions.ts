"use server";

import { Prisma, type DocumentKind } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { calcCommercialTotals, calcWithholdingTotals, parseAmount, recalcLineAmount } from "@/lib/documents/calc";
import { nextDocumentNumber } from "@/lib/documents/next-number";
import {
  defaultCommercialMeta,
  defaultWithholdingMeta,
  DOCUMENT_KIND_ROUTES,
  parseLinesJson,
  parseMetaJson,
  type CommercialDocumentMeta,
  type DocumentLineItem,
  type WithholdingDocumentMeta,
} from "@/lib/documents/types";

const COMMERCIAL_KINDS: DocumentKind[] = ["INVOICE", "TAX_INVOICE", "RECEIPT"];

function revalidateDoc(kind: DocumentKind) {
  const slug = DOCUMENT_KIND_ROUTES[kind].slug;
  revalidatePath(`/documents/${slug}`);
  revalidatePath(`/documents/${slug}/new`);
}

function parseLinesFromForm(fd: FormData): DocumentLineItem[] {
  const raw = String(fd.get("linesJson") ?? "[]");
  try {
    const arr = JSON.parse(raw) as DocumentLineItem[];
    if (!Array.isArray(arr)) return [];
    return arr.map((l, i) => recalcLineAmount({ ...l, sequence: i + 1 }));
  } catch {
    return [];
  }
}

export async function saveCommercialDocument(formData: FormData) {
  const kind = String(formData.get("kind") ?? "") as DocumentKind;
  if (!COMMERCIAL_KINDS.includes(kind)) {
    return { ok: false as const, message: "ประเภทเอกสารไม่ถูกต้อง" };
  }
  const id = String(formData.get("id") ?? "").trim();
  const clientId = String(formData.get("clientId") ?? "").trim() || null;
  const issueDateStr = String(formData.get("issueDate") ?? "");
  const issueDate = issueDateStr ? new Date(issueDateStr) : new Date();
  const lines = parseLinesFromForm(formData);
  const issuedByName = String(formData.get("issuedByName") ?? "").trim();
  const meta = {
    ...parseMetaJson<CommercialDocumentMeta>(
      String(formData.get("metaJson") ?? ""),
      defaultCommercialMeta(),
    ),
    issuedByName,
  };
  const vatRate = meta.vatRatePercent ?? 7;
  const { subtotal, vatAmount, totalAmount } = calcCommercialTotals(lines, vatRate);
  const notes = String(formData.get("notes") ?? "");
  const assignNumber = formData.get("assignNumber") === "1";

  const data = {
    kind,
    issueDate,
    subtotal: new Prisma.Decimal(subtotal),
    vatAmount: new Prisma.Decimal(vatAmount),
    totalAmount: new Prisma.Decimal(totalAmount),
    withholdingAmount: new Prisma.Decimal(0),
    notes,
    linesJson: JSON.stringify(lines),
    metaJson: JSON.stringify(meta),
    clientId,
    contractorId: null as string | null,
  };

  if (id) {
    await prisma.document.update({ where: { id }, data });
    revalidateDoc(kind);
    return { ok: true as const, id, number: null };
  }

  try {
    const number = assignNumber ? await nextDocumentNumber(kind, issueDate) : "";
    const created = await prisma.document.create({
      data: { ...data, number },
    });
    revalidateDoc(kind);
    return { ok: true as const, id: created.id, number: created.number || null };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false as const, message };
  }
}

export async function saveWithholdingDocument(formData: FormData) {
  const kind: DocumentKind = "WITHHOLDING_TAX";
  const id = String(formData.get("id") ?? "").trim();
  const contractorId = String(formData.get("contractorId") ?? "").trim() || null;
  const issueDateStr = String(formData.get("issueDate") ?? "");
  const issueDate = issueDateStr ? new Date(issueDateStr) : new Date();
  const issuedByName = String(formData.get("issuedByName") ?? "").trim();
  const meta = {
    ...parseMetaJson<WithholdingDocumentMeta>(
      String(formData.get("metaJson") ?? ""),
      defaultWithholdingMeta(),
    ),
    issuedByName,
  };
  const base = parseAmount(meta.withholdingTaxBase);
  const whtRate = parseAmount(meta.withholdingTaxRatePercent);
  const vatRate = 7;
  const { subtotal, vatAmount, totalAmount, withholdingAmount } = calcWithholdingTotals({
    base,
    vatRatePercent: vatRate,
    whtRatePercent: whtRate,
  });
  const notes = String(formData.get("notes") ?? "");
  const assignNumber = formData.get("assignNumber") === "1";

  const data = {
    kind,
    issueDate,
    subtotal: new Prisma.Decimal(subtotal),
    vatAmount: new Prisma.Decimal(vatAmount),
    totalAmount: new Prisma.Decimal(totalAmount),
    withholdingAmount: new Prisma.Decimal(withholdingAmount),
    notes,
    linesJson: "[]",
    metaJson: JSON.stringify(meta),
    clientId: null as string | null,
    contractorId,
  };

  if (id) {
    await prisma.document.update({ where: { id }, data });
    revalidateDoc(kind);
    return { ok: true as const, id, number: null };
  }

  try {
    const number = assignNumber ? await nextDocumentNumber(kind, issueDate) : "";
    const created = await prisma.document.create({
      data: { ...data, number },
    });
    revalidateDoc(kind);
    return { ok: true as const, id: created.id, number: created.number || null };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false as const, message };
  }
}

export async function assignDocumentNumber(documentId: string) {
  const doc = await prisma.document.findUnique({ where: { id: documentId } });
  if (!doc) return { ok: false as const, message: "ไม่พบเอกสาร" };
  if (doc.number) return { ok: true as const, number: doc.number };
  const number = await nextDocumentNumber(doc.kind, doc.issueDate);
  await prisma.document.update({ where: { id: documentId }, data: { number } });
  revalidateDoc(doc.kind);
  return { ok: true as const, number };
}
