import { randomBytes } from "crypto";

/** รหัสเอกสารใหม่ (รูปแบบ cuid-like สำหรับ Firestore) */
export function newEntityId(): string {
  const t = Date.now().toString(36);
  const r = randomBytes(8).toString("hex");
  return `c${t}${r}`.slice(0, 25);
}
