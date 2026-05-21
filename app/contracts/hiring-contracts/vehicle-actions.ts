"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

const HC_PATH = "/contracts/hiring-contracts";

export async function getHiringContractVehicle(contractId: string, lineIndex: number) {
  const vehicle = await prisma.hiringContractVehicle.findUnique({
    where: { hiringContractId_lineIndex: { hiringContractId: contractId, lineIndex } },
    include: {
      hiringContract: {
        select: {
          id: true,
          code: true,
          title: true,
          pricePerVehicleExVat: true,
          vatRate: true,
        },
      },
    },
  });
  return vehicle;
}

export async function updateVehicleInspection(
  contractId: string,
  lineIndex: number,
  inspectionJson: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await prisma.hiringContractVehicle.update({
      where: { hiringContractId_lineIndex: { hiringContractId: contractId, lineIndex } },
      data: { inspectionJson },
    });
    revalidatePath(`${HC_PATH}/${contractId}`);
    revalidatePath(`${HC_PATH}/${contractId}/vehicles/${lineIndex}/progress`);
    return { ok: true };
  } catch {
    return { ok: false, message: "บันทึกไม่สำเร็จ — บันทึกสัญญาก่อนเพื่อสร้างรายการรถ" };
  }
}

export async function updateVehicleBilling(
  contractId: string,
  lineIndex: number,
  billingJson: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await prisma.hiringContractVehicle.update({
      where: { hiringContractId_lineIndex: { hiringContractId: contractId, lineIndex } },
      data: { billingJson },
    });
    revalidatePath(`${HC_PATH}/${contractId}`);
    revalidatePath(`${HC_PATH}/${contractId}/vehicles/${lineIndex}/billing`);
    return { ok: true };
  } catch {
    return { ok: false, message: "บันทึกไม่สำเร็จ — บันทึกสัญญาก่อนเพื่อสร้างรายการรถ" };
  }
}
