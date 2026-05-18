"use server";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { nextSubcontractAgreementCode } from "@/lib/contractCodes";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const SC_PATH = "/contracts/subcontract-agreements";

export async function createSubcontractAgreementDraft(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const contractorId = String(formData.get("contractorId") ?? "");
  const hiringContractId = String(formData.get("hiringContractId") ?? "");
  if (!contractorId || !hiringContractId) return;

  for (let attempt = 0; attempt < 12; attempt++) {
    const code = await nextSubcontractAgreementCode();
    try {
      const c = await prisma.subcontractAgreement.create({
        data: {
          code,
          title: title || code,
          contractorId,
          hiringContractId,
          status: "DRAFT",
        },
      });
      revalidatePath(SC_PATH);
      revalidatePath("/contracts");
      revalidatePath("/contracts/subcontract-agreements");
      redirect(`${SC_PATH}/${c.id}`);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue;
      throw e;
    }
  }
  throw new Error("ไม่สามารถสร้างเลขที่สัญญาว่าจ้างได้ กรุณาลองใหม่");
}

export async function updateSubcontractAgreement(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false as const, message: "ไม่พบรหัสสัญญา" };

  const title = String(formData.get("title") ?? "").trim();
  const contractorId = String(formData.get("contractorId") ?? "");
  const hiringContractId = String(formData.get("hiringContractId") ?? "");
  const priceStr = String(formData.get("pricePerVehicleExVat") ?? "0").replace(/,/g, "");
  const vatStr = String(formData.get("vatRate") ?? "7").replace(/,/g, "");
  const notes = String(formData.get("notes") ?? "");
  const status = String(formData.get("status") ?? "DRAFT") as "DRAFT" | "ACTIVE" | "COMPLETED" | "CANCELLED";

  const pricePerVehicleExVat = new Prisma.Decimal(priceStr || "0");
  const vatRate = new Prisma.Decimal(vatStr || "7");

  if (!contractorId || !hiringContractId) return { ok: false as const, message: "เลือกผู้รับเหมาและสัญญารับจ้างอ้างอิง" };

  const selectedJson = String(formData.get("selectedVehicleIdsJson") ?? "[]");
  let selectedIds: string[] = [];
  try {
    selectedIds = JSON.parse(selectedJson);
    if (!Array.isArray(selectedIds)) selectedIds = [];
  } catch {
    return { ok: false as const, message: "ข้อมูลรถที่เลือกไม่ถูกต้อง" };
  }

  const vehiclesInScope = await prisma.hiringContractVehicle.findMany({
    where: { hiringContractId, id: { in: selectedIds } },
    select: { id: true },
  });
  if (vehiclesInScope.length !== selectedIds.length) {
    return { ok: false as const, message: "มีรายการรถที่เลือกไม่ตรงกับสัญญารับจ้าง" };
  }

  const instJson = String(formData.get("installmentsJson") ?? "[]");
  let installments: { sequence: number; label: string; amount: string; percent: string }[] = [];
  try {
    installments = JSON.parse(instJson);
    if (!Array.isArray(installments)) installments = [];
  } catch {
    return { ok: false as const, message: "ข้อมูลงวดเงินไม่ถูกต้อง" };
  }

  const vehicleCount = selectedIds.length;

  await prisma.$transaction(async (tx) => {
    await tx.subcontractAgreement.update({
      where: { id },
      data: {
        title,
        contractorId,
        hiringContractId,
        vehicleCount,
        pricePerVehicleExVat,
        vatRate,
        notes,
        status,
      },
    });

    await tx.subcontractAgreementInstallment.deleteMany({ where: { subcontractAgreementId: id } });
    for (const row of installments) {
      const amt = new Prisma.Decimal(String(row.amount ?? "0").replace(/,/g, "") || "0");
      const pctRaw = String(row.percent ?? "").replace(/,/g, "").trim();
      const percent = pctRaw === "" ? null : new Prisma.Decimal(pctRaw);
      await tx.subcontractAgreementInstallment.create({
        data: {
          subcontractAgreementId: id,
          sequence: row.sequence,
          label: row.label || `งวด ${row.sequence}`,
          amount: amt,
          percent,
        },
      });
    }

    await tx.subcontractAgreementVehicle.deleteMany({ where: { subcontractAgreementId: id } });
    for (const vid of selectedIds) {
      await tx.subcontractAgreementVehicle.create({
        data: {
          subcontractAgreementId: id,
          hiringContractVehicleId: vid,
        },
      });
    }
  });

  revalidatePath(SC_PATH);
  revalidatePath(`${SC_PATH}/${id}`);
  revalidatePath("/contracts");
  return { ok: true as const };
}
