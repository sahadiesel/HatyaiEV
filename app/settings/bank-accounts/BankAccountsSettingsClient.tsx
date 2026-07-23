"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import {
  DEFAULT_PRIMARY_BANK,
  ensurePrimaryBankAccount,
  listBankAccountsClient,
  saveBankAccountClient,
} from "@/lib/bank-accounts-client";
import type { BankAccountRecord } from "@/lib/domain-types";

const inp =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

export function BankAccountsSettingsClient() {
  const [rows, setRows] = useState<BankAccountRecord[]>([]);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [msgOk, setMsgOk] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [accountName, setAccountName] = useState(DEFAULT_PRIMARY_BANK.accountName);
  const [bankName, setBankName] = useState(DEFAULT_PRIMARY_BANK.bankName);
  const [accountNumber, setAccountNumber] = useState(DEFAULT_PRIMARY_BANK.accountNumber);
  const [openingBalance, setOpeningBalance] = useState("0");
  const [isPrimary, setIsPrimary] = useState(true);
  const [notes, setNotes] = useState("");

  const reload = useCallback(async () => {
    await ensurePrimaryBankAccount();
    setRows(await listBankAccountsClient());
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  function resetForm(primary = false) {
    setEditingId(null);
    setAccountName(DEFAULT_PRIMARY_BANK.accountName);
    setBankName(DEFAULT_PRIMARY_BANK.bankName);
    setAccountNumber("");
    setOpeningBalance("0");
    setIsPrimary(primary);
    setNotes("");
  }

  function openEdit(b: BankAccountRecord) {
    setEditingId(b.id);
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
        accountName,
        bankName,
        accountNumber,
        openingBalance,
        isPrimary,
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
      setMsg("บันทึกบัญชีแล้ว");
    });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">ตั้งค่าบัญชีธนาคาร</h1>
        <p className="mt-1 text-sm text-slate-600">
          ผูกกับสมุดเงินสด — บัญชีหลักเริ่มต้น กสิกรไทย 215-8-41628-2
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

      <form onSubmit={onSave} className="space-y-3 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-slate-900">{editingId ? "แก้ไขบัญชี" : "เพิ่มบัญชี"}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm sm:col-span-2">
            <span className="mb-1 block text-slate-600">ชื่อบัญชี *</span>
            <input className={inp} value={accountName} onChange={(e) => setAccountName(e.target.value)} required />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">ธนาคาร *</span>
            <input className={inp} value={bankName} onChange={(e) => setBankName(e.target.value)} required />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">เลขบัญชี *</span>
            <input className={inp} value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} required />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">ยอดยกมา</span>
            <input className={inp} value={openingBalance} onChange={(e) => setOpeningBalance(e.target.value)} />
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={isPrimary} onChange={(e) => setIsPrimary(e.target.checked)} />
            ใช้เป็นบัญชีหลัก
          </label>
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
              <th className="px-3 py-2">ธนาคาร</th>
              <th className="px-3 py-2">เลขบัญชี</th>
              <th className="px-3 py-2">ชื่อบัญชี</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((b) => (
              <tr key={b.id} className="border-b border-slate-100">
                <td className="px-3 py-2">
                  {b.bankName}
                  {b.isPrimary ? " · หลัก" : ""}
                </td>
                <td className="px-3 py-2 font-mono text-xs">{b.accountNumber}</td>
                <td className="px-3 py-2">{b.accountName}</td>
                <td className="px-3 py-2 text-right">
                  <button type="button" className="text-blue-700 hover:underline" onClick={() => openEdit(b)}>
                    แก้ไข
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
