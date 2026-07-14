"use server";

import { revalidatePath } from "next/cache";
import {
  getHiringContractVehicle as getVehicleRepo,
  updateHiringVehicleJson,
} from "@/lib/hiring-contracts-repository";

const HC_PATH = "/contracts/hiring-contracts";

export async function getHiringContractVehicle(contractId: string, lineIndex: number) {
  return getVehicleRepo(contractId, lineIndex);
}

export async function updateVehicleInspection(
  contractId: string,
  lineIndex: number,
  inspectionJson: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const result = await updateHiringVehicleJson(contractId, lineIndex, { inspectionJson });
  if (!result.ok) {
    return { ok: false, message: result.message ?? "บันทึกไม่สำเร็จ — บันทึกสัญญาก่อนเพื่อสร้างรายการรถ" };
  }
  revalidatePath(`${HC_PATH}/${contractId}`);
  revalidatePath(`${HC_PATH}/${contractId}/vehicles/${lineIndex}/progress`);
  return { ok: true };
}

export async function updateVehicleBilling(
  contractId: string,
  lineIndex: number,
  billingJson: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const result = await updateHiringVehicleJson(contractId, lineIndex, { billingJson });
  if (!result.ok) {
    return { ok: false, message: result.message ?? "บันทึกไม่สำเร็จ — บันทึกสัญญาก่อนเพื่อสร้างรายการรถ" };
  }
  revalidatePath(`${HC_PATH}/${contractId}`);
  revalidatePath(`${HC_PATH}/${contractId}/vehicles/${lineIndex}/billing`);
  return { ok: true };
}
