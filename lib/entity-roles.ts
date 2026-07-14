import type { EntityRole } from "@/lib/domain-types";

/** กลุ่มบทบาทที่แสดงใน UI (รวมลูกค้า/ผู้ซื้อ และ ผู้ขาย/ซัพพลายเออร์) */
export type EntityRoleGroupId = "CUSTOMER_BUYER" | "SELLER_SUPPLIER" | "CONTRACTOR" | "HIRER";

export const ENTITY_ROLE_GROUPS: {
  id: EntityRoleGroupId;
  label: string;
  roles: EntityRole[];
}[] = [
  { id: "CUSTOMER_BUYER", label: "ลูกค้า/ผู้ซื้อ", roles: ["CUSTOMER", "BUYER"] },
  { id: "SELLER_SUPPLIER", label: "ผู้ขาย/ซัพพลายเออร์", roles: ["SELLER", "SUPPLIER"] },
  { id: "CONTRACTOR", label: "ผู้รับจ้าง/อู่นอก", roles: ["CONTRACTOR"] },
  { id: "HIRER", label: "ผู้ว่าจ้าง", roles: ["HIRER"] },
];

export const ENTITY_ROLE_LABEL: Record<EntityRole, string> = {
  CUSTOMER: "ลูกค้า",
  BUYER: "ผู้ซื้อ",
  SELLER: "ผู้ขาย",
  SUPPLIER: "ซัพพลายเออร์",
  CONTRACTOR: "ผู้รับจ้าง",
  HIRER: "ผู้ว่าจ้าง",
};

export function entityHasRoleGroup(roles: EntityRole[] | undefined, groupId: EntityRoleGroupId): boolean {
  const group = ENTITY_ROLE_GROUPS.find((g) => g.id === groupId);
  if (!group) return false;
  const set = new Set(roles ?? []);
  return group.roles.some((r) => set.has(r));
}

/** สลับกลุ่มบทบาท — เปิดแล้วเก็บครบทุก role ในกลุ่ม */
export function toggleEntityRoleGroup(prev: EntityRole[], groupId: EntityRoleGroupId): EntityRole[] {
  const group = ENTITY_ROLE_GROUPS.find((g) => g.id === groupId);
  if (!group) return prev;
  const on = entityHasRoleGroup(prev, groupId);
  if (on) {
    const remove = new Set(group.roles);
    return prev.filter((r) => !remove.has(r));
  }
  const next = new Set(prev);
  for (const r of group.roles) next.add(r);
  return Array.from(next);
}

/** แสดงชิปบทบาทแบบรวมกลุ่ม (ไม่ซ้ำ) */
export function displayEntityRoleLabels(roles: EntityRole[] | undefined): string[] {
  const labels: string[] = [];
  for (const g of ENTITY_ROLE_GROUPS) {
    if (entityHasRoleGroup(roles, g.id)) labels.push(g.label);
  }
  // บทบาทเก่าที่ไม่รู้จักกลุ่ม
  for (const r of roles ?? []) {
    if (!ENTITY_ROLE_GROUPS.some((g) => g.roles.includes(r))) {
      labels.push(ENTITY_ROLE_LABEL[r] ?? r);
    }
  }
  return labels;
}
