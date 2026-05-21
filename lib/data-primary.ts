import { getAdminFirestore } from "./firebase-admin";

/** ใช้ Firestore เป็นฐานข้อมูลหลักเมื่อตั้งค่า Firebase แล้ว (รวม production) */
export function useFirestorePrimary(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim());
}

export function canWriteFirestore(): boolean {
  return useFirestorePrimary() && Boolean(getAdminFirestore());
}
