"use server";

import { Prisma } from "@prisma/client";
import { upsertContractorFirestore, deleteContractorFirestore } from "@/lib/firestore-entities";
import { prisma } from "@/lib/prisma";
import { nextContractorCode } from "@/lib/partyCodes";
import { revalidatePath } from "next/cache";

export async function createContractor(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false as const, message: "กรอกชื่อ / บริษัท" };
  const wht = String(formData.get("defaultWhtPercent") ?? "1").replace(",", ".");

  for (let attempt = 0; attempt < 12; attempt++) {
    const code = await nextContractorCode();
    try {
      const created = await prisma.contractor.create({
        data: {
          code,
          name,
          taxId: String(formData.get("taxId") ?? ""),
          address: String(formData.get("address") ?? ""),
          phone: String(formData.get("phone") ?? ""),
          email: String(formData.get("email") ?? ""),
          bankName: String(formData.get("bankName") ?? ""),
          bankAccount: String(formData.get("bankAccount") ?? ""),
          defaultWhtPercent: new Prisma.Decimal(wht || "1"),
          notes: String(formData.get("notes") ?? ""),
        },
      });
      try {
        await upsertContractorFirestore({
          id: created.id,
          code: created.code,
          name: created.name,
          taxId: created.taxId,
          address: created.address,
          phone: created.phone,
          email: created.email,
          bankName: created.bankName,
          bankAccount: created.bankAccount,
          defaultWhtPercent: String(created.defaultWhtPercent),
          notes: created.notes,
        });
      } catch {
        /* ignore */
      }
      revalidatePath("/contractors");
      revalidatePath("/");
      return { ok: true as const };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue;
      throw e;
    }
  }
  return { ok: false as const, message: "ไม่สามารถออกเลขที่ผู้รับเหมาได้ กรุณาลองใหม่" };
}

export async function updateContractor(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false as const, message: "ไม่พบรหัส" };
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false as const, message: "กรอกชื่อ / บริษัท" };
  const wht = String(formData.get("defaultWhtPercent") ?? "1").replace(",", ".");

  const updated = await prisma.contractor.update({
    where: { id },
    data: {
      name,
      taxId: String(formData.get("taxId") ?? ""),
      address: String(formData.get("address") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      email: String(formData.get("email") ?? ""),
      bankName: String(formData.get("bankName") ?? ""),
      bankAccount: String(formData.get("bankAccount") ?? ""),
      defaultWhtPercent: new Prisma.Decimal(wht || "1"),
      notes: String(formData.get("notes") ?? ""),
    },
  });
  try {
    await upsertContractorFirestore({
      id: updated.id,
      code: updated.code,
      name: updated.name,
      taxId: updated.taxId,
      address: updated.address,
      phone: updated.phone,
      email: updated.email,
      bankName: updated.bankName,
      bankAccount: updated.bankAccount,
      defaultWhtPercent: String(updated.defaultWhtPercent),
      notes: updated.notes,
    });
  } catch {
    /* ignore */
  }
  revalidatePath("/contractors");
  revalidatePath("/");
  revalidatePath(`/contractors/${id}/edit`);
  return { ok: true as const };
}

export async function deleteContractor(id: string) {
  const row = await prisma.contractor.findUnique({
    where: { id },
    include: { _count: { select: { subcontractAgreements: true } } },
  });
  if (!row) return { ok: false as const, message: "ไม่พบข้อมูล" };
  if (row._count.subcontractAgreements > 0) {
    return {
      ok: false as const,
      message: "ลบไม่ได้ — มีสัญญาว่าจ้างผูกกับผู้รับเหมารายนี้",
    };
  }
  await prisma.contractor.delete({ where: { id } });
  try {
    await deleteContractorFirestore(id);
  } catch {
    /* ignore */
  }
  revalidatePath("/contractors");
  revalidatePath("/");
  return { ok: true as const };
}
