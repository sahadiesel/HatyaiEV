"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  deleteCashEntryAction,
  saveManualCashEntryAction,
  setOpeningBalanceAction,
} from "./actions";
import type { CashbookEntry } from "@/lib/domain-types";
import { formatBaht } from "@/lib/vehicles/calc";

const inp =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

const TYPE_LABELS: Record<string, string> = {
  DOCUMENT_AUTO: "จากเอกสารอัตโนมัติ",
  MANUAL: "บันทึกมือ",
  VEHICLE_PURCHASE: "ซื้อรถเข้า",
  VEHICLE_SALE: "ขายรถ",
  PARTS: "อะไหล่/ต้นทุนรถ",
  MISC: "เบ็ดเตล็ด",
};

export function CashbookClient({
  openingBalance,
  totalIn,
  totalOut,
  balance,
  entries,
  userName,
}: {
  openingBalance: number;
  totalIn: number;
  totalOut: number;
  balance: number;
  entries: CashbookEntry[];
  userName: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [showQuick, setShowQuick] = useState(false);

  function onQuick(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("createdByName", userName);
    startTransition(async () => {
      const res = await saveManualCashEntryAction(fd);
      if (!res.ok) {
        setMsg(res.message);
        return;
      }
      setMsg("บันทึกรายการด่วนแล้ว — ยอด Cashflow อัปเดตทันที");
      setShowQuick(false);
      e.currentTarget.reset();
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">สมุดเงินสด & กระแสเงินสด</h1>
          <p className="mt-1 text-sm text-slate-600">
            Hybrid Posting — ลงอัตโนมัติเมื่อออกบิล + บันทึกมือสำหรับรายจ่ายเบ็ดเตล็ด
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowQuick(true)}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          + บันทึกรายการด่วน
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">ยอดยกมา</p>
          <p className="mt-1 text-xl font-bold tabular-nums">฿{formatBaht(openingBalance)}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">รับเข้า (IN)</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-emerald-700">฿{formatBaht(totalIn)}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">จ่ายออก (OUT)</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-red-600">฿{formatBaht(totalOut)}</p>
        </div>
        <div className="rounded-lg border-2 border-slate-900 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Cashflow Balance</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">฿{formatBaht(balance)}</p>
        </div>
      </div>

      {msg && <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{msg}</p>}

      {showQuick && (
        <form onSubmit={onQuick} className="space-y-3 rounded-lg border border-amber-200 bg-amber-50/50 p-5 shadow-sm">
          <h2 className="font-semibold text-slate-900">บันทึกรายการด่วน (ไม่มีบิลในระบบ)</h2>
          <p className="text-xs text-slate-600">
            เช่น ซื้อน้ำยาหล่อเย็นหน้าปากซอย, ค่ากาแฟรับรองลูกค้า — หักจาก Cashflow ทันที
          </p>
          <div className="grid gap-3 sm:grid-cols-4">
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">วันที่</span>
              <input
                name="entryDate"
                type="date"
                className={inp}
                defaultValue={new Date().toISOString().slice(0, 10)}
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">ทิศทาง</span>
              <select name="direction" className={inp} defaultValue="OUT">
                <option value="OUT">จ่ายออก</option>
                <option value="IN">รับเข้า</option>
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">จำนวนเงิน</span>
              <input name="amount" className={inp} required placeholder="0.00" />
            </label>
            <label className="text-sm sm:col-span-4">
              <span className="mb-1 block text-slate-600">รายละเอียด</span>
              <input name="description" className={inp} required placeholder="เช่น ซื้อน้ำยาหล่อเย็น 2 ขวด" />
            </label>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              บันทึก
            </button>
            <button
              type="button"
              onClick={() => setShowQuick(false)}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm"
            >
              ยกเลิก
            </button>
          </div>
        </form>
      )}

      <form
        className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          startTransition(async () => {
            const res = await setOpeningBalanceAction(fd);
            setMsg(res.ok ? "ตั้งยอดยกมาแล้ว" : res.message);
            router.refresh();
          });
        }}
      >
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">ตั้งยอดยกมา (Opening Balance)</span>
          <input
            name="openingBalance"
            className={inp}
            defaultValue={openingBalance.toFixed(2)}
            style={{ width: 180 }}
          />
        </label>
        <button type="submit" disabled={pending} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          บันทึกยอดยกมา
        </button>
      </form>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="border-b bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-3 py-2">เลขที่</th>
              <th className="px-3 py-2">วันที่</th>
              <th className="px-3 py-2">ประเภท</th>
              <th className="px-3 py-2">รายละเอียด</th>
              <th className="px-3 py-2 text-right">รับเข้า</th>
              <th className="px-3 py-2 text-right">จ่ายออก</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-slate-500">
                  ยังไม่มีรายการ — ออกใบเสร็จ/ใบสำคัญจ่าย หรือบันทึกรายการด่วน
                </td>
              </tr>
            )}
            {entries.map((e) => {
              const amt = Number(e.amount) || 0;
              return (
                <tr key={e.id} className="border-b border-slate-100">
                  <td className="px-3 py-2 font-mono text-xs">{e.entryNo}</td>
                  <td className="px-3 py-2">{e.entryDate}</td>
                  <td className="px-3 py-2 text-xs">{TYPE_LABELS[e.entryType] ?? e.entryType}</td>
                  <td className="px-3 py-2">
                    {e.description}
                    {e.documentNumber && (
                      <span className="ml-1 text-xs text-slate-400">({e.documentNumber})</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-emerald-700">
                    {e.direction === "IN" ? formatBaht(amt) : ""}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-red-600">
                    {e.direction === "OUT" ? formatBaht(amt) : ""}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {e.entryType === "MANUAL" && (
                      <button
                        type="button"
                        className="text-red-600 hover:underline"
                        onClick={() => {
                          if (!confirm("ลบรายการนี้?")) return;
                          startTransition(async () => {
                            await deleteCashEntryAction(e.id);
                            router.refresh();
                          });
                        }}
                      >
                        ลบ
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
