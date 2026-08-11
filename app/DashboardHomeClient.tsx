"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { loadCashbookDashboard } from "@/lib/cashbook-client";
import type { CashbookEntry, EntityRecord, VehicleRecord } from "@/lib/domain-types";
import { listEntitiesClient } from "@/lib/entities-client";
import { getFirestoreDb } from "@/lib/firebase";
import { firestoreCollections } from "@/lib/firestore-collections";
import { listVehiclesClient } from "@/lib/vehicles-client";
import { formatBaht, summarizeVehicleEconomics, VEHICLE_STATUS_LABELS } from "@/lib/vehicles/calc";

type DashState = {
  loading: boolean;
  vehicles: VehicleRecord[];
  entities: EntityRecord[];
  hireContractCount: number;
  cashBalance: number;
  cashIn: number;
  cashOut: number;
  recentCash: CashbookEntry[];
};

const empty: DashState = {
  loading: true,
  vehicles: [],
  entities: [],
  hireContractCount: 0,
  cashBalance: 0,
  cashIn: 0,
  cashOut: 0,
  recentCash: [],
};

async function countCollection(name: string): Promise<number> {
  const db = getFirestoreDb();
  if (!db) return 0;
  try {
    const snap = await getDocs(collection(db, name));
    return snap.size;
  } catch {
    return 0;
  }
}

export function DashboardHomeClient() {
  const [state, setState] = useState<DashState>(empty);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [vehicles, entities, cash, hireCount, subcontractCount] = await Promise.all([
        listVehiclesClient(),
        listEntitiesClient(),
        loadCashbookDashboard(),
        countCollection(firestoreCollections.hiringContracts),
        countCollection(firestoreCollections.subcontractAgreements),
      ]);
      if (cancelled) return;
      setState({
        loading: false,
        vehicles,
        entities,
        // การ์ด "สัญญาว่าจ้าง" = รวมสัญญารับจ้าง + งานเหมา
        hireContractCount: hireCount + subcontractCount,
        cashBalance: cash.balance,
        cashIn: cash.totalIn,
        cashOut: cash.totalOut,
        recentCash: cash.entries.slice(0, 6),
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = useMemo(() => {
    const inStock = state.vehicles.filter(
      (v) => v.status === "IN_STOCK" || v.status === "RESERVED",
    );
    const sold = state.vehicles.filter((v) => v.status === "SOLD").length;
    const stockValue = inStock.reduce(
      (sum, v) => sum + summarizeVehicleEconomics(v).totalCost,
      0,
    );
    return {
      inStockCount: inStock.length,
      reservedCount: state.vehicles.filter((v) => v.status === "RESERVED").length,
      soldCount: sold,
      stockValue,
      recentVehicles: [...inStock]
        .sort((a, b) => (b.purchaseDate || "").localeCompare(a.purchaseDate || ""))
        .slice(0, 5),
    };
  }, [state.vehicles]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="รถในสต็อก"
          value={state.loading ? "…" : String(stats.inStockCount)}
          href="/vehicles"
          hint={
            state.loading
              ? "กำลังโหลด…"
              : `จอง ${stats.reservedCount} · ขายแล้ว ${stats.soldCount} · มูลค่าต้นทุน ฿${formatBaht(stats.stockValue)}`
          }
        />
        <StatCard
          title="คู่ค้า"
          value={state.loading ? "…" : String(state.entities.length)}
          href="/entities"
          hint={state.loading ? "กำลังโหลด…" : "ลูกค้า · ผู้ขาย · ผู้รับจ้าง"}
        />
        <StatCard
          title="สัญญาว่าจ้าง"
          value={state.loading ? "…" : String(state.hireContractCount)}
          href="/contracts/subcontract-agreements"
          hint={state.loading ? "กำลังโหลด…" : "สัญญารับจ้าง / งานเหมา"}
        />
        <StatCard
          title="Cashflow Balance"
          value={state.loading ? "…" : `฿${formatBaht(state.cashBalance)}`}
          href="/cashbook"
          emphasize
          hint={
            state.loading
              ? "กำลังโหลด…"
              : `รับ ฿${formatBaht(state.cashIn)} · จ่าย ฿${formatBaht(state.cashOut)}`
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="font-semibold text-slate-900">รถในสต็อกล่าสุด</h2>
            <Link href="/vehicles" className="text-sm text-blue-700 hover:underline">
              ดูทั้งหมด
            </Link>
          </div>
          {state.loading ? (
            <p className="text-sm text-slate-500">กำลังโหลด…</p>
          ) : stats.recentVehicles.length === 0 ? (
            <p className="text-sm text-slate-500">
              ยังไม่มีรถในสต็อก —{" "}
              <Link href="/vehicles/new" className="text-blue-700 hover:underline">
                รับรถเข้าสต็อก
              </Link>
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {stats.recentVehicles.map((v) => {
                const eco = summarizeVehicleEconomics(v);
                return (
                  <li key={v.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <div className="min-w-0">
                      <Link
                        href={`/vehicles/${v.id}`}
                        className="font-medium text-slate-900 hover:text-blue-800 hover:underline"
                      >
                        {v.brand} {v.model}
                      </Link>
                      <p className="truncate text-xs text-slate-500">
                        {v.licensePlate || "ไม่มีทะเบียน"} · {VEHICLE_STATUS_LABELS[v.status]} ·{" "}
                        {v.purchaseDate || "—"}
                      </p>
                    </div>
                    <p className="shrink-0 tabular-nums text-slate-800">
                      ฿{formatBaht(eco.totalCost)}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="font-semibold text-slate-900">รายการเงินสดล่าสุด</h2>
            <Link href="/cashbook" className="text-sm text-blue-700 hover:underline">
              เปิดสมุดเงินสด
            </Link>
          </div>
          {state.loading ? (
            <p className="text-sm text-slate-500">กำลังโหลด…</p>
          ) : state.recentCash.length === 0 ? (
            <p className="text-sm text-slate-500">ยังไม่มีรายการในสมุดเงินสด</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {state.recentCash.map((e) => {
                const amt = Number(e.amount) || 0;
                return (
                  <li key={e.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-900">{e.description}</p>
                      <p className="text-xs text-slate-500">
                        {e.entryDate} · {e.entryNo}
                      </p>
                    </div>
                    <p
                      className={
                        e.direction === "IN"
                          ? "shrink-0 tabular-nums text-emerald-700"
                          : "shrink-0 tabular-nums text-red-600"
                      }
                    >
                      {e.direction === "IN" ? "+" : "−"}฿{formatBaht(amt)}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  href,
  hint,
  emphasize,
}: {
  title: string;
  value: string;
  href: string;
  hint?: string;
  emphasize?: boolean;
}) {
  return (
    <Link
      href={href}
      className={
        emphasize
          ? "rounded-lg border-2 border-slate-900 bg-white p-4 shadow-sm transition hover:bg-slate-50"
          : "rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300"
      }
    >
      <p className="text-sm text-slate-500">{title}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </Link>
  );
}
