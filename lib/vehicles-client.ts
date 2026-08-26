"use client";

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { ensurePrimaryBankAccount } from "@/lib/bank-accounts-client";
import {
  deleteCashbookEntryClient,
  listCashbookEntriesClient,
  postCashbookEntryClient,
} from "@/lib/cashbook-client";
import {
  defaultPaymentVoucherMeta,
} from "@/lib/documents/types";
import { savePaymentVoucherClient } from "@/lib/documents-client";
import type {
  EntityRecord,
  VehicleCostLine,
  VehiclePurchasePayment,
  VehiclePurchaseType,
  VehicleRecord,
  VehicleStatus,
} from "@/lib/domain-types";
import { listEntitiesClient } from "@/lib/entities-client";
import { getFirestoreDb } from "@/lib/firebase";
import { firestoreCollections } from "@/lib/firestore-collections";
import { calcPurchasePaymentSummary } from "@/lib/vehicles/calc";

function newClientId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, "").slice(0, 25);
  }
  return `v${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

function parseCostLines(raw: unknown): VehicleCostLine[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((l) => {
    const row = l as Record<string, unknown>;
    return {
      id: String(row.id ?? ""),
      date: String(row.date ?? ""),
      category: (row.category as VehicleCostLine["category"]) || "OTHER",
      description: String(row.description ?? ""),
      amount: String(row.amount ?? "0"),
      entityId: row.entityId ? String(row.entityId) : null,
      billNo: row.billNo ? String(row.billNo) : null,
      documentId: row.documentId ? String(row.documentId) : null,
      withholdingDocumentId: row.withholdingDocumentId
        ? String(row.withholdingDocumentId)
        : null,
      paymentVoucherDocumentId: row.paymentVoucherDocumentId
        ? String(row.paymentVoucherDocumentId)
        : null,
      cashbookEntryId: row.cashbookEntryId ? String(row.cashbookEntryId) : null,
      createdAt: row.createdAt ? String(row.createdAt) : undefined,
    };
  });
}

function parsePurchasePayments(raw: unknown): VehiclePurchasePayment[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((l) => {
    const row = l as Record<string, unknown>;
    return {
      id: String(row.id ?? ""),
      date: String(row.date ?? ""),
      amount: String(row.amount ?? "0"),
      billNo: row.billNo ? String(row.billNo) : null,
      paymentVoucherDocumentId: row.paymentVoucherDocumentId
        ? String(row.paymentVoucherDocumentId)
        : null,
      paymentVoucherDocumentNumber: row.paymentVoucherDocumentNumber
        ? String(row.paymentVoucherDocumentNumber)
        : null,
      cashbookEntryId: row.cashbookEntryId ? String(row.cashbookEntryId) : null,
      notes: row.notes ? String(row.notes) : undefined,
      createdAt: row.createdAt ? String(row.createdAt) : undefined,
    };
  });
}

export function parseVehicleRecord(id: string, d: Record<string, unknown>): VehicleRecord {
  return {
    id,
    code: typeof d.code === "string" ? d.code : null,
    licensePlate: String(d.licensePlate ?? ""),
    brand: String(d.brand ?? ""),
    model: String(d.model ?? ""),
    year: String(d.year ?? ""),
    color: String(d.color ?? ""),
    vin: String(d.vin ?? ""),
    engineNo: String(d.engineNo ?? ""),
    mileage: String(d.mileage ?? ""),
    status: (d.status as VehicleStatus) || "IN_STOCK",
    purchaseType: (d.purchaseType as VehiclePurchaseType) || "INDIVIDUAL_NO_VAT",
    sellerEntityId: d.sellerEntityId ? String(d.sellerEntityId) : null,
    purchaseDate: String(d.purchaseDate ?? ""),
    purchasePrice: String(d.purchasePrice ?? "0"),
    purchaseContractAmount: String(d.purchaseContractAmount ?? d.purchasePrice ?? "0"),
    purchasePayments: parsePurchasePayments(d.purchasePayments),
    saleContractAmount: String(d.saleContractAmount ?? d.expectedSalePrice ?? "0"),
    costLines: parseCostLines(d.costLines ?? d.costLinesJson),
    expectedSalePrice: String(d.expectedSalePrice ?? "0"),
    commissionAmount: String(d.commissionAmount ?? "0"),
    soldDate: String(d.soldDate ?? ""),
    soldPrice: String(d.soldPrice ?? "0"),
    buyerEntityId: d.buyerEntityId ? String(d.buyerEntityId) : null,
    notes: String(d.notes ?? ""),
  };
}

export async function listVehiclesClient(): Promise<VehicleRecord[]> {
  const db = getFirestoreDb();
  if (!db) return [];
  try {
    const snap = await getDocs(collection(db, firestoreCollections.vehicles));
    return snap.docs
      .map((d) => parseVehicleRecord(d.id, d.data() as Record<string, unknown>))
      .sort((a, b) => (a.licensePlate || a.code || "").localeCompare(b.licensePlate || b.code || "", "th"));
  } catch (e) {
    console.error("[listVehiclesClient]", e);
    return [];
  }
}

export async function getVehicleClient(id: string): Promise<VehicleRecord | null> {
  const db = getFirestoreDb();
  if (!db) return null;
  try {
    const snap = await getDoc(doc(db, firestoreCollections.vehicles, id));
    if (!snap.exists()) return null;
    return parseVehicleRecord(snap.id, snap.data() as Record<string, unknown>);
  } catch (e) {
    console.error("[getVehicleClient]", e);
    return null;
  }
}

function nextVehicleCode(rows: VehicleRecord[]): string {
  const year = new Date().getFullYear();
  const prefix = `VH-${year}-`;
  let max = 0;
  for (const r of rows) {
    if (!r.code?.startsWith(prefix)) continue;
    const n = parseInt(r.code.slice(prefix.length), 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}

export type VehicleWriteInput = Omit<
  VehicleRecord,
  "id" | "code" | "costLines" | "purchasePayments"
> & {
  id?: string | null;
  code?: string | null;
  costLines?: VehicleCostLine[];
  purchasePayments?: VehiclePurchasePayment[];
};

export async function saveVehicleClient(
  input: VehicleWriteInput,
): Promise<{ ok: true; id: string; code: string } | { ok: false; message: string }> {
  const db = getFirestoreDb();
  if (!db) return { ok: false, message: "ยังไม่ได้ตั้งค่า Firebase (NEXT_PUBLIC_FIREBASE_*)" };

  try {
    const existing = await listVehiclesClient();
    const id = input.id?.trim() || newClientId();
    const prev = input.id ? existing.find((v) => v.id === input.id) : null;
    const code = prev?.code || input.code || nextVehicleCode(existing);

    const purchasePrice = String(input.purchasePrice ?? "0");
    const purchaseContractAmount =
      input.purchaseContractAmount && Number(String(input.purchaseContractAmount).replace(/,/g, "")) > 0
        ? String(input.purchaseContractAmount)
        : purchasePrice;
    const expectedSalePrice = String(input.expectedSalePrice ?? "0");
    const saleContractAmount =
      input.saleContractAmount && Number(String(input.saleContractAmount).replace(/,/g, "")) > 0
        ? String(input.saleContractAmount)
        : expectedSalePrice;

    const record: VehicleRecord = {
      id,
      code,
      licensePlate: input.licensePlate ?? "",
      brand: input.brand ?? "",
      model: input.model ?? "",
      year: input.year ?? "",
      color: input.color ?? "",
      vin: input.vin ?? "",
      engineNo: input.engineNo ?? "",
      mileage: input.mileage ?? "",
      status: input.status ?? "IN_STOCK",
      purchaseType: input.purchaseType ?? "INDIVIDUAL_NO_VAT",
      sellerEntityId: input.sellerEntityId ?? null,
      purchaseDate: input.purchaseDate || new Date().toISOString().slice(0, 10),
      purchasePrice,
      purchaseContractAmount,
      purchasePayments: input.purchasePayments ?? prev?.purchasePayments ?? [],
      saleContractAmount,
      costLines: input.costLines ?? prev?.costLines ?? [],
      expectedSalePrice,
      commissionAmount: String(input.commissionAmount ?? "0"),
      soldDate: input.soldDate ?? "",
      soldPrice: String(input.soldPrice ?? "0"),
      buyerEntityId: input.buyerEntityId ?? null,
      notes: input.notes ?? "",
    };

    const payload: Record<string, unknown> = {
      ...record,
      updatedAt: serverTimestamp(),
    };
    if (!prev) payload.createdAt = serverTimestamp();
    await setDoc(doc(db, firestoreCollections.vehicles, id), payload, { merge: true });

    // ไม่ตัดสมุดเงินสดตอนรับรถ — จ่ายผ่าน addVehiclePurchasePaymentClient ทีละงวด
    return { ok: true, id, code };
  } catch (e) {
    console.error("[saveVehicleClient]", e);
    return { ok: false, message: e instanceof Error ? e.message : "บันทึกไม่สำเร็จ" };
  }
}

export async function updateVehicleFieldsClient(
  id: string,
  patch: Partial<
    Pick<
      VehicleRecord,
      | "saleContractAmount"
      | "purchaseContractAmount"
      | "purchasePrice"
      | "purchaseDate"
      | "purchasePayments"
      | "expectedSalePrice"
      | "soldPrice"
      | "commissionAmount"
      | "status"
      | "notes"
      | "costLines"
    >
  >,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const db = getFirestoreDb();
  if (!db) return { ok: false, message: "ยังไม่ได้ตั้งค่า Firebase" };
  try {
    await setDoc(
      doc(db, firestoreCollections.vehicles, id),
      { ...patch, updatedAt: serverTimestamp() },
      { merge: true },
    );
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

export async function addVehicleCostLineClient(
  vehicleId: string,
  line: Omit<VehicleCostLine, "id" | "createdAt">,
  opts?: {
    postCashbook?: boolean;
    /** ยอดตัดบัญชีจริงหลังหัก ณ ที่จ่าย — ไม่ระบุ = ใช้ยอดต้นทุน − withholdingAmount */
    cashOutAmount?: number | null;
    withholdingAmount?: number | null;
    withholdingDocumentNumber?: string | null;
    paymentVoucherDocumentNumber?: string | null;
  },
): Promise<
  { ok: true; vehicle: VehicleRecord; line: VehicleCostLine } | { ok: false; message: string }
> {
  const existing = await getVehicleClient(vehicleId);
  if (!existing) return { ok: false, message: "ไม่พบรถคันนี้" };

  const newLine: VehicleCostLine = {
    id: newClientId(),
    date: line.date || new Date().toISOString().slice(0, 10),
    category: line.category || "OTHER",
    description: line.description || "",
    amount: String(line.amount || "0"),
    entityId: line.entityId ?? null,
    billNo: line.billNo?.trim() ? String(line.billNo).trim() : null,
    documentId: line.documentId ?? line.paymentVoucherDocumentId ?? null,
    withholdingDocumentId: line.withholdingDocumentId ?? null,
    paymentVoucherDocumentId: line.paymentVoucherDocumentId ?? null,
    cashbookEntryId: null,
    createdAt: new Date().toISOString(),
  };
  const costLines = [...existing.costLines, newLine];
  const saved = await updateVehicleFieldsClient(vehicleId, { costLines });
  if (!saved.ok) return saved;

  const gross = Number(String(newLine.amount).replace(/,/g, "")) || 0;
  const whtAmt = Math.max(0, Number(opts?.withholdingAmount) || 0);
  const cashOut =
    opts?.cashOutAmount != null && Number.isFinite(Number(opts.cashOutAmount))
      ? Math.max(0, Number(opts.cashOutAmount))
      : Math.max(0, gross - whtAmt);
  let cashbookEntryId: string | null = null;
  if (opts?.postCashbook && cashOut > 0) {
    const primary = await ensurePrimaryBankAccount();
    const entryType =
      newLine.category === "LABOR"
        ? "LABOR"
        : newLine.category === "PARTS" || newLine.category === "REPAIR"
          ? "PARTS"
          : "MISC";
    const billHint = newLine.billNo ? ` บิล ${newLine.billNo}` : "";
    const whtHint =
      whtAmt > 0
        ? ` (หัก ณ ที่จ่าย ${whtAmt.toLocaleString("th-TH", { minimumFractionDigits: 2 })} · จ่ายสุทธิ ${cashOut.toLocaleString("th-TH", { minimumFractionDigits: 2 })})`
        : "";
    const cash = await postCashbookEntryClient({
      entryDate: newLine.date,
      direction: "OUT",
      entryType,
      amount: cashOut,
      description: `ต้นทุนรถ: ${newLine.description || newLine.category}${billHint}${whtHint}`,
      vehicleId,
      entityId: newLine.entityId,
      channel: "BANK",
      bankAccountId: primary?.id ?? null,
      vatType: "NO_VAT",
      billNo: newLine.billNo,
      documentId: newLine.paymentVoucherDocumentId ?? newLine.withholdingDocumentId ?? null,
      documentKind: newLine.paymentVoucherDocumentId
        ? "PAYMENT_VOUCHER"
        : newLine.withholdingDocumentId
          ? "WITHHOLDING_TAX"
          : null,
      documentNumber:
        opts?.paymentVoucherDocumentNumber ?? opts?.withholdingDocumentNumber ?? null,
      withholdingDocumentId: newLine.withholdingDocumentId,
      withholdingDocumentNumber: opts?.withholdingDocumentNumber ?? null,
      paymentVoucherDocumentId: newLine.paymentVoucherDocumentId,
      paymentVoucherDocumentNumber: opts?.paymentVoucherDocumentNumber ?? null,
    });
    if (cash.ok) {
      cashbookEntryId = cash.id;
      const withCash = costLines.map((l) =>
        l.id === newLine.id ? { ...l, cashbookEntryId } : l,
      );
      await updateVehicleFieldsClient(vehicleId, { costLines: withCash });
      return {
        ok: true,
        vehicle: { ...existing, costLines: withCash },
        line: { ...newLine, cashbookEntryId },
      };
    }
  }

  return { ok: true, vehicle: { ...existing, costLines }, line: newLine };
}

export async function removeVehicleCostLineClient(
  vehicleId: string,
  lineId: string,
): Promise<{ ok: true; vehicle: VehicleRecord } | { ok: false; message: string }> {
  const existing = await getVehicleClient(vehicleId);
  if (!existing) return { ok: false, message: "ไม่พบรถคันนี้" };
  const costLines = existing.costLines.filter((l) => l.id !== lineId);
  const saved = await updateVehicleFieldsClient(vehicleId, { costLines });
  if (!saved.ok) return saved;
  return { ok: true, vehicle: { ...existing, costLines } };
}

export type PurchasePaymentInput = {
  date?: string;
  amount: string | number;
  billNo?: string | null;
  /** ไม่มีใบเสร็จ/ใบกำกับ — สร้างใบสำคัญจ่าย */
  createPaymentVoucher?: boolean;
  notes?: string;
  issuedByName?: string;
};

/** บันทึกจ่ายค่าซื้อรถทีละงวด → ตัด cashbook ตามยอดจ่าย + บิลหรือใบสำคัญจ่าย */
export async function addVehiclePurchasePaymentClient(
  vehicleId: string,
  input: PurchasePaymentInput,
): Promise<
  | { ok: true; vehicle: VehicleRecord; payment: VehiclePurchasePayment; remaining: number }
  | { ok: false; message: string }
> {
  const existing = await getVehicleClient(vehicleId);
  if (!existing) return { ok: false, message: "ไม่พบรถคันนี้" };

  const amount = Number(String(input.amount).replace(/,/g, "")) || 0;
  if (amount <= 0) return { ok: false, message: "จำนวนที่จ่ายต้องมากกว่า 0" };

  const summary = calcPurchasePaymentSummary(existing);
  if (amount > summary.remaining + 0.001) {
    return {
      ok: false,
      message: `จ่ายเกินยอดคงค้าง (คงเหลือ ฿${summary.remaining.toFixed(2)})`,
    };
  }

  const billNo = (input.billNo ?? "").trim();
  const createPv = Boolean(input.createPaymentVoucher) && !billNo;
  let seller: EntityRecord | null = null;
  if (existing.sellerEntityId) {
    const ents = await listEntitiesClient();
    seller = ents.find((e) => e.id === existing.sellerEntityId) || null;
  }
  if (createPv && !seller) {
    return { ok: false, message: "สร้างใบสำคัญจ่ายต้องมีผู้ขายในข้อมูลรถ" };
  }

  const date = input.date || new Date().toISOString().slice(0, 10);
  const vehicleLabel =
    `${existing.code || ""} ${existing.brand} ${existing.model} ${existing.licensePlate || ""}`.trim();

  let paymentVoucherDocumentId: string | null = null;
  let paymentVoucherDocumentNumber: string | null = null;

  if (createPv && seller) {
    const pvMeta = {
      ...defaultPaymentVoucherMeta(),
      payeeName: seller.name,
      payeeAddress: seller.address,
      payeeTaxId: seller.taxId,
      payeePhone: seller.phone,
      paymentMethod: "TRANSFER" as const,
      purpose: `จ่ายค่าซื้อรถ — ${vehicleLabel}`,
      vehicleId: existing.id,
      vehicleLabel,
    };
    const pv = await savePaymentVoucherClient({
      issueDate: date,
      totalAmount: amount,
      metaJson: JSON.stringify(pvMeta),
      assignNumber: true,
      issuedByName: input.issuedByName,
      postCashbook: false,
      notes: `งวดจ่ายค่าซื้อรถ ${vehicleLabel}`,
    });
    if (!pv.ok) return pv;
    paymentVoucherDocumentId = pv.id;
    paymentVoucherDocumentNumber = pv.number;
  }

  const primary = await ensurePrimaryBankAccount();
  const billHint = billNo ? ` บิล ${billNo}` : "";
  const cash = await postCashbookEntryClient({
    entryDate: date,
    direction: "OUT",
    entryType: "VEHICLE_PURCHASE",
    amount,
    description: `จ่ายค่าซื้อรถ: ${vehicleLabel}${billHint}`.trim(),
    vehicleId,
    entityId: existing.sellerEntityId,
    channel: "BANK",
    bankAccountId: primary?.id ?? null,
    vatType: existing.purchaseType === "INDIVIDUAL_NO_VAT" ? "NO_VAT" : "FULL_VAT",
    billNo: billNo || null,
    documentId: paymentVoucherDocumentId,
    documentKind: paymentVoucherDocumentId ? "PAYMENT_VOUCHER" : null,
    documentNumber: paymentVoucherDocumentNumber,
    paymentVoucherDocumentId,
    paymentVoucherDocumentNumber,
  });
  if (!cash.ok) return cash;

  const payment: VehiclePurchasePayment = {
    id: newClientId(),
    date,
    amount: amount.toFixed(2),
    billNo: billNo || null,
    paymentVoucherDocumentId,
    paymentVoucherDocumentNumber,
    cashbookEntryId: cash.id,
    notes: input.notes ?? "",
    createdAt: new Date().toISOString(),
  };
  const purchasePayments = [...(existing.purchasePayments ?? []), payment];
  const saved = await updateVehicleFieldsClient(vehicleId, { purchasePayments });
  if (!saved.ok) return saved;

  const vehicle = { ...existing, purchasePayments };
  const remaining = calcPurchasePaymentSummary(vehicle).remaining;
  return { ok: true, vehicle, payment, remaining };
}

/** ลบรถออกจากสต็อก (admin) — ลบรายการ cashbook ที่ผูก vehicleId ด้วย */
export async function deleteVehicleClient(
  vehicleId: string,
): Promise<{ ok: true; deletedCashbook: number } | { ok: false; message: string }> {
  const db = getFirestoreDb();
  if (!db) return { ok: false, message: "ยังไม่ได้ตั้งค่า Firebase" };
  const existing = await getVehicleClient(vehicleId);
  if (!existing) return { ok: false, message: "ไม่พบรถคันนี้" };

  try {
    const cash = await listCashbookEntriesClient(500);
    const related = cash.filter((e) => e.vehicleId === vehicleId);
    await Promise.all(related.map((e) => deleteCashbookEntryClient(e.id)));
    await deleteDoc(doc(db, firestoreCollections.vehicles, vehicleId));
    return { ok: true, deletedCashbook: related.length };
  } catch (e) {
    console.error("[deleteVehicleClient]", e);
    return { ok: false, message: e instanceof Error ? e.message : "ลบไม่สำเร็จ" };
  }
}
