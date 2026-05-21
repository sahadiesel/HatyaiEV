"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { useState } from "react";
import { nationalIdToAuthEmail, normalizeNationalId } from "@/lib/auth-utils";
import { getFirebaseAuth } from "@/lib/firebase-auth";
import { createUserProfileAfterRegister, isNationalIdTaken } from "@/lib/users-firestore";

export default function RegisterPage() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setMessage(null);

    const fd = new FormData(e.currentTarget);
    const nationalId = normalizeNationalId(String(fd.get("nationalId") ?? ""));
    const name = String(fd.get("name") ?? "").trim();
    const address = String(fd.get("address") ?? "").trim();
    const phone = String(fd.get("phone") ?? "").trim();
    const recoveryEmail = String(fd.get("recoveryEmail") ?? "").trim().toLowerCase();
    const password = String(fd.get("password") ?? "");
    const passwordConfirm = String(fd.get("passwordConfirm") ?? "");

    if (nationalId.length !== 13) {
      setError("เลขบัตรประชาชนต้องมี 13 หลัก");
      setPending(false);
      return;
    }
    if (password.length < 6) {
      setError("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร");
      setPending(false);
      return;
    }
    if (password !== passwordConfirm) {
      setError("รหัสผ่านทั้งสองช่องไม่ตรงกัน");
      setPending(false);
      return;
    }
    if (!recoveryEmail.includes("@")) {
      setError("กรอกอีเมลสำหรับกู้รหัสผ่านให้ถูกต้อง");
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
      if (await isNationalIdTaken(nationalId)) {
        setError("เลขบัตรประชาชนนี้ลงทะเบียนแล้ว");
        setPending(false);
        return;
      }

      const email = nationalIdToAuthEmail(nationalId);
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await cred.user.getIdToken(true);
      const profileResult = await createUserProfileAfterRegister(cred.user.uid, {
        nationalId,
        name,
        address,
        phone,
        recoveryEmail,
      });

      if (!profileResult.ok) {
        setError(profileResult.message);
        setPending(false);
        return;
      }

      if (profileResult.role === "admin") {
        setMessage("ลงทะเบียนสำเร็จ — คุณเป็นผู้ดูแลระบบ (admin) คนแรก");
        router.replace("/");
      } else {
        await signOut(auth);
        setMessage("ลงทะเบียนสำเร็จ — รอผู้ดูแลระบบอนุมัติบัญชีก่อนเข้าใช้งาน");
        router.replace("/login");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "ลงทะเบียนไม่สำเร็จ");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-2xl font-bold text-slate-900">ลงทะเบียน</h1>
      <p className="mt-1 text-sm text-slate-600">
        ผู้ใช้คนแรกจะได้รับสิทธิ์ <strong>admin</strong> อัตโนมัติ — ผู้ใช้ถัดไปต้องรอการอนุมัติ
      </p>

      {error && (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">{error}</p>
      )}
      {message && (
        <p className="mt-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900">{message}</p>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <Field label="ชื่อ-นามสกุล" name="name" required />
        <Field label="ที่อยู่" name="address" rows={2} required />
        <Field label="เบอร์โทรศัพท์" name="phone" required />
        <Field label="เลขบัตรประชาชน" name="nationalId" required inputMode="numeric" maxLength={17} />
        <Field label="อีเมลสำหรับกู้รหัสผ่าน" name="recoveryEmail" type="email" required />
        <Field label="รหัสผ่าน" name="password" type="password" required minLength={6} />
        <Field label="ยืนยันรหัสผ่าน" name="passwordConfirm" type="password" required minLength={6} />
        <button type="submit" disabled={pending} className={btn}>
          {pending ? "กำลังลงทะเบียน…" : "ลงทะเบียน"}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-slate-600">
        มีบัญชีแล้ว?{" "}
        <Link href="/login" className="font-medium text-blue-800 hover:underline">
          เข้าสู่ระบบ
        </Link>
      </p>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  rows,
  required,
  inputMode,
  maxLength,
  minLength,
}: {
  label: string;
  name: string;
  type?: string;
  rows?: number;
  required?: boolean;
  inputMode?: "numeric" | "text";
  maxLength?: number;
  minLength?: number;
}) {
  return (
    <label className="block text-sm">
      <span className="font-medium text-slate-700">{label}</span>
      {rows ? (
        <textarea name={name} rows={rows} required={required} className={inp} />
      ) : (
        <input
          name={name}
          type={type}
          required={required}
          inputMode={inputMode}
          maxLength={maxLength}
          minLength={minLength}
          className={inp}
        />
      )}
    </label>
  );
}

const inp =
  "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";
const btn =
  "w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60";
