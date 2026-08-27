"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import {
  CASH_ACCOUNT_ID,
  deleteBankAccountClient,
  ensurePrimaryBankAccount,
  getBankAccountsUsageMapClient,
  normalizeAccountNumber,
  saveBankAccountClient,
  transferBetweenAccountsClient,
  type BankAccountUsage,
} from "@/lib/bank-accounts-client";
import type { BankAccountKind, BankAccountRecord } from "@/lib/domain-types";

const inp =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

function fmtMoney(n: number): string {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function BankAccountsSettingsClient() {
  const [rows, setRows] = useState<BankAccountRecord[]>([]);
  const [cashBalance, setCashBalance] = useState(0);
  const [usage, setUsage] = useState<Record<string, BankAccountUsage>>({});
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [msgOk, setMsgOk] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [kind, setKind] = useState<BankAccountKind>("BANK");
  const [accountName, setAccountName] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [openingBalance, setOpeningBalance] = useState("0");
  const [isPrimary, setIsPrimary] = useState(false);
  const [notes, setNotes] = useState("");

  const [xferDate, setXferDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [xferAmount, setXferAmount] = useState("");
  const [xferFrom, setXferFrom] = useState(CASH_ACCOUNT_ID);
  const [xferTo, setXferTo] = useState("");
  const [xferNotes, setXferNotes] = useState("");

  const reload = useCallback(async () => {
    await ensurePrimaryBankAccount();
    const data = await getBankAccountsUsageMapClient();
    setRows(data.banks);
    setCashBalance(data.cashBalance);
    setUsage(data.usage);
    setXferTo((prev) => prev || data.banks[0]?.id || "");
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const duplicateGroups = useMemo(() => {
    const map = new Map<string, BankAccountRecord[]>();
    for (const b of rows) {
      if (b.kind === "CASH") continue;
      const key = normalizeAccountNumber(b.accountNumber);
      if (!key) continue;
      const list = map.get(key) || [];
      list.push(b);
      map.set(key, list);
    }
    return [...map.values()].filter((g) => g.length > 1);
  }, [rows]);

  const accountOptions = useMemo(
    () => [
      { id: CASH_ACCOUNT_ID, label: `เงินสดหน้าร้าน (คงเหลือ ฿${fmtMoney(cashBalance)})` },
      ...rows.map((b) => {
        const bal = usage[b.id]?.balance ?? 0;
        if (b.kind === "CASH") {
          return {
            id: b.id,
            label: `เงินสด · ${b.accountName} (฿${fmtMoney(bal)})`,
          };
        }
        return {
          id: b.id,
          label: `${b.bankName} ${b.accountNumber}${b.isPrimary ? " · หลัก" : ""} (฿${fmtMoney(bal)})`,
        };
      }),
    ],
    [rows, cashBalance, usage],
  );

  function resetForm() {
    setEditingId(null);
    setKind("BANK");
    setAccountName("");
    setBankName("");
    setAccountNumber("");
    setOpeningBalance("0");
    setIsPrimary(false);
    setNotes("");
  }

  function openEdit(b: BankAccountRecord) {
    setEditingId(b.id);
    setKind(b.kind);
    setAccountName(b.accountName);
    setBankName(b.bankName);
    setAccountNumber(b.accountNumber);
    setOpeningBalance(b.openingBalance);
    setIsPrimary(b.isPrimary);
    setNotes(b.notes);
  }

  function onSave(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await saveBankAccountClient({
        id: editingId,
        kind,
        accountName,
        bankName: kind === "CASH" ? "เงินสด" : bankName,
        accountNumber,
        openingBalance,
        isPrimary: kind === "BANK" && isPrimary,
        active: true,
        notes,
      });
      if (!res.ok) {
        setMsgOk(false);
        setMsg(res.message);
        return;
      }
      await reload();
      resetForm();
      setMsgOk(true);
      setMsg(kind === "CASH" ? "บันทึกบัญชีเงินสดแล้ว" : "บันทึกบัญชีธนาคารแล้ว");
    });
  }

  function onDelete(b: BankAccountRecord) {
    const u = usage[b.id];
    if (!u?.canDelete) {
      setMsgOk(false);
      setMsg(u?.reason || "ลบบัญชีนี้ไม่ได้");
      return;
    }
    const label =
      b.kind === "CASH" ? b.accountName : `${b.bankName} ${b.accountNumber}`;
    if (!confirm(`ลบบัญชี ${label}?\nยอดต้องเป็น 0 และไม่มีรายการในสมุดเงินสด`)) {
      return;
    }
    startTransition(async () => {
      const res = await deleteBankAccountClient(b.id);
      if (!res.ok) {
        setMsgOk(false);
        setMsg(res.message);
        return;
      }
      await reload();
      if (editingId === b.id) resetForm();
      setMsgOk(true);
      setMsg("ลบบัญชีแล้ว");
    });
  }

  function onTransfer(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await transferBetweenAccountsClient({
        entryDate: xferDate,
        amount: xferAmount,
        fromAccountId: xferFrom,
        toAccountId: xferTo,
        notes: xferNotes,
      });
      if (!res.ok) {
        setMsgOk(false);
        setMsg(res.message);
        return;
      }
      setXferAmount("");
      setXferNotes("");
      await reload();
      setMsgOk(true);
      setMsg("โอนเงินสำเร็จ — ลงสมุดเงินสดแล้ว");
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">ตั้งค่าบัญชี</h1>
        <p className="mt-1 text-sm text-slate-600">
          ธนาคาร + เงินสด — ผูกกับสมุดเงินสด · บัญชีที่มีเงินหรือมีรายการใช้แล้วลบไม่ได้
        </p>
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

      {duplicateGroups.length > 0 && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-semibold">พบบัญชีเลขซ้ำ</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-xs">
            {duplicateGroups.map((g) => (
              <li key={normalizeAccountNumber(g[0].accountNumber)}>
                {g[0].bankName} {g[0].accountNumber} — {g.length} รายการ ·{" "}
                {g
                  .map((b) => {
                    const u = usage[b.id];
                    return u?.isUsed || u?.hasMoney
                      ? `${b.id.slice(0, 6)}… (ใช้แล้ว/มียอด)`
                      : `${b.id.slice(0, 6)}… (ว่าง — ลบได้)`;
                  })
                  .join(" · ")}
              </li>
            ))}
          </ul>
          <p className="mt-1 text-xs">ลบบัญชีที่ว่างออกเหลือบัญชีเดียวที่ใช้งานจริง</p>
        </div>
      )}

      <form onSubmit={onSave} className="space-y-3 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-slate-900">{editingId ? "แก้ไขบัญชี" : "เพิ่มบัญชี"}</h2>

        <fieldset className="space-y-2">
          <legend className="mb-1 text-sm text-slate-600">ประเภทบัญชี *</legend>
          <div className="flex flex-wrap gap-4 text-sm text-slate-800">
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                name="account-kind"
                checked={kind === "CASH"}
                onChange={() => {
                  setKind("CASH");
                  setIsPrimary(false);
                  if (!bankName) setBankName("เงินสด");
                }}
              />
              เงินสด
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                name="account-kind"
                checked={kind === "BANK"}
                onChange={() => setKind("BANK")}
              />
              บัญชีธนาคาร
            </label>
          </div>
        </fieldset>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm sm:col-span-2">
            <span className="mb-1 block text-slate-600">ชื่อบัญชี *</span>
            <input
              className={inp}
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder={kind === "CASH" ? "เช่น เงินสด (โจ้)" : "ชื่อบัญชี"}
              required
            />
          </label>
          {kind === "BANK" ? (
            <>
              <label className="text-sm">
                <span className="mb-1 block text-slate-600">ธนาคาร *</span>
                <input
                  className={inp}
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  required
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-slate-600">เลขบัญชี *</span>
                <input
                  className={inp}
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  required
                />
              </label>
            </>
          ) : null}
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">ยอดยกมา</span>
            <input className={inp} value={openingBalance} onChange={(e) => setOpeningBalance(e.target.value)} />
          </label>
          {kind === "BANK" ? (
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={isPrimary} onChange={(e) => setIsPrimary(e.target.checked)} />
              ใช้เป็นบัญชีหลัก
            </label>
          ) : (
            <p className="self-center text-xs text-slate-500">บัญชีเงินสด — ไม่ต้องกรอกธนาคาร/เลขบัญชี</p>
          )}
          <label className="text-sm sm:col-span-2">
            <span className="mb-1 block text-slate-600">หมายเหตุ</span>
            <input className={inp} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            บันทึก
          </button>
          {editingId && (
            <button type="button" onClick={() => resetForm()} className="rounded-md border border-slate-300 px-4 py-2 text-sm">
              ยกเลิก
            </button>
          )}
        </div>
      </form>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="border-b bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-3 py-2">ช่องทาง / ธนาคาร</th>
              <th className="px-3 py-2">เลขบัญชี</th>
              <th className="px-3 py-2">ชื่อบัญชี</th>
              <th className="px-3 py-2 text-right">คงเหลือ</th>
              <th className="px-3 py-2 text-right">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-100 bg-emerald-50/40">
              <td className="px-3 py-2 font-medium text-slate-900">เงินสดหน้าร้าน</td>
              <td className="px-3 py-2 font-mono text-xs text-slate-500">CASH</td>
              <td className="px-3 py-2 text-slate-700">เงินสดในร้าน</td>
              <td className="px-3 py-2 text-right tabular-nums font-medium">฿{fmtMoney(cashBalance)}</td>
              <td className="px-3 py-2 text-right text-xs text-slate-500">ลบไม่ได้</td>
            </tr>
            {rows.map((b) => {
              const u = usage[b.id];
              const isDup = duplicateGroups.some((g) => g.some((x) => x.id === b.id));
              return (
                <tr key={b.id} className="border-b border-slate-100">
                  <td className="px-3 py-2">
                    {b.kind === "CASH" ? "เงินสด" : b.bankName}
                    {b.isPrimary ? " · หลัก" : ""}
                    {isDup ? (
                      <span className="ml-1 rounded bg-amber-100 px-1 text-[10px] text-amber-900">ซ้ำ</span>
                    ) : null}
                    {u?.isUsed ? (
                      <span className="ml-1 rounded bg-slate-100 px-1 text-[10px] text-slate-600">ใช้แล้ว</span>
                    ) : (
                      <span className="ml-1 rounded bg-slate-50 px-1 text-[10px] text-slate-400">ว่าง</span>
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {b.kind === "CASH" ? "—" : b.accountNumber}
                  </td>
                  <td className="px-3 py-2">{b.accountName}</td>
                  <td className="px-3 py-2 text-right tabular-nums">฿{fmtMoney(u?.balance ?? 0)}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <button type="button" className="text-blue-700 hover:underline" onClick={() => openEdit(b)}>
                        แก้ไข
                      </button>
                      <button
                        type="button"
                        className={
                          u?.canDelete
                            ? "text-red-600 hover:underline disabled:opacity-50"
                            : "cursor-not-allowed text-slate-300"
                        }
                        disabled={pending || !u?.canDelete}
                        title={u?.reason || "ลบ"}
                        onClick={() => onDelete(b)}
                      >
                        ลบ
                      </button>
                    </div>
                    {!u?.canDelete && u?.reason ? (
                      <p className="mt-0.5 text-[10px] leading-tight text-slate-400">{u.reason}</p>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <form onSubmit={onTransfer} className="space-y-3 rounded-lg border border-blue-200 bg-blue-50/40 p-5 shadow-sm">
        <h2 className="font-semibold text-slate-900">โอนเงินข้ามบัญชี</h2>
        <p className="text-xs text-slate-600">
          โอนระหว่างเงินสด ↔ ธนาคาร หรือบัญชีกับบัญชี — ลงสมุดเงินสดอัตโนมัติ
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">วันที่</span>
            <input type="date" className={inp} value={xferDate} onChange={(e) => setXferDate(e.target.value)} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">จำนวนเงิน *</span>
            <input className={inp} value={xferAmount} onChange={(e) => setXferAmount(e.target.value)} required />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">จากบัญชี *</span>
            <select className={inp} value={xferFrom} onChange={(e) => setXferFrom(e.target.value)} required>
              {accountOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">ไปบัญชี *</span>
            <select className={inp} value={xferTo} onChange={(e) => setXferTo(e.target.value)} required>
              {accountOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="mb-1 block text-slate-600">หมายเหตุ</span>
            <input className={inp} value={xferNotes} onChange={(e) => setXferNotes(e.target.value)} />
          </label>
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-blue-800 px-4 py-2 text-sm font-medium text-white hover:bg-blue-900 disabled:opacity-50"
        >
          {pending ? "กำลังโอน…" : "โอนเงิน"}
        </button>
      </form>
    </div>
  );
}
