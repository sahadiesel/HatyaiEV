"use client";

import Link from "next/link";
import { sendPasswordResetEmail } from "firebase/auth";
import { useState } from "react";
import { normalizeNationalId } from "@/lib/auth-utils";
import { getFirebaseAuth } from "@/lib/firebase-auth";
import { findRecoveryEmailByNationalId } from "@/lib/users-firestore";

export default function ForgotPasswordPage() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setMessage(null);

    const nationalId = normalizeNationalId(String(new FormData(e.currentTarget).get("nationalId") ?? ""));
    if (nationalId.length !== 13) {
      setError("เลขบัตรประชาชนต้องมี 13 หลัก");
      setPending(false);
      return;
    }

    const auth = getFirebaseAuth();
    if (!auth) {
      setError("ยังไม่ได้ตั้งค่า Firebase");
      setPending(false);
      return;
    }

    try {
      const email = await findRecoveryEmailByNationalId(nationalId);
      if (!email) {
        setError("ไม่พบบัญชีที่ใช้เลขบัตรประชาชนนี้");
        setPending(false);
        return;
      }
      await sendPasswordResetEmail(auth, email);
      setMessage(`ส่งลิงก์รีเซ็ตรหัสผ่านไปที่ ${email} แล้ว — ตรวจสอบกล่องจดหมาย`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ส่งอีเมลไม่สำเร็จ");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-10">
      <h1 className="text-2xl font-bold text-slate-900">ลืมรหัสผ่าน</h1>
      <p className="mt-1 text-sm text-slate-600">กรอกเลขบัตรประชาชนเพื่อรับลิงก์รีเซ็ตรหัสผ่าน</p>

      {error && (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">{error}</p>
      )}
      {message && (
        <p className="mt-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900">{message}</p>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <label className="block text-sm">
          <span className="font-medium text-slate-700">เลขบัตรประชาชน</span>
          <input name="nationalId" required inputMode="numeric" maxLength={17} className={inp} />
        </label>
        <button type="submit" disabled={pending} className={btn}>
          {pending ? "กำลังส่ง…" : "ส่งลิงก์รีเซ็ตรหัสผ่าน"}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-slate-600">
        <Link href="/login" className="font-medium text-blue-800 hover:underline">
          กลับหน้าเข้าสู่ระบบ
        </Link>
      </p>
    </div>
  );
}

const inp =
  "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";
const btn =
  "w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60";
