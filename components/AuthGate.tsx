"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { isPublicPath } from "@/lib/auth-utils";
import { isFirebaseConfigured } from "@/lib/firebase";
import { useAuth } from "./AuthProvider";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const isPublic = isPublicPath(pathname);

  useEffect(() => {
    if (loading) return;
    if (!isFirebaseConfigured()) return;

    if (!user && !isPublic) {
      router.replace("/login");
      return;
    }

    if (user && profile?.approved && isPublic && pathname !== "/forgot-password") {
      router.replace("/");
    }
  }, [loading, user, profile, isPublic, pathname, router]);

  if (!isFirebaseConfigured()) {
    return (
      <>
        <div className="mx-auto max-w-5xl px-4 pt-4">
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            ยังไม่ได้ตั้งค่า Firebase — ระบบเข้าสู่ระบบและการบันทึกบนคลาวด์จะไม่ทำงาน
          </p>
        </div>
        {children}
      </>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-600">กำลังโหลด…</div>
    );
  }

  if (!user && !isPublic) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-600">
        กำลังไปหน้าเข้าสู่ระบบ…
      </div>
    );
  }

  if (user && profile && !profile.approved && !isPublic) {
    return (
      <div className="mx-auto max-w-md space-y-4 rounded-lg border border-amber-200 bg-amber-50 p-6 text-center shadow-sm">
        <h2 className="text-lg font-semibold text-amber-950">รอการอนุมัติบัญชี</h2>
        <p className="text-sm text-amber-900">
          บัญชีของคุณ ({profile.name || profile.email || profile.nationalId}) ยังไม่ได้รับการอนุมัติจากผู้ดูแลระบบ
        </p>
        <Link href="/login" className="inline-block text-sm font-medium text-blue-800 hover:underline">
          กลับหน้าเข้าสู่ระบบ
        </Link>
      </div>
    );
  }

  // มี user แต่โหลดโปรไฟล์ไม่สำเร็จ — ไม่ค้างหน้าโหลด
  if (user && !profile && !isPublic) {
    return (
      <div className="mx-auto max-w-md space-y-4 rounded-lg border border-amber-200 bg-amber-50 p-6 text-center shadow-sm">
        <h2 className="text-lg font-semibold text-amber-950">โหลดข้อมูลผู้ใช้ไม่สำเร็จ</h2>
        <p className="text-sm text-amber-900">
          เข้าสู่ระบบแล้ว แต่ดึงโปรไฟล์จาก Firestore ไม่ได้ — ลองรีเฟรช หรือเข้าสู่ระบบใหม่
        </p>
        <div className="flex justify-center gap-3">
          <button
            type="button"
            className="rounded-md bg-slate-900 px-3 py-2 text-sm text-white"
            onClick={() => window.location.reload()}
          >
            รีเฟรช
          </button>
          <Link href="/login" className="inline-block text-sm font-medium text-blue-800 hover:underline">
            หน้าเข้าสู่ระบบ
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
