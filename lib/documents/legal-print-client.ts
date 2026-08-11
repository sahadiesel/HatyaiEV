"use client";

import { parseAmount } from "@/lib/documents/calc";
import { buildVehicleSalePurchaseContractHtml } from "@/lib/documents/contract-print";
import {
  buildPurchaseContractHtml,
  buildReceivingTicketHtml,
  buildRepairContractHtml,
  buildSaleContractHtml,
} from "@/lib/documents/legal-print";
import { loadCompanyBrandClient, openPrintHtml } from "@/lib/documents/print-client";
import { parsePurchaseContractTerms } from "@/lib/documents/purchase-contract-terms";
import type {
  ContractPartySnapshot,
  LegalDocRecord,
  RepairContractKind,
  RepairContractRecord,
  RepairContractStatus,
} from "@/lib/domain-types";
import { listEntitiesClient } from "@/lib/entities-client";
import { getFirestoreDb } from "@/lib/firebase";
import { firestoreCollections } from "@/lib/firestore-collections";
import { listLegalDocsClient } from "@/lib/legal-documents-client";
import { getVehicleClient } from "@/lib/vehicles-client";
import { calcPurchasePaymentSummary } from "@/lib/vehicles/calc";
import { doc, getDoc } from "firebase/firestore";

export type LegalVehiclePrintKind = "purchase" | "sale" | "receiving";

function parseRepairContract(id: string, d: Record<string, unknown>): RepairContractRecord {
  return {
    id,
    code: typeof d.code === "string" ? d.code : null,
    kind: (d.kind as RepairContractKind) || "SERVICE_TO_CUSTOMER",
    title: String(d.title ?? ""),
    status: (d.status as RepairContractStatus) || "DRAFT",
    counterpartyEntityId: d.counterpartyEntityId ? String(d.counterpartyEntityId) : null,
    vehicleId: d.vehicleId ? String(d.vehicleId) : null,
    customerVehicleLabel: String(d.customerVehicleLabel ?? ""),
    symptoms: String(d.symptoms ?? ""),
    agreedPriceExVat: String(d.agreedPriceExVat ?? "0"),
    vatRate: String(d.vatRate ?? "7"),
    notes: String(d.notes ?? ""),
    issueDate: String(d.issueDate ?? ""),
  };
}

async function getRepairContractClient(id: string): Promise<RepairContractRecord | null> {
  const db = getFirestoreDb();
  if (!db) return null;
  try {
    const snap = await getDoc(doc(db, firestoreCollections.repairContracts, id));
    if (!snap.exists()) return null;
    return parseRepairContract(snap.id, snap.data() as Record<string, unknown>);
  } catch (e) {
    console.error("[getRepairContractClient]", e);
    return null;
  }
}

/** พิมพ์สัญญาซื้อ/ขาย/ใบรับรถ ฝั่ง client (ไม่พึ่ง Admin SDK) */
export async function printLegalVehicleDocClient(
  kind: LegalVehiclePrintKind,
  vehicleId: string,
  opts?: {
    depositPercent?: number;
    balancePercent?: number;
    docNumber?: string;
    issueDate?: string;
  },
): Promise<{ ok: true } | { ok: false; message: string }> {
  const vehicle = await getVehicleClient(vehicleId);
  if (!vehicle) return { ok: false, message: "ไม่พบรถคันนี้" };

  const [company, entities, legalDocs] = await Promise.all([
    loadCompanyBrandClient(),
    listEntitiesClient(),
    listLegalDocsClient(),
  ]);
  const seller = vehicle.sellerEntityId
    ? entities.find((e) => e.id === vehicle.sellerEntityId) || null
    : null;
  const buyer = vehicle.buyerEntityId
    ? entities.find((e) => e.id === vehicle.buyerEntityId) || null
    : null;

  const depositPercent = opts?.depositPercent ?? 70;
  const balancePercent = opts?.balancePercent ?? 30;
  const logoUrl = company.logoUrl || "";
  const legalFor = (kinds: string[]) =>
    legalDocs.find((r) => r.vehicleId === vehicleId && kinds.includes(r.kind)) || null;

  let html = "";
  if (kind === "purchase") {
    const legal = legalFor(["PURCHASE_CONTRACT"]);
    const amount =
      parseAmount(legal?.amount || "") ||
      calcPurchasePaymentSummary(vehicle).obligation ||
      parseAmount(vehicle.purchasePrice);
    const terms = parsePurchaseContractTerms(legal?.paymentTermsJson);
    html = buildPurchaseContractHtml({
      company,
      logoUrl,
      vehicle,
      seller,
      amount,
      paymentLines: terms.paymentLines.map((l) => ({
        label: l.label,
        amount: parseAmount(l.amount),
        note: l.note,
      })),
      docNumber: opts?.docNumber || legal?.number,
      issueDate: opts?.issueDate || legal?.issueDate || vehicle.purchaseDate,
    });
  } else if (kind === "sale") {
    const legal = legalFor(["VEHICLE_SALE_CONTRACT", "SALE_CONTRACT"]);
    const amount =
      parseAmount(vehicle.saleContractAmount) ||
      parseAmount(vehicle.expectedSalePrice) ||
      parseAmount(vehicle.soldPrice);
    html = buildSaleContractHtml({
      company,
      logoUrl,
      vehicle,
      buyer,
      depositPercent,
      balancePercent,
      amount,
      docNumber: opts?.docNumber || legal?.number,
      issueDate: opts?.issueDate || legal?.issueDate || vehicle.soldDate || "",
    });
  } else if (kind === "receiving") {
    const legal = legalFor(["VEHICLE_RECEIVING"]);
    html = buildReceivingTicketHtml({
      company,
      logoUrl,
      vehicle,
      seller,
      docNumber: opts?.docNumber || legal?.number,
      issueDate: opts?.issueDate || legal?.issueDate || vehicle.purchaseDate,
    });
  } else {
    return { ok: false, message: "ชนิดเอกสารไม่รองรับ" };
  }

  openPrintHtml(html);
  return { ok: true };
}

/** พิมพ์สัญญาขายจากรายการ (ใช้ meta ที่บันทึกไว้ ถ้ามี) */
export async function printVehicleSaleLegalDocClient(
  legal: LegalDocRecord,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!legal.vehicleId) return { ok: false, message: "เอกสารนี้ไม่ได้ผูกกับรถ" };

  let meta: Record<string, unknown> = {};
  try {
    meta = JSON.parse(legal.metaJson || "{}") as Record<string, unknown>;
  } catch {
    meta = {};
  }

  const hasDetailed = meta && typeof meta === "object" && meta.counterparty;
  if (!hasDetailed) {
    return printLegalVehicleDocClient("sale", legal.vehicleId, {
      docNumber: legal.number,
      issueDate: legal.issueDate,
    });
  }

  const company = await loadCompanyBrandClient();
  const counterparty = meta.counterparty as ContractPartySnapshot;
  const html = buildVehicleSalePurchaseContractHtml({
    company,
    logoUrl: company.logoUrl || "",
    hyevRole: meta.hyevRole === "BUYER" ? "BUYER" : "SELLER",
    counterparty,
    issuePlace: String(meta.issuePlace ?? company.companyName),
    issueDate: legal.issueDate,
    vehicleCondition: String(meta.vehicleCondition ?? ""),
    brand: String(meta.brand ?? ""),
    model: String(meta.model ?? ""),
    licensePlate: String(meta.licensePlate ?? ""),
    vin: String(meta.vin ?? ""),
    amount: parseAmount(legal.amount),
    depositPercent: Number(legal.depositPercent || 70) || 70,
    balancePercent: Number(legal.balancePercent || 30) || 30,
    bankName: String(meta.bankName ?? ""),
    bankAccount: String(meta.bankAccount ?? ""),
    bankAccountName: String(meta.bankAccountName ?? ""),
    improvements: Array.isArray(meta.improvements)
      ? meta.improvements.map(String)
      : [],
    deliveryDeadline: String(meta.deliveryDeadline ?? ""),
    deliveryPlace: String(meta.deliveryPlace ?? ""),
    authorizedDirectorName: String(meta.authorizedDirectorName ?? ""),
  });
  openPrintHtml(html);
  return { ok: true };
}

/** พิมพ์สัญญาซ่อม/จ้างต่อ ฝั่ง client */
export async function printLegalRepairDocClient(
  contractId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const contract = await getRepairContractClient(contractId);
  if (!contract) return { ok: false, message: "ไม่พบสัญญา" };

  const [company, entities] = await Promise.all([
    loadCompanyBrandClient(),
    listEntitiesClient(),
  ]);
  const counterparty = contract.counterpartyEntityId
    ? entities.find((e) => e.id === contract.counterpartyEntityId) || null
    : null;

  const html = buildRepairContractHtml({
    company,
    logoUrl: company.logoUrl || "",
    contract,
    counterparty,
  });
  openPrintHtml(html);
  return { ok: true };
}
