import type { UserProfile } from "./auth-utils";
import {
  canAccessMenu,
  canEditMenu,
  type MenuAccessLevel,
  type MenuId,
} from "./menu-access";

/** ผู้ดูแลระบบ — ข้ามการตรวจสิทธิ์เมนู/บทบาททั้งแอป */
export function isAppAdmin(profile: UserProfile | null | undefined): boolean {
  return Boolean(profile?.approved && profile.role === "admin");
}

export function canViewMenu(
  profile: UserProfile | null | undefined,
  access: Record<MenuId, MenuAccessLevel>,
  menuId: MenuId,
): boolean {
  if (isAppAdmin(profile)) return true;
  return canAccessMenu(access, menuId);
}

export function canEditMenuForUser(
  profile: UserProfile | null | undefined,
  access: Record<MenuId, MenuAccessLevel>,
  menuId: MenuId,
): boolean {
  if (isAppAdmin(profile)) return true;
  return canEditMenu(access, menuId);
}
