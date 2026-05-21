"use server";

import { Prisma } from "@prisma/client";
import { upsertClientFirestore, deleteClientFirestore } from "@/lib/firestore-entities";
import { prisma } from "@/lib/prisma";
import { nextClientCode } from "@/lib/partyCodes";
import { revalidatePath } from "next/cache";

export async function createClient(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false as const, message: "กรอกชื่อ / บริษัท" };

  for (let attempt = 0; attempt < 12; attempt++) {
    const code = await nextClientCode();
    try {
      const created = await prisma.client.create({
        data: {
          code,
          name,
          taxId: String(formData.get("taxId") ?? ""),
          address: String(formData.get("address") ?? ""),
          phone: String(formData.get("phone") ?? ""),
          email: String(formData.get("email") ?? ""),
          notes: String(formData.get("notes") ?? ""),
        },
      });
      try {
        await upsertClientFirestore({
          id: created.id,
          code: created.code,
          name: created.name,
          taxId: created.taxId,
          address: created.address,
          phone: created.phone,
          email: created.email,
          notes: created.notes,
        });
      } catch {
        /* Firestore mirror — ไม่บล็อกถ้า SQLite สำเร็จ */
      }
      revalidatePath("/clients");
      revalidatePath("/");
      return { ok: true as const };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue;
      throw e;
    }
  }
  return { ok: false as const, message: "ไม่สามารถออกเลขที่ผู้ว่าจ้างได้ กรุณาลองใหม่" };
}

export async function updateClient(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false as const, message: "ไม่พบรหัส" };
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false as const, message: "กรอกชื่อ / บริษัท" };

  const updated = await prisma.client.update({
    where: { id },
    data: {
      name,
      taxId: String(formData.get("taxId") ?? ""),
      address: String(formData.get("address") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      email: String(formData.get("email") ?? ""),
      notes: String(formData.get("notes") ?? ""),
    },
  });
  try {
    await upsertClientFirestore({
      id: updated.id,
      code: updated.code,
      name: updated.name,
      taxId: updated.taxId,
      address: updated.address,
      phone: updated.phone,
      email: updated.email,
      notes: updated.notes,
    });
  } catch {
    /* ignore */
  }
  revalidatePath("/clients");
  revalidatePath("/");
  revalidatePath(`/clients/${id}/edit`);
  return { ok: true as const };
}

export async function deleteClient(id: string) {
  const row = await prisma.client.findUnique({
    where: { id },
    include: { _count: { select: { hiringContracts: true } } },
  });
  if (!row) return { ok: false as const, message: "ไม่พบข้อมูล" };
  if (row._count.hiringContracts > 0) {
    return {
      ok: false as const,
      message: "ลบไม่ได้ — มีสัญญารับจ้างผูกกับผู้ว่าจ้างรายนี้",
    };
  }
  await prisma.client.delete({ where: { id } });
  try {
    await deleteClientFirestore(id);
  } catch {
    /* ignore */
  }
  revalidatePath("/clients");
  revalidatePath("/");
  return { ok: true as const };
}
