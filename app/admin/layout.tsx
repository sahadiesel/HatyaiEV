"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";

const userSettingsSubnav = [
  { href: "/admin/users", label: "ผู้ใช้งาน", exact: true },
  { href: "/admin/users/approval", label: "การอนุมัติ" },
  { href: "/admin/users/permissions", label: "การกำหนดสิทธิ์ผู้ใช้งาน" },
  { href: "/admin/users/roles-permission", label: "role&permission" },
] as const;

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { profile, loading, isAdmin } = useAuth();
  const pathname = usePathname() ?? "";
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!profile || !isAdmin) {
      router.replace("/");
    }
  }, [loading, profile, isAdmin, router]);

  if (loading || !profile || !isAdmin) {
    return <p className="text-sm text-slate-600">กำลังตรวจสอบสิทธิ์…</p>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">การตั้งค่าผู้ใช้งาน</h1>
      <nav aria-label="เมนูตั้งค่าผู้ใช้" className="flex flex-wrap gap-2 border-b border-slate-200 pb-3 text-sm">
        {userSettingsSubnav.map((item) => {
          const active =
            "exact" in item && item.exact
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={
                active
                  ? "rounded-md border border-slate-900 bg-slate-900 px-3 py-2 font-medium text-white"
                  : "rounded-md border border-slate-200 bg-white px-3 py-2 text-slate-800 hover:bg-slate-50"
              }
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}
