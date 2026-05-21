"use server";

import { Prisma, type VehicleEngineType } from "@prisma/client";
import { serializeContractPhotosForDb } from "@/lib/vehicle-inspection-items";
import { prisma } from "@/lib/prisma";
import { nextHiringContractCode } from "@/lib/contractCodes";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const HC_PATH = "/contracts/hiring-contracts";

export async function createHiringContractDraft(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const clientId = String(formData.get("clientId") ?? "");
  if (!clientId) return;

  for (let attempt = 0; attempt < 12; attempt++) {
    const code = await nextHiringContractCode();
    try {
      const c = await prisma.hiringContract.create({
        data: {
          code,
          title: title || code,
          clientId,
          status: "DRAFT",
        },
      });
      revalidatePath(HC_PATH);
      redirect(`${HC_PATH}/${c.id}`);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue;
      throw e;
    }
  }
  throw new Error("ไม่สามารถสร้างเลขที่สัญญารับจ้างได้ กรุณาลองใหม่");
}

export async function updateHiringContract(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false as const, message: "ไม่พบรหัสสัญญา" };

  const title = String(formData.get("title") ?? "").trim();
  const clientId = String(formData.get("clientId") ?? "");
  const vehicleCount = Math.max(0, parseInt(String(formData.get("vehicleCount") ?? "0"), 10) || 0);
  const priceStr = String(formData.get("pricePerVehicleExVat") ?? "0").replace(/,/g, "");
  const vatStr = String(formData.get("vatRate") ?? "7").replace(/,/g, "");
  const notes = String(formData.get("notes") ?? "");
  const status = String(formData.get("status") ?? "DRAFT") as "DRAFT" | "ACTIVE" | "COMPLETED" | "CANCELLED";

  const pricePerVehicleExVat = new Prisma.Decimal(priceStr || "0");
  const vatRate = new Prisma.Decimal(vatStr || "7");

  if (!clientId) return { ok: false as const, message: "เลือกผู้ว่าจ้าง" };

  const vehiclesJson = String(formData.get("vehiclesJson") ?? "[]");
  let vehicles: {
    lineIndex: number;
    licensePlate: string;
    brand: string;
    model: string;
    year: string;
    color: string;
    engineType: string;
    engineSize: string;
    extraNotes: string;
    contractPhotos: { id: string; fileName: string; storagePath?: string; dataUrl?: string }[];
  }[] = [];
  try {
    vehicles = JSON.parse(vehiclesJson);
    if (!Array.isArray(vehicles)) vehicles = [];
  } catch {
    return { ok: false as const, message: "ข้อมูลรายการรถไม่ถูกต้อง" };
  }

  const instJson = String(formData.get("installmentsJson") ?? "[]");
  let installments: { sequence: number; label: string; amount: string; percent: string }[] = [];
  try {
    installments = JSON.parse(instJson);
    if (!Array.isArray(installments)) installments = [];
  } catch {
    return { ok: false as const, message: "ข้อมูลงวดเงินไม่ถูกต้อง" };
  }

  const totalExVat = pricePerVehicleExVat.mul(new Prisma.Decimal(vehicleCount));

  try {
  await prisma.$transaction(async (tx) => {
    await tx.hiringContract.update({
      where: { id },
      data: {
        title,
        clientId,
        vehicleCount,
        pricePerVehicleExVat,
        vatRate,
        notes,
        status,
      },
    });

    await tx.hiringContractInstallment.deleteMany({ where: { hiringContractId: id } });
    for (const row of installments) {
      const amt = new Prisma.Decimal(String(row.amount ?? "0").replace(/,/g, "") || "0");
      const pctRaw = String(row.percent ?? "").replace(/,/g, "").trim();
      const percent = pctRaw === "" ? null : new Prisma.Decimal(pctRaw);
      await tx.hiringContractInstallment.create({
        data: {
          hiringContractId: id,
          sequence: row.sequence,
          label: row.label || `งวด ${row.sequence}`,
          amount: amt,
          percent,
        },
      });
    }

    await tx.hiringContractVehicle.deleteMany({
      where: { hiringContractId: id, lineIndex: { gt: vehicleCount } },
    });

    const vehicleByLine = new Map<number, (typeof vehicles)[number]>();
    for (const v of vehicles) {
      const lineIndex = Number.parseInt(String(v.lineIndex), 10);
      if (Number.isFinite(lineIndex) && lineIndex >= 1 && lineIndex <= vehicleCount) {
        vehicleByLine.set(lineIndex, v);
      }
    }

    for (let lineIndex = 1; lineIndex <= vehicleCount; lineIndex++) {
      const v = vehicleByLine.get(lineIndex);
      const engineType: VehicleEngineType =
        v?.engineType === "DIESEL" || v?.engineType === "ELECTRIC" ? v.engineType : "GASOLINE";
      const photosJson = serializeContractPhotosForDb(v?.contractPhotos);

      const vehicleData = {
        licensePlate: String(v?.licensePlate ?? ""),
        brand: String(v?.brand ?? ""),
        model: String(v?.model ?? ""),
        year: String(v?.year ?? ""),
        color: String(v?.color ?? ""),
        engineType,
        engineSize: String(v?.engineSize ?? ""),
        extraNotes: String(v?.extraNotes ?? ""),
        contractPhotos: photosJson,
      };

      await tx.hiringContractVehicle.upsert({
        where: { hiringContractId_lineIndex: { hiringContractId: id, lineIndex } },
        create: {
          hiringContractId: id,
          lineIndex,
          ...vehicleData,
        },
        update: vehicleData,
      });
    }
  });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("PrismaClientValidationError") || msg.includes("Invalid")) {
      return { ok: false as const, message: "ข้อมูลรายการรถไม่ถูกต้อง — ลองบันทึกอีกครั้ง (รูปต้องอัปโหลดขึ้น Storage ก่อน)" };
    }
    throw e;
  }

  revalidatePath(HC_PATH);
  revalidatePath(`${HC_PATH}/${id}`);
  revalidatePath("/contracts");
  revalidatePath("/contracts/hiring-contracts");
  return { ok: true as const, totalExVat: totalExVat.toString() };
}
