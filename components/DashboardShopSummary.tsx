"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { isFirebaseConfigured } from "@/lib/firebase";
import { readCompanySettingsFromFirestore } from "@/lib/firestore";

export function DashboardShopSummary() {
  const [loading, setLoading] = useState(true);
  const [companyName, setCompanyName] = useState("");
  const [taxId, setTaxId] = useState("");

  useEffect(() => {
    async function load() {
      if (!isFirebaseConfigured()) {
        setLoading(false);
        return;
      }
      const fs = await readCompanySettingsFromFirestore();
      if (fs) {
        setCompanyName(fs.companyName.trim());
        setTaxId(fs.taxId.trim());
      }
      setLoading(false);
    }
    void load();
  }, []);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="font-semibold text-slate-900">ข้อมูลร้าน (จากตั้งค่า)</h2>
      {loading ? (
        <p className="mt-3 text-sm text-slate-500">กำลังโหลด…</p>
      ) : (
        <dl className="mt-3 space-y-1 text-sm text-slate-700">
          <div>
            <dt className="font-medium text-slate-500">ชื่อ</dt>
            <dd>{companyName || "— ยังไม่ได้ตั้งค่า —"}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-500">เลขผู้เสียภาษี</dt>
            <dd>{taxId || "—"}</dd>
          </div>
        </dl>
      )}
      <Link
        href="/settings"
        className="mt-4 inline-block text-sm font-medium text-blue-700 hover:underline"
      >
        ไปแก้ไขตั้งค่าร้าน →
      </Link>
    </section>
  );
}
