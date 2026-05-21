/** รายการตรวจรับตามแบบตรวจสอบงานมอบรถยนต์ (14 รายการ) */
export const VEHICLE_INSPECTION_ITEMS = [
  { index: 1, label: "ซ่อมเครื่องยนต์สตาร์ทติด" },
  { index: 2, label: "ล้างทำความสะอาดห้องเครื่อง" },
  { index: 3, label: "ล้างทำความสะอาดภายใน" },
  { index: 4, label: "ทดสอบขับเคลื่อน (เข้าเกียร์แล้วรถเคลื่อนที่)" },
  { index: 5, label: "เปลี่ยนถ่ายของเหลว (น้ำมันเครื่อง)" },
  { index: 6, label: "เปลี่ยนถ่ายของเหลว (น้ำมันเกียร์)" },
  { index: 7, label: "เปลี่ยนถ่ายของเหลว (น้ำมันเบรก)" },
  { index: 8, label: "เปลี่ยนถ่ายของเหลว (น้ำมันคลัทช์)" },
  { index: 9, label: "เปลี่ยนถ่ายของเหลว (น้ำมันหล่อเย็น)" },
  { index: 10, label: "เปลี่ยนถ่ายของเหลว (น้ำมันเฟืองท้าย)" },
  { index: 11, label: "การทำงานของระบบปรับอากาศ" },
  { index: 12, label: "ระบบไฟส่องสว่าง" },
  { index: 13, label: "ระบบไฟเลี้ยวหน้าหลัง" },
  { index: 14, label: "ระบบไฟเบรค" },
] as const;

export type InspectionStatus = "GOOD" | "USABLE" | "BAD" | null;

export type VehicleInspectionRow = {
  itemIndex: number;
  status: InspectionStatus;
  remarks: string;
};

export function defaultInspectionRows(): VehicleInspectionRow[] {
  return VEHICLE_INSPECTION_ITEMS.map((item) => ({
    itemIndex: item.index,
    status: null,
    remarks: "",
  }));
}

export function parseInspectionJson(raw: string | null | undefined): VehicleInspectionRow[] {
  const defaults = defaultInspectionRows();
  if (!raw?.trim()) return defaults;
  try {
    const parsed = JSON.parse(raw) as VehicleInspectionRow[];
    if (!Array.isArray(parsed)) return defaults;
    const byIndex = new Map(parsed.map((r) => [r.itemIndex, r]));
    return defaults.map((d) => {
      const found = byIndex.get(d.itemIndex);
      if (!found) return d;
      const status =
        found.status === "GOOD" || found.status === "USABLE" || found.status === "BAD" ? found.status : null;
      return { itemIndex: d.itemIndex, status, remarks: String(found.remarks ?? "") };
    });
  } catch {
    return defaults;
  }
}

export type ContractPhoto = {
  id: string;
  fileName: string;
  /** path ใน Firebase Storage */
  storagePath?: string;
  /** URL สำหรับแสดงผล (โหลดจาก Storage) */
  downloadUrl?: string;
  /** รูปเก่าที่เก็บ base64 ใน SQLite (รองรับย้อนหลัง) */
  dataUrl?: string;
};

export const MAX_VEHICLE_PHOTOS = 4;
export const MAX_PHOTO_BYTES = 500 * 1024;

function photoIdFallback(): string {
  return `p-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function parseContractPhotosJson(raw: string | null | undefined): ContractPhoto[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as ContractPhoto[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((p) => {
        if (!p || typeof p !== "object") return false;
        const hasStorage = typeof p.storagePath === "string" && p.storagePath.length > 0;
        const hasData =
          typeof p.dataUrl === "string" && p.dataUrl.startsWith("data:image/");
        return hasStorage || hasData;
      })
      .slice(0, MAX_VEHICLE_PHOTOS)
      .map((p) => ({
        id: String(p.id ?? photoIdFallback()),
        fileName: String(p.fileName ?? "photo.jpg"),
        storagePath: typeof p.storagePath === "string" ? p.storagePath : undefined,
        downloadUrl: typeof p.downloadUrl === "string" ? p.downloadUrl : undefined,
        dataUrl:
          typeof p.dataUrl === "string" && p.dataUrl.startsWith("data:image/") ? p.dataUrl : undefined,
      }));
  } catch {
    return [];
  }
}

/** บันทึกลง SQLite — เก็บเฉพาะ Firebase Storage path (ไม่เก็บ base64/URL) */
export function serializeContractPhotosForDb(photos: ContractPhoto[] | unknown): string {
  if (!Array.isArray(photos)) return "[]";
  const rows = photos
    .filter((p) => p && typeof p === "object" && typeof (p as ContractPhoto).storagePath === "string")
    .map((p) => p as ContractPhoto)
    .filter((p) => p.storagePath!.length > 0)
    .slice(0, MAX_VEHICLE_PHOTOS)
    .map((p) => ({
      id: String(p.id ?? photoIdFallback()),
      fileName: String(p.fileName ?? "photo.jpg"),
      storagePath: p.storagePath!,
    }));
  return JSON.stringify(rows);
}

/** ตัดข้อมูลรถก่อนส่ง server action — ลดขนาด payload */
export function stripVehiclesForSave<
  T extends {
    lineIndex: number;
    licensePlate?: string;
    brand?: string;
    model?: string;
    year?: string;
    color?: string;
    engineType?: string;
    engineSize?: string;
    extraNotes?: string;
    contractPhotos?: ContractPhoto[];
  },
>(vehicles: T[]) {
  return vehicles.map((v) => ({
    lineIndex: v.lineIndex,
    licensePlate: v.licensePlate ?? "",
    brand: v.brand ?? "",
    model: v.model ?? "",
    year: v.year ?? "",
    color: v.color ?? "",
    engineType: v.engineType ?? "GASOLINE",
    engineSize: v.engineSize ?? "",
    extraNotes: v.extraNotes ?? "",
    contractPhotos: (Array.isArray(v.contractPhotos) ? v.contractPhotos : [])
      .filter((p) => p?.storagePath)
      .map((p) => ({
        id: p.id,
        fileName: p.fileName,
        storagePath: p.storagePath!,
      })),
  }));
}

export type BillingRecordKind = "INVOICE" | "TAX_INVOICE" | "RECEIPT";

export type VehicleBillingRecord = {
  id: string;
  kind: BillingRecordKind;
  documentDate: string;
  amount: string;
  notes: string;
};

export function parseBillingJson(raw: string | null | undefined): VehicleBillingRecord[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as VehicleBillingRecord[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((r) => ({
      id: String(r.id ?? crypto.randomUUID()),
      kind: r.kind === "TAX_INVOICE" || r.kind === "RECEIPT" ? r.kind : "INVOICE",
      documentDate: String(r.documentDate ?? ""),
      amount: String(r.amount ?? ""),
      notes: String(r.notes ?? ""),
    }));
  } catch {
    return [];
  }
}

export const BILLING_KIND_LABELS: Record<BillingRecordKind, string> = {
  INVOICE: "ใบแจ้งหนี้",
  TAX_INVOICE: "ใบกำกับภาษี",
  RECEIPT: "ใบเสร็จรับเงิน",
};
