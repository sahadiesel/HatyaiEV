"use client";

import { getDocumentClient, listDocumentsClient } from "@/lib/documents-client";
import type { DocumentListItem } from "@/lib/documents-firestore-types";
import type { LegalDocRecord, VehicleRecord } from "@/lib/domain-types";
import {
  defaultCommercialMeta,
  parseMetaJson,
  type CommercialDocumentMeta,
} from "@/lib/documents/types";
import { listLegalDocsClient, saveLegalDocClient } from "@/lib/legal-documents-client";
import { calcPurchasePaymentSummary } from "@/lib/vehicles/calc";

export type VehicleDocumentPack = {
  purchaseContract: LegalDocRecord | null;
  receivingTicket: LegalDocRecord | null;
  saleContract: LegalDocRecord | null;
  taxInvoices: DocumentListItem[];
  receipts: DocumentListItem[];
};

/** โหลดชุดเอกสารที่ผูกกับรถคันนี้ */
export async function loadVehicleDocumentPack(vehicleId: string): Promise<VehicleDocumentPack> {
  const [legal, taxInvoicesAll, receiptsAll] = await Promise.all([
    listLegalDocsClient(),
    listDocumentsClient("TAX_INVOICE"),
    listDocumentsClient("RECEIPT"),
  ]);

  const forVehicle = (rows: LegalDocRecord[], kinds: LegalDocRecord["kind"][]) =>
    rows.find((r) => r.vehicleId === vehicleId && kinds.includes(r.kind)) || null;

  const filterCommercial = (rows: DocumentListItem[]) =>
    rows.filter((r) => {
      try {
        const meta = JSON.parse(r.metaJson || "{}") as { vehicleId?: string };
        return meta.vehicleId === vehicleId;
      } catch {
        return false;
      }
    });

  return {
    purchaseContract: forVehicle(legal, ["PURCHASE_CONTRACT"]),
    receivingTicket: forVehicle(legal, ["VEHICLE_RECEIVING"]),
    saleContract: forVehicle(legal, ["VEHICLE_SALE_CONTRACT", "SALE_CONTRACT"]),
    taxInvoices: filterCommercial(taxInvoicesAll),
    receipts: filterCommercial(receiptsAll),
  };
}

/** สร้าง/ดึงสัญญาซื้อเข้าที่บันทึกในระบบ แล้วเปิดพิมพ์ */
export async function ensurePurchaseContractClient(
  vehicle: VehicleRecord,
): Promise<{ ok: true; id: string; number: string } | { ok: false; message: string }> {
  const pack = await loadVehicleDocumentPack(vehicle.id);
  if (pack.purchaseContract) {
    return {
      ok: true,
      id: pack.purchaseContract.id,
      number: pack.purchaseContract.number,
    };
  }
  const amount = calcPurchasePaymentSummary(vehicle).obligation;
  return saveLegalDocClient({
    kind: "PURCHASE_CONTRACT",
    issueDate: vehicle.purchaseDate || new Date().toISOString().slice(0, 10),
    vehicleId: vehicle.id,
    repairContractId: null,
    sellerEntityId: vehicle.sellerEntityId,
    buyerEntityId: null,
    hirerEntityId: null,
    contractorEntityId: null,
    paymentTermsJson: "{}",
    amount: String(amount),
    depositPercent: "0",
    balancePercent: "100",
    notes: `สัญญาซื้อเข้า ${vehicle.brand} ${vehicle.model} ${vehicle.licensePlate || ""}`.trim(),
    metaJson: JSON.stringify({
      licensePlate: vehicle.licensePlate,
      vin: vehicle.vin,
      purchaseType: vehicle.purchaseType,
    }),
  });
}

/** สร้าง/ดึงใบรับรถที่บันทึกในระบบ */
export async function ensureReceivingTicketClient(
  vehicle: VehicleRecord,
): Promise<{ ok: true; id: string; number: string } | { ok: false; message: string }> {
  const pack = await loadVehicleDocumentPack(vehicle.id);
  if (pack.receivingTicket) {
    return {
      ok: true,
      id: pack.receivingTicket.id,
      number: pack.receivingTicket.number,
    };
  }
  return saveLegalDocClient({
    kind: "VEHICLE_RECEIVING",
    issueDate: vehicle.purchaseDate || new Date().toISOString().slice(0, 10),
    vehicleId: vehicle.id,
    repairContractId: null,
    sellerEntityId: vehicle.sellerEntityId,
    buyerEntityId: null,
    hirerEntityId: null,
    contractorEntityId: null,
    paymentTermsJson: "{}",
    amount: vehicle.purchasePrice || "0",
    depositPercent: "0",
    balancePercent: "100",
    notes: `ใบรับรถ ${vehicle.brand} ${vehicle.model} ${vehicle.licensePlate || ""}`.trim(),
    metaJson: "{}",
  });
}

/** สร้าง initial ของใบเสร็จจากใบกำกับภาษี */
export async function buildReceiptInitialFromTaxInvoice(taxInvoiceId: string) {
  const inv = await getDocumentClient(taxInvoiceId);
  if (!inv || inv.kind !== "TAX_INVOICE") {
    return { ok: false as const, message: "ไม่พบใบกำกับภาษี" };
  }
  const meta = parseMetaJson<CommercialDocumentMeta>(inv.metaJson, defaultCommercialMeta());
  const receiptMeta: CommercialDocumentMeta = {
    ...meta,
    taxInvoiceId: inv.id,
    taxInvoiceNumber: inv.number || undefined,
  };
  return {
    ok: true as const,
    initial: {
      id: "",
      number: "",
      issueDate: new Date().toISOString().slice(0, 10),
      clientId: inv.clientId,
      lines: JSON.parse(inv.linesJson || "[]"),
      meta: receiptMeta,
      notes: inv.number
        ? `อ้างอิงใบกำกับภาษี ${inv.number}${inv.notes ? ` · ${inv.notes}` : ""}`
        : inv.notes || "",
    },
  };
}
