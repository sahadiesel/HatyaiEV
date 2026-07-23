"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { sumBalanceForAccountNumber } from "@/lib/bank-accounts-client";
import {
  deleteCashbookEntryClient,
  loadCashbookDashboard,
  postCashbookEntryClient,
} from "@/lib/cashbook-client";
import type { BankAccountRecord, CashbookEntry, CashChannel, CashVatType } from "@/lib/domain-types";
import { formatBaht } from "@/lib/vehicles/calc";

const inp =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

const MONTH_OPTIONS = [
  { value: 1, label: "มกราคม" },
  { value: 2, label: "กุมภาพันธ์" },
  { value: 3, label: "มีนาคม" },
  { value: 4, label: "เมษายน" },
  { value: 5, label: "พฤษภาคม" },
  { value: 6, label: "มิถุนายน" },
  { value: 7, label: "กรกฎาคม" },
  { value: 8, label: "สิงหาคม" },
  { value: 9, label: "กันยายน" },
  { value: 10, label: "ตุลาคม" },
  { value: 11, label: "พฤศจิกายน" },
  { value: 12, label: "ธันวาคม" },
];

function nowParts() {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

const TYPE_LABELS: Record<string, string> = {
  DOCUMENT_AUTO: "จากเอกสารอัตโนมัติ",
  MANUAL: "บันทึกมือ",
  VEHICLE_PURCHASE: "ซื้อรถเข้า",
  VEHICLE_SALE: "ขายรถ",
  PARTS: "อะไหล่/ต้นทุนรถ",
  MISC: "เบ็ดเตล็ด",
  PURCHASE_DEPOSIT: "มัดจำซื้อเข้า",
  SALE_DEPOSIT: "มัดจำขายออก",
};

const VAT_LABELS: Record<string, string> = {
  FULL_VAT: "VAT เต็ม",
  MARGIN_VAT: "VAT Margin ป.111",
  NO_VAT: "ไม่มี VAT",
};

export function CashbookClient({ userName = "" }: { userName?: string }) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [msgOk, setMsgOk] = useState(true);
  const [showQuick, setShowQuick] = useState(false);
  const [entries, setEntries] = useState<CashbookEntry[]>([]);
  const [banks, setBanks] = useState<BankAccountRecord[]>([]);
  const [totalIn, setTotalIn] = useState(0);
  const [totalOut, setTotalOut] = useState(0);
  const [balance, setBalance] = useState(0);
  const [cashBalance, setCashBalance] = useState(0);
  const [bankBalances, setBankBalances] = useState<Record<string, number>>({});
  const [channel, setChannel] = useState<CashChannel>("BANK");
  const [bankAccountId, setBankAccountId] = useState("");
  const [vatType, setVatType] = useState<CashVatType>("NO_VAT");
  const initial = nowParts();
  const [filterYear, setFilterYear] = useState(initial.year);
  const [filterMonth, setFilterMonth] = useState(initial.month);

  const reload = useCallback(async () => {
    const data = await loadCashbookDashboard();
    setEntries(data.entries);
    setBanks(data.banks);
    setTotalIn(data.totalIn);
    setTotalOut(data.totalOut);
    setBalance(data.balance);
    setCashBalance(data.cashBalance);
    setBankBalances(data.bankBalances);
    if (data.primary && !bankAccountId) setBankAccountId(data.primary.id);
  }, [bankAccountId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const primaryBank = banks.find((b) => b.isPrimary) || banks[0];
  const primaryBalance = primaryBank
    ? sumBalanceForAccountNumber(banks, bankBalances, primaryBank.accountNumber)
    : 0;

  const yearOptions = (() => {
    const years = new Set<number>([filterYear, nowParts().year]);
    for (const e of entries) {
      const y = Number(String(e.entryDate).slice(0, 4));
      if (Number.isFinite(y) && y >= 2000 && y <= 2100) years.add(y);
    }
    return [...years].sort((a, b) => b - a);
  })();

  const filteredEntries = entries.filter((e) => {
    const d = String(e.entryDate ?? "");
    const y = Number(d.slice(0, 4));
    const m = Number(d.slice(5, 7));
    return y === filterYear && m === filterMonth;
  });

  function onQuick(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    startTransition(async () => {
      const res = await postCashbookEntryClient({
        entryDate: String(fd.get("entryDate") ?? "") || undefined,
        direction: (String(fd.get("direction") ?? "OUT") as "IN" | "OUT") || "OUT",
        entryType: "MANUAL",
        amount: String(fd.get("amount") ?? "0"),
        description: String(fd.get("description") ?? ""),
        channel,
        bankAccountId: channel === "BANK" ? bankAccountId || null : null,
        vatType,
        createdByName: userName,
      });
      if (!res.ok) {
        setMsgOk(false);
        setMsg(res.message);
        return;
      }
      setMsgOk(true);
      setMsg(`บันทึกแล้ว (${res.entryNo}) — ยอดบัญชีอัปเดตทันที`);
      form.reset();
      setShowQuick(false);
      await reload();
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">สมุดเงินสด & บัญชีธนาคาร</h1>
        <p className="mt-1 text-sm text-slate-600">
          หน้าต่างเดียวคุมกระแสเงินสดหน้าร้านและบัญชีธนาคาร — ลงอัตโนมัติเมื่อออกบิล + บันทึกมือ
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border-2 border-slate-900 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">บัญชีธนาคารหลัก</p>
          <p className="mt-1 font-semibold text-slate-900">
            {primaryBank
              ? `${primaryBank.bankName} ${primaryBank.accountNumber}`
              : "กสิกรไทย 215-8-41628-2"}
          </p>
          <p className="text-xs text-slate-500">
            {primaryBank?.accountName || "บริษัท หาดใหญ่ อี วี จำกัด"}
          </p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">
            ฿{formatBaht(primaryBalance)}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">เงินสดหน้าร้าน</p>
          <p className="mt-1 text-xl font-bold tabular-nums">฿{formatBaht(cashBalance)}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">รวม Cashflow</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-emerald-700">
            รับ ฿{formatBaht(totalIn)}
          </p>
          <p className="text-sm tabular-nums text-red-600">จ่าย ฿{formatBaht(totalOut)}</p>
          <p className="mt-1 text-lg font-bold tabular-nums">สุทธิ ฿{formatBaht(balance)}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">ปี</span>
            <select
              className={`${inp} min-w-[7rem]`}
              value={filterYear}
              onChange={(e) => setFilterYear(Number(e.target.value))}
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">เดือน</span>
            <select
              className={`${inp} min-w-[10rem]`}
              value={filterMonth}
              onChange={(e) => setFilterMonth(Number(e.target.value))}
            >
              {MONTH_OPTIONS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          <p className="pb-2 text-xs text-slate-500">
            แสดง {filteredEntries.length} รายการในเดือนที่เลือก
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

      {msg && (
        <p
          className={
            msgOk
              ? "rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
              : "rounded-md bg-red-50 px-3 py-2 text-sm text-red-800"
          }
        >
          {msg}
        </p>
      )}

      {showQuick && (
        <form onSubmit={onQuick} className="space-y-3 rounded-lg border border-amber-200 bg-amber-50/50 p-5 shadow-sm">
          <h2 className="font-semibold text-slate-900">บันทึกรายการด่วน</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
              <span className="mb-1 block text-slate-600">ช่องทาง</span>
              <select
                className={inp}
                value={channel}
                onChange={(e) => setChannel(e.target.value as CashChannel)}
              >
                <option value="BANK">บัญชีธนาคาร</option>
                <option value="CASH">เงินสดหน้าร้าน</option>
              </select>
            </label>
            {channel === "BANK" && (
              <label className="text-sm">
                <span className="mb-1 block text-slate-600">บัญชี</span>
                <select
                  className={inp}
                  value={bankAccountId}
                  onChange={(e) => setBankAccountId(e.target.value)}
                  required
                >
                  <option value="">— เลือกบัญชี —</option>
                  {banks.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.bankName} {b.accountNumber}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">ประเภท VAT</span>
              <select
                className={inp}
                value={vatType}
                onChange={(e) => setVatType(e.target.value as CashVatType)}
              >
                <option value="NO_VAT">ไม่มี VAT (เช่น ซื้อจากบุคคล)</option>
                <option value="FULL_VAT">VAT เต็มยอด</option>
                <option value="MARGIN_VAT">VAT Margin ป.111</option>
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">จำนวนเงิน</span>
              <input name="amount" className={inp} required placeholder="0.00" />
            </label>
            <label className="text-sm sm:col-span-2 lg:col-span-4">
              <span className="mb-1 block text-slate-600">รายละเอียด</span>
              <input
                name="description"
                className={inp}
                required
                placeholder="เช่น จ่ายมัดจำซื้อรถ / รับมัดจำขาย"
              />
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

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="border-b bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-3 py-2">เลขที่</th>
              <th className="px-3 py-2">วันที่</th>
              <th className="px-3 py-2">ช่องทาง</th>
              <th className="px-3 py-2">ประเภท</th>
              <th className="px-3 py-2">VAT</th>
              <th className="px-3 py-2">รายละเอียด</th>
              <th className="px-3 py-2 text-right">รับเข้า</th>
              <th className="px-3 py-2 text-right">จ่ายออก</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {filteredEntries.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-slate-500">
                  {entries.length === 0
                    ? "ยังไม่มีรายการ — ออกใบเสร็จ/ใบสำคัญจ่าย หรือบันทึกรายการด่วน"
                    : "ไม่พบรายการในเดือนที่เลือก"}
                </td>
              </tr>
            )}
            {filteredEntries.map((e) => {
              const amt = Number(e.amount) || 0;
              const bank = banks.find((b) => b.id === e.bankAccountId);
              const channelLabel =
                e.channel === "BANK"
                  ? bank
                    ? `${bank.bankName} ${bank.accountNumber}`
                    : "ธนาคาร"
                  : "เงินสด";
              return (
                <tr key={e.id} className="border-b border-slate-100">
                  <td className="px-3 py-2 font-mono text-xs">{e.entryNo}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{e.entryDate}</td>
                  <td className="px-3 py-2 text-xs">{channelLabel}</td>
                  <td className="px-3 py-2 text-xs">{TYPE_LABELS[e.entryType] ?? e.entryType}</td>
                  <td className="px-3 py-2 text-xs">
                    {e.vatType ? VAT_LABELS[e.vatType] ?? e.vatType : "—"}
                  </td>
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
                            await deleteCashbookEntryClient(e.id);
                            await reload();
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
      <p className="text-xs text-slate-500">
        ตั้งค่าบัญชีธนาคารได้ที่เมนู <a className="text-blue-800 underline" href="/settings/bank-accounts">ตั้งค่าบัญชีธนาคาร</a>
      </p>
    </div>
  );
}
