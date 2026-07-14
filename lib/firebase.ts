import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";
import { firebaseConfig, isFirebaseConfigured } from "../firebaseConfig.js";

let cachedApp: FirebaseApp | null = null;
let cachedDb: Firestore | null = null;

/** ใช้ฝั่ง client (เบราว์เซอร์) — ต้องมี env แบบ NEXT_PUBLIC_* ใน `.env.local` */
export function getFirebaseApp(): FirebaseApp | null {
  if (!isFirebaseConfigured()) return null;
  if (!cachedApp) {
    cachedApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
  }
  return cachedApp;
}

export function getFirestoreDb(): Firestore | null {
  const app = getFirebaseApp();
  if (!app) return null;
  if (!cachedDb) {
    cachedDb = getFirestore(app);
  }
  return cachedDb;
}

export { firebaseConfig, isFirebaseConfigured } from "../firebaseConfig.js";
