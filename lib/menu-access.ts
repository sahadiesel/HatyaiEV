/** เมนูที่กำหนดสิทธิ์ได้ในระบบ */
export const APP_MENUS = [
  { id: "home", label: "หน้าแรก", href: "/" },
  { id: "clients", label: "ผู้ว่าจ้าง", href: "/clients" },
  { id: "contractors", label: "ผู้รับเหมา", href: "/contractors" },
  { id: "contracts", label: "เอกสารสัญญา", href: "/contracts" },
  { id: "documents", label: "การจัดการเอกสาร", href: "/documents" },
  { id: "settings_shop", label: "ตั้งค่าร้าน", href: "/settings" },
] as const;

export type MenuId = (typeof APP_MENUS)[number]["id"];
export type MenuAccessLevel = "none" | "view" | "edit";

export type AppRoleDefinition = {
  id: string;
  name: string;
  menus: Partial<Record<MenuId, MenuAccessLevel>>;
  updatedAt?: unknown;
};

export function emptyMenuAccess(): Record<MenuId, MenuAccessLevel> {
  return Object.fromEntries(APP_MENUS.map((m) => [m.id, "none"])) as Record<MenuId, MenuAccessLevel>;
}

export function fullMenuAccessEdit(): Record<MenuId, MenuAccessLevel> {
  return Object.fromEntries(APP_MENUS.map((m) => [m.id, "edit"])) as Record<MenuId, MenuAccessLevel>;
}

export function pathnameToMenuId(pathname: string): MenuId | null {
  if (pathname === "/") return "home";
  if (pathname.startsWith("/clients")) return "clients";
  if (pathname.startsWith("/contractors")) return "contractors";
  if (pathname.startsWith("/contracts")) return "contracts";
  if (pathname.startsWith("/documents")) return "documents";
  if (pathname.startsWith("/settings")) return "settings_shop";
  if (pathname.startsWith("/admin")) return null;
  return null;
}

export function menuAccessForRole(role: AppRoleDefinition | null): Record<MenuId, MenuAccessLevel> {
  const base = emptyMenuAccess();
  if (!role) return base;
  for (const m of APP_MENUS) {
    const level = role.menus[m.id];
    if (level === "view" || level === "edit") base[m.id] = level;
  }
  return base;
}

export function canAccessMenu(access: Record<MenuId, MenuAccessLevel>, menuId: MenuId): boolean {
  return access[menuId] === "view" || access[menuId] === "edit";
}

export function canEditMenu(access: Record<MenuId, MenuAccessLevel>, menuId: MenuId): boolean {
  return access[menuId] === "edit";
}
