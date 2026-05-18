import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "HYEV — งานซ่อม & จ้างเหมา",
  description: "ระบบรับงานซ่อม ผู้ว่าจ้าง ผู้รับเหมา งวดเงิน และเอกสาร",
};

const nav = [
  { href: "/", label: "หน้าแรก" },
  { href: "/settings", label: "ตั้งค่าร้าน" },
  { href: "/clients", label: "ผู้ว่าจ้าง" },
  { href: "/contractors", label: "ผู้รับเหมา" },
  { href: "/contracts", label: "เอกสารสัญญา" },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body className="min-h-screen antialiased">
        <header className="sticky top-0 z-50 border-b border-slate-200 bg-white shadow-sm">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
            <Link href="/" className="text-lg font-semibold text-slate-900">
              HYEV
            </Link>
            <nav className="flex flex-wrap items-center gap-2 text-sm">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-md px-2 py-1 text-slate-700 hover:bg-slate-100"
                >
                  {item.label}
                </Link>
              ))}
              <Link href="/documents" className="rounded-md px-2 py-1 text-slate-700 hover:bg-slate-100">
                การจัดการเอกสาร
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
