/** ทำความสะอาดอีเมลสำหรับ login / ลงทะเบียน */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  const e = normalizeEmail(email);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

/** @deprecated ใช้ email จริงแล้ว — คงไว้เพื่อข้อมูลเก่า */
export function nationalIdToAuthEmail(nationalId: string): string {
  const digits = nationalId.replace(/\D/g, "");
  if (digits.length !== 13) {
    throw new Error("เลขบัตรประชาชนต้องมี 13 หลัก");
  }
  return `nid-${digits}@hyev.app`;
}

export function normalizeNationalId(nationalId: string): string {
  return nationalId.replace(/\D/g, "");
}

export const APP_PERMISSIONS = [
  { id: "entities", label: "คู่ค้า" },
  { id: "vehicles", label: "รถยนต์และต้นทุน" },
  { id: "documents", label: "ศูนย์เอกสาร" },
  { id: "cashbook", label: "สมุดเงินสด" },
  { id: "settings", label: "ตั้งค่าร้าน" },
] as const;

export type AppPermissionId = (typeof APP_PERMISSIONS)[number]["id"];

export type UserRole = "admin" | "user";

export type UserProfile = {
  uid: string;
  /** อีเมลที่ใช้ login (Firebase Auth) */
  email: string;
  /** เลขบัตร (ถ้ามี — ไม่บังคับแล้ว) */
  nationalId: string;
  name: string;
  address: string;
  phone: string;
  role: UserRole;
  approved: boolean;
  /** บทบาทที่กำหนดใน Role & Permission (เฉพาะ role === user) */
  appRoleId: string;
  permissions: AppPermissionId[];
  recoveryEmail?: string;
  rejected?: boolean;
  createdAt?: unknown;
};

export type AdminUserProfileUpdate = {
  name: string;
  address: string;
  phone: string;
  recoveryEmail: string;
};

export const PUBLIC_PATHS = ["/login", "/register", "/forgot-password"] as const;

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function defaultPermissionsForRole(role: UserRole): AppPermissionId[] {
  if (role === "admin") {
    return APP_PERMISSIONS.map((p) => p.id);
  }
  return [];
}
