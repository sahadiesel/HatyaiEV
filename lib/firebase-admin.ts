import { getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

let cachedApp: App | null = null;

/** Firebase Admin — ใช้บน server (App Hosting มี FIREBASE_CONFIG อัตโนมัติ) */
export function getFirebaseAdminApp(): App | null {
  if (cachedApp) return cachedApp;
  try {
    if (getApps().length > 0) {
      cachedApp = getApps()[0]!;
      return cachedApp;
    }
    const raw = process.env.FIREBASE_CONFIG;
    if (raw?.trim()) {
      try {
        cachedApp = initializeApp(JSON.parse(raw) as object);
        return cachedApp;
      } catch {
        /* ลองวิธีอื่น */
      }
    }
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim();
    if (projectId) {
      cachedApp = initializeApp({ projectId });
      return cachedApp;
    }
    if (process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT) {
      cachedApp = initializeApp();
      return cachedApp;
    }
    return null;
  } catch {
    return null;
  }
}

export function getAdminFirestore() {
  const app = getFirebaseAdminApp();
  if (!app) return null;
  return getFirestore(app);
}
