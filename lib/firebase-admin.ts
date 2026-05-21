import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

let cachedApp: App | null = null;

function loadServiceAccountPath(): string | null {
  const fromEnv = process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim();
  if (fromEnv) return resolve(fromEnv);
  const gac = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  if (gac) return resolve(gac);
  const defaultPath = resolve(process.cwd(), "serviceAccountKey.json");
  if (existsSync(defaultPath)) return defaultPath;
  return null;
}

function initFromServiceAccount(): App | null {
  const saPath = loadServiceAccountPath();
  if (!saPath || !existsSync(saPath)) return null;
  try {
    const serviceAccount = JSON.parse(readFileSync(saPath, "utf8")) as object;
    const projectId =
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim() ||
      (serviceAccount as { project_id?: string }).project_id;
    return initializeApp({
      credential: cert(serviceAccount),
      ...(projectId ? { projectId } : {}),
    });
  } catch {
    return null;
  }
}

/** Firebase Admin — App Hosting ใช้ FIREBASE_CONFIG; local ใช้ service account หรือ ADC */
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

    const fromSa = initFromServiceAccount();
    if (fromSa) {
      cachedApp = fromSa;
      return cachedApp;
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
