"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { useState } from "react";
import { nationalIdToAuthEmail, normalizeNationalId } from "@/lib/auth-utils";
import { getFirebaseAuth } from "@/lib/firebase-auth";
import { getUserProfile } from "@/lib/users-firestore";

export default function LoginPage() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const form = e.currentTarget;
    const nationalId = normalizeNationalId(String(new FormData(form).get("nationalId") ?? ""));
    const password = String(new FormData(form).get("password") ?? "");

    const auth = getFirebaseAuth();
    if (!auth) {
      setError("ยังไม่ได้ตั้งค่า Firebase");
      setPending(false);
      return;
    }

    try {
      const email = nationalIdToAuthEmail(nationalId);
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const profile = await getUserProfile(cred.user.uid);
      if (profile && !profile.approved) {
        await signOut(auth);
        setError("บัญชีของคุณยังรอการอนุมัติจากผู้ดูแลระบบ");
        setPending(false);
        return;
      }
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "เข้าสู่ระบบไม่สำเร็จ");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-10">
      <h1 className="text-2xl font-bold text-slate-900">เข้าสู่ระบบ</h1>
      <p className="mt-1 text-sm text-slate-600">ใช้เลขบัตรประชาชนและรหัสผ่านที่ลงทะเบียนไว้</p>

      {error && (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">{error}</p>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <label className="block text-sm">
          <span className="font-medium text-slate-700">เลขบัตรประชาชน</span>
          <input
            name="nationalId"
            required
            inputMode="numeric"
            maxLength={17}
            className={inp}
            placeholder="13 หลัก"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-slate-700">รหัสผ่าน</span>
          <input name="password" type="password" required minLength={6} className={inp} />
        </label>
        <button type="submit" disabled={pending} className={btn}>
          {pending ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-slate-600">
        <Link href="/forgot-password" className="font-medium text-blue-800 hover:underline">
          ลืมรหัสผ่าน
        </Link>
      </p>
      <p className="mt-2 text-center text-sm text-slate-600">
        ยังไม่มีบัญชี?{" "}
        <Link href="/register" className="font-medium text-blue-800 hover:underline">
          ลงทะเบียน
        </Link>
      </p>
    </div>
  );
}

const inp =
  "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";
const btn =
  "w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60";
