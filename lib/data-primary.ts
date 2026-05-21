import { getAdminFirestore } from "./firebase-admin";

const FIREBASE_ENV_KEYS = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
] as const;

/** Firebase ครบชุด — local กับ production ใช้ Firestore ชุดเดียวกัน */
export function isFirestorePrimary(): boolean {
  return FIREBASE_ENV_KEYS.every((k) => Boolean(process.env[k]?.trim()));
}

/** โหมด dev ไม่มี Firebase — ใช้ SQLite/Prisma ในเครื่องเท่านั้น */
export function isSqliteDevMode(): boolean {
  return !isFirestorePrimary();
}

export function canWriteFirestore(): boolean {
  return isFirestorePrimary() && Boolean(getAdminFirestore());
}

export const FIRESTORE_WRITE_HINT =
  "ตั้งค่า Firebase Admin สำหรับ local: วาง serviceAccountKey.json แล้วใส่ FIREBASE_SERVICE_ACCOUNT_PATH ใน .env.local หรือรัน gcloud auth application-default login";
