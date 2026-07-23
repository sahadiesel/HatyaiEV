/** เมนูที่กำหนดสิทธิ์ได้ในระบบ */
export const APP_MENUS = [
  { id: "home", label: "หน้าแรก", href: "/" },
  { id: "entities", label: "คู่ค้า", href: "/entities" },
  { id: "vehicles", label: "รถยนต์และต้นทุน", href: "/vehicles" },
  { id: "documents", label: "ศูนย์เอกสาร", href: "/documents" },
  { id: "cashbook", label: "สมุดเงินสด", href: "/cashbook" },
  { id: "settings_shop", label: "ตั้งค่าร้าน", href: "/settings" },
  { id: "settings_vehicles", label: "ตั้งค่ารถยนต์", href: "/settings/vehicles" },
  { id: "settings_bank", label: "ตั้งค่าบัญชีธนาคาร", href: "/settings/bank-accounts" },
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
  if (pathname.startsWith("/entities")) return "entities";
  if (pathname.startsWith("/vehicles")) return "vehicles";
  // เมนูเก่า — map ไปคู่ค้า / ศูนย์เอกสาร
  if (pathname.startsWith("/clients") || pathname.startsWith("/contractors")) return "entities";
  if (pathname.startsWith("/services")) return "documents";
  // สัญญารับจ้าง / สัญญาว่าจ้าง อยู่ในศูนย์เอกสาร
  if (pathname.startsWith("/contracts")) return "documents";
  if (pathname.startsWith("/documents")) return "documents";
  if (pathname.startsWith("/cashbook")) return "cashbook";
  if (pathname.startsWith("/settings/bank-accounts")) return "settings_bank";
  if (pathname.startsWith("/settings/vehicles")) return "settings_vehicles";
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
  // สิทธิ์เก่า clients/contractors → entities
  const legacy = role.menus as Partial<Record<string, MenuAccessLevel>>;
  const legacyClients = legacy.clients;
  const legacyContractors = legacy.contractors;
  if (base.entities === "none") {
    if (legacyClients === "edit" || legacyContractors === "edit") base.entities = "edit";
    else if (legacyClients === "view" || legacyContractors === "view") base.entities = "view";
  }
  // สิทธิ์เก่า contracts / services → documents
  const legacyContracts = legacy.contracts;
  const legacyServices = legacy.services;
  if (base.documents === "none") {
    if (legacyContracts === "edit" || legacyServices === "edit") base.documents = "edit";
    else if (legacyContracts === "view" || legacyServices === "view") base.documents = "view";
  }
  return base;
}

export function canAccessMenu(access: Record<MenuId, MenuAccessLevel>, menuId: MenuId): boolean {
  return access[menuId] === "view" || access[menuId] === "edit";
}

export function canEditMenu(access: Record<MenuId, MenuAccessLevel>, menuId: MenuId): boolean {
  return access[menuId] === "edit";
}
