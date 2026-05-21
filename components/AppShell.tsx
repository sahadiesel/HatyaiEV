"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { signOut } from "firebase/auth";
import { isPublicPath } from "@/lib/auth-utils";
import { getFirebaseAuth } from "@/lib/firebase-auth";
import type { MenuId } from "@/lib/menu-access";
import { pathnameToMenuId } from "@/lib/menu-access";
import { useAuth } from "./AuthProvider";
import { useMenuAccess } from "./MenuAccessProvider";

const baseNav: { href: string; label: string; menuId: MenuId }[] = [
  { href: "/", label: "หน้าแรก", menuId: "home" },
  { href: "/clients", label: "ผู้ว่าจ้าง", menuId: "clients" },
  { href: "/contractors", label: "ผู้รับเหมา", menuId: "contractors" },
  { href: "/contracts", label: "เอกสารสัญญา", menuId: "contracts" },
  { href: "/documents", label: "การจัดการเอกสาร", menuId: "documents" },
];

/** เมนูการตั้งค่า — เฉพาะ admin */
const adminSettingsNav = [
  { href: "/admin/users", label: "การตั้งค่าผู้ใช้งาน", activePrefix: "/admin/users" },
  { href: "/settings", label: "ตั้งค่าร้าน", activePrefix: "/settings" },
] as const;

function isNavActive(pathname: string, href: string, activePrefix?: string) {
  const prefix = activePrefix ?? href;
  if (prefix === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${prefix}/`) || pathname === prefix;
}

function navLinkClass(active: boolean) {
  return active
    ? "flex items-center rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white"
    : "flex items-center rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100";
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const { user, profile, isAdmin } = useAuth();
  const { canView, canEdit, loading: accessLoading } = useMenuAccess();
  const isPublic = isPublicPath(pathname);

  const visibleNav = baseNav.filter((item) => isAdmin || canView(item.menuId));

  const currentMenuId = pathnameToMenuId(pathname);
  const viewOnly =
    !isAdmin && currentMenuId && canView(currentMenuId) && !canEdit(currentMenuId);

  useEffect(() => {
    if (isPublic || accessLoading || !profile?.approved) return;
    if (isAdmin) return;
    const menuId = pathnameToMenuId(pathname);
    if (menuId && !canView(menuId)) {
      router.replace("/");
    }
  }, [isPublic, accessLoading, profile, isAdmin, pathname, canView, router]);

  if (isPublic) {
    return <>{children}</>;
  }

  async function handleSignOut() {
    const auth = getFirebaseAuth();
    if (auth) await signOut(auth);
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="sticky top-0 flex h-screen w-56 shrink-0 flex-col border-r border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-4">
          <Link href="/" className="text-lg font-semibold tracking-tight text-slate-900">
            HYEV
          </Link>
        </div>

        <nav aria-label="เมนูหลัก" className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {visibleNav.map((item) => (
            <Link key={item.href} href={item.href} className={navLinkClass(isNavActive(pathname, item.href))}>
              {item.label}
            </Link>
          ))}

          {isAdmin && (
            <div className="mt-4 border-t border-slate-100 pt-4">
              <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">การตั้งค่า</p>
              {adminSettingsNav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={navLinkClass(isNavActive(pathname, item.href, item.activePrefix))}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          )}
        </nav>

        <div className="border-t border-slate-200 p-4">
          {profile && (
            <p className="truncate text-sm font-medium text-slate-900" title={profile.nationalId}>
              {profile.name || "ผู้ใช้"}
            </p>
          )}
          {profile?.role === "admin" && <p className="text-xs text-slate-500">ผู้ดูแลระบบ</p>}
          {user && (
            <button
              type="button"
              onClick={handleSignOut}
              className="mt-3 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 hover:bg-slate-50"
            >
              ออกจากระบบ
            </button>
          )}
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <main className="mx-auto max-w-5xl px-6 py-8">
          {viewOnly && (
            <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              คุณมีสิทธิ์ดูอย่างเดียวในหน้านี้ — ไม่สามารถแก้ไขข้อมูลได้
            </p>
          )}
          <fieldset disabled={Boolean(viewOnly)} className={viewOnly ? "pointer-events-none opacity-80" : undefined}>
            {children}
          </fieldset>
        </main>
      </div>
    </div>
  );
}
