import type { Metadata } from "next";
import { AuthGate } from "@/components/AuthGate";
import { AuthProvider } from "@/components/AuthProvider";
import { AppShell } from "@/components/AppShell";
import { MenuAccessProvider } from "@/components/MenuAccessProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "HYEV — งานซ่อม & จ้างเหมา",
  description: "ระบบรับงานซ่อม ผู้ว่าจ้าง ผู้รับเหมา งวดเงิน และเอกสาร",
};

/** ทุกหน้าอ่านจากฐานข้อมูล — ไม่ prerender ตอน build */
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th">
      <body className="min-h-screen antialiased">
        <AuthProvider>
          <AuthGate>
            <MenuAccessProvider>
              <AppShell>{children}</AppShell>
            </MenuAccessProvider>
          </AuthGate>
        </AuthProvider>
      </body>
    </html>
  );
}
