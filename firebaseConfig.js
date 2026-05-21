/**
 * Firebase Web SDK — ค่าคอนฟิกสำหรับ initializeApp
 *
 * ใส่ค่าจริงใน `.env.local` (local) หรือ `apphosting.yaml` (App Hosting)
 *
 * @type {import("firebase/app").FirebaseOptions}
 */
function configFromAppHostingWebConfig() {
  const raw = process.env.FIREBASE_WEBAPP_CONFIG;
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(raw);
    return {
      apiKey: String(parsed.apiKey ?? ""),
      authDomain: String(parsed.authDomain ?? ""),
      projectId: String(parsed.projectId ?? ""),
      storageBucket: String(parsed.storageBucket ?? ""),
      messagingSenderId: String(parsed.messagingSenderId ?? ""),
      appId: String(parsed.appId ?? ""),
      measurementId: parsed.measurementId ? String(parsed.measurementId) : undefined,
    };
  } catch {
    return null;
  }
}

const fromEnv = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
};

const fromHosting = configFromAppHostingWebConfig();

/** @type {import("firebase/app").FirebaseOptions} */
export const firebaseConfig = {
  apiKey: fromEnv.apiKey || fromHosting?.apiKey || "",
  authDomain: fromEnv.authDomain || fromHosting?.authDomain || "",
  projectId: fromEnv.projectId || fromHosting?.projectId || "",
  storageBucket: fromEnv.storageBucket || fromHosting?.storageBucket || "",
  messagingSenderId: fromEnv.messagingSenderId || fromHosting?.messagingSenderId || "",
  appId: fromEnv.appId || fromHosting?.appId || "",
};

const measurementId =
  process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || fromHosting?.measurementId;
if (measurementId) {
  firebaseConfig.measurementId = measurementId;
}

export function isFirebaseConfigured() {
  return Boolean(
    firebaseConfig.apiKey &&
      firebaseConfig.authDomain &&
      firebaseConfig.projectId &&
      firebaseConfig.storageBucket &&
      firebaseConfig.messagingSenderId &&
      firebaseConfig.appId,
  );
}
