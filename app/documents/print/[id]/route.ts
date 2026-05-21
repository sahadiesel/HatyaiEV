import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { loadCompanyBrand } from "@/lib/documents/brand";
import { fetchCompanyLogoDataUrl } from "@/lib/documents/company-logo";
import {
  buildCommercialPrintHtml,
  buildWithholdingPrintHtml,
} from "@/lib/documents/print-html";
import {
  defaultCommercialMeta,
  defaultWithholdingMeta,
  parseLinesJson,
  parseMetaJson,
  type CommercialDocumentMeta,
  type WithholdingDocumentMeta,
} from "@/lib/documents/types";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const issuedByFromQuery = new URL(req.url).searchParams.get("issuedBy")?.trim() ?? "";
  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) {
    return new NextResponse("ไม่พบเอกสาร", { status: 404 });
  }

  const [company, logoDataUrl] = await Promise.all([loadCompanyBrand(), fetchCompanyLogoDataUrl()]);
  if (logoDataUrl) company.logoUrl = logoDataUrl;
  const subtotal = Number(doc.subtotal);
  const vatAmount = Number(doc.vatAmount);
  const totalAmount = Number(doc.totalAmount);
  const withholdingAmount = Number(doc.withholdingAmount);

  let html: string;
  if (doc.kind === "WITHHOLDING_TAX") {
    const meta = parseMetaJson<WithholdingDocumentMeta>(doc.metaJson, defaultWithholdingMeta());
    html = buildWithholdingPrintHtml({
      company,
      number: doc.number,
      issueDate: doc.issueDate,
      meta,
      subtotal,
      vatAmount,
      totalAmount,
      withholdingAmount,
      issuedByName: issuedByFromQuery || meta.issuedByName,
    });
  } else {
    const lines = parseLinesJson(doc.linesJson);
    const meta = parseMetaJson<CommercialDocumentMeta>(doc.metaJson, defaultCommercialMeta());
    html = buildCommercialPrintHtml({
      kind: doc.kind,
      company,
      number: doc.number,
      issueDate: doc.issueDate,
      lines,
      meta,
      subtotal,
      vatAmount,
      totalAmount,
      notes: doc.notes,
      issuedByName: issuedByFromQuery || meta.issuedByName,
    });
  }

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
