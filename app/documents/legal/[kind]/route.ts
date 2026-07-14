import { NextRequest } from "next/server";
import { loadCompanyBrand } from "@/lib/documents/brand";
import { fetchCompanyLogoDataUrl, fetchImageAsDataUrl } from "@/lib/documents/company-logo";
import {
  buildPurchaseContractHtml,
  buildReceivingTicketHtml,
  buildRepairContractHtml,
  buildSaleContractHtml,
} from "@/lib/documents/legal-print";
import { getEntity } from "@/lib/entities-repository";
import { getRepairContract } from "@/lib/repair-contracts-repository";
import { getVehicle } from "@/lib/vehicles-repository";
import { parseAmount } from "@/lib/documents/calc";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ kind: string }> },
) {
  const { kind } = await ctx.params;
  const sp = req.nextUrl.searchParams;
  const vehicleId = sp.get("vehicleId") || "";
  const contractId = sp.get("contractId") || "";
  const depositPercent = Number(sp.get("deposit") || "70") || 70;
  const balancePercent = Number(sp.get("balance") || "30") || 30;

  const company = await loadCompanyBrand();
  const [logoUrl, signatureDataUrl, stampDataUrl] = await Promise.all([
    fetchCompanyLogoDataUrl(),
    fetchImageAsDataUrl(company.signatureUrl),
    fetchImageAsDataUrl(company.stampUrl),
  ]);
  if (signatureDataUrl) company.signatureUrl = signatureDataUrl;
  if (stampDataUrl) company.stampUrl = stampDataUrl;

  if (kind === "repair" && contractId) {
    const contract = await getRepairContract(contractId);
    if (!contract) return new Response("ไม่พบสัญญา", { status: 404 });
    const counterparty = contract.counterpartyEntityId
      ? await getEntity(contract.counterpartyEntityId)
      : null;
    const html = buildRepairContractHtml({
      company,
      logoUrl: logoUrl || "",
      contract,
      counterparty,
    });
    return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }

  if (!vehicleId) {
    return new Response("ต้องระบุ vehicleId หรือ contractId", { status: 400 });
  }

  const vehicle = await getVehicle(vehicleId);
  if (!vehicle) return new Response("ไม่พบรถ", { status: 404 });

  const seller = vehicle.sellerEntityId ? await getEntity(vehicle.sellerEntityId) : null;
  const buyer = vehicle.buyerEntityId ? await getEntity(vehicle.buyerEntityId) : null;

  let html = "";
  if (kind === "purchase") {
    html = buildPurchaseContractHtml({
      company,
      logoUrl: logoUrl || "",
      vehicle,
      seller,
      depositPercent,
      balancePercent,
      amount: parseAmount(vehicle.purchasePrice),
    });
  } else if (kind === "sale") {
    const amount = parseAmount(vehicle.expectedSalePrice) || parseAmount(vehicle.soldPrice);
    html = buildSaleContractHtml({
      company,
      logoUrl: logoUrl || "",
      vehicle,
      buyer,
      depositPercent,
      balancePercent,
      amount,
    });
  } else if (kind === "receiving") {
    html = buildReceivingTicketHtml({ company, logoUrl: logoUrl || "", vehicle, seller });
  } else {
    return new Response("ชนิดเอกสารไม่รองรับ", { status: 400 });
  }

  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
