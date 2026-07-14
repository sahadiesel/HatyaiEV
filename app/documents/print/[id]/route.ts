import { NextResponse } from "next/server";
import { getDocument } from "@/lib/documents-repository";
import { loadCompanyBrand } from "@/lib/documents/brand";
import { fetchCompanyLogoDataUrl, fetchImageAsDataUrl } from "@/lib/documents/company-logo";
import {
  buildCommercialPrintHtml,
  buildPaymentVoucherPrintHtml,
  buildWithholdingPrintHtml,
} from "@/lib/documents/print-html";
import {
  defaultCommercialMeta,
  defaultPaymentVoucherMeta,
  defaultWithholdingMeta,
  parseLinesJson,
  parseMetaJson,
  type CommercialDocumentMeta,
  type PaymentVoucherMeta,
  type WithholdingDocumentMeta,
} from "@/lib/documents/types";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const issuedByFromQuery = new URL(req.url).searchParams.get("issuedBy")?.trim() ?? "";
  const doc = await getDocument(id);
  if (!doc) {
    return new NextResponse("ไม่พบเอกสาร", { status: 404 });
  }

  const company = await loadCompanyBrand();
  const [logoDataUrl, signatureDataUrl, stampDataUrl] = await Promise.all([
    fetchCompanyLogoDataUrl(),
    fetchImageAsDataUrl(company.signatureUrl),
    fetchImageAsDataUrl(company.stampUrl),
  ]);
  if (logoDataUrl) company.logoUrl = logoDataUrl;
  if (signatureDataUrl) company.signatureUrl = signatureDataUrl;
  if (stampDataUrl) company.stampUrl = stampDataUrl;

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
  } else if (doc.kind === "PAYMENT_VOUCHER") {
    const meta = parseMetaJson<PaymentVoucherMeta>(doc.metaJson, defaultPaymentVoucherMeta());
    html = buildPaymentVoucherPrintHtml({
      company,
      number: doc.number,
      issueDate: doc.issueDate,
      meta,
      totalAmount,
      notes: doc.notes,
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
