import { canWriteFirestore, FIRESTORE_WRITE_HINT } from "@/lib/data-primary";

/** แจ้งเตือนเมื่อยังไม่มี Firebase Admin credentials (server component) */
export function AdminSetupNotice() {
  if (canWriteFirestore()) return null;
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
      <p className="font-medium">ยังอ่าน/บันทึกข้อมูล Firestore จาก server ไม่ได้</p>
      <p className="mt-1">{FIRESTORE_WRITE_HINT}</p>
    </div>
  );
}
