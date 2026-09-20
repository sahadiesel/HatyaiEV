"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useAuth } from "@/components/AuthProvider";
import { PrintDocIconButton } from "@/components/PrintDocIconButton";
import {
  CASH_ACCOUNT_ID,
  channelForAccountId,
  resolvePaymentAccount,
  sumBalanceForAccountNumber,
  normalizeAccountNumber,
} from "@/lib/bank-accounts-client";
import {
  calcBalancesFromEntries,
  balanceForAccountBefore,
  deleteCashbookEntryClient,
  isAutoCarryNoiseEntry,
  loadCashbookDashboard,
  postCashbookEntryClient,
  resolveAccountGroupIds,
  updateCashbookEntryClient,
} from "@/lib/cashbook-client";
import { roundMoney2 } from "@/lib/documents/calc";
import { printDocumentClient } from "@/lib/documents-client";
import type {
  BankAccountRecord,
  CashbookEntry,
  CashbookEntryType,
  CashVatType,
  EntityRecord,
  VehicleCostCategory,
} from "@/lib/domain-types";
import { listEntitiesClient } from "@/lib/entities-client";
import { entityHasRoleGroup } from "@/lib/entity-roles";
import { formatBaht } from "@/lib/vehicles/calc";
import { formatDateThBE } from "@/lib/format-date-th";
import { createDocsForVehicleCostExpense } from "@/lib/vehicles/cost-expense-docs";

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

/** สองเดือนล่าสุดในปีปัจจุบัน เช่น ก.ค.–ส.ค. */
function defaultMonthRange() {
  const { year, month } = nowParts();
  return {
    year,
    from: month <= 1 ? 1 : month - 1,
    to: month,
  };
}

function monthLabel(m: number): string {
  return MONTH_OPTIONS.find((x) => x.value === m)?.label ?? String(m);
}

function matchesAccountFilter(
  e: CashbookEntry,
  filterAccountId: string,
  banks: BankAccountRecord[],
  primaryId: string | undefined,
): boolean {
  if (!filterAccountId) return true;
  if (filterAccountId === CASH_ACCOUNT_ID) {
    if (e.channel !== "CASH") return false;
    if (!e.bankAccountId) return true;
    const pot = banks.find((b) => b.id === e.bankAccountId);
    return !pot || pot.kind !== "CASH";
  }
  const acc = banks.find((b) => b.id === filterAccountId);
  if (!acc) return false;
  if (acc.kind === "CASH") {
    return e.channel === "CASH" && e.bankAccountId === filterAccountId;
  }
  if (e.channel !== "BANK") return false;
  const group = new Set(resolveAccountGroupIds(filterAccountId, banks));
  if (e.bankAccountId && group.has(e.bankAccountId)) return true;
  if (!e.bankAccountId && primaryId && group.has(primaryId)) return true;
  // เลขบัญชีตรงกันแม้ id คนละตัว
  if (e.bankAccountId) {
    const other = banks.find((b) => b.id === e.bankAccountId);
    if (
      other &&
      normalizeAccountNumber(other.accountNumber) ===
        normalizeAccountNumber(acc.accountNumber)
    ) {
      return true;
    }
  }
  return false;
}

const TYPE_LABELS: Record<string, string> = {
  DOCUMENT_AUTO: "จากเอกสารอัตโนมัติ",
  MANUAL: "บันทึกมือ",
  VEHICLE_PURCHASE: "ซื้อรถเข้า",
  VEHICLE_SALE: "ขายรถ",
  PARTS: "อะไหล่/ต้นทุนรถ",
  LABOR: "ค่าแรง",
  MISC: "เบ็ดเตล็ด",
  PURCHASE_DEPOSIT: "มัดจำซื้อเข้า",
  SALE_DEPOSIT: "มัดจำขายออก",
  TRANSFER: "โอนข้ามบัญชี",
  BALANCE_CARRY: "ยอดยกมา",
};

function cashbookPrintTargets(e: CashbookEntry): { whtId: string | null; pvId: string | null } {
  let whtId = e.withholdingDocumentId || null;
  let pvId = e.paymentVoucherDocumentId || null;
  if (!whtId && e.documentKind === "WITHHOLDING_TAX" && e.documentId) whtId = e.documentId;
  if (!pvId && e.documentKind === "PAYMENT_VOUCHER" && e.documentId) pvId = e.documentId;
  return { whtId, pvId };
}

/** แก้ในสมุดได้เฉพาะรายการมือที่ไม่ได้ผูกเอกสาร/รถ — ของอัตโนมัติให้แก้ที่ต้นทาง */
function cashbookEditableHere(e: CashbookEntry): boolean {
  if (isAutoCarryNoiseEntry(e) || e.isSystemAuto) return false;
  if (
    e.entryType === "DOCUMENT_AUTO" ||
    e.entryType === "VEHICLE_PURCHASE" ||
    e.entryType === "VEHICLE_SALE" ||
    e.entryType === "BALANCE_CARRY" ||
    e.entryType === "TRANSFER"
  ) {
    return false;
  }
  if (e.documentId || e.paymentVoucherDocumentId || e.withholdingDocumentId || e.vehicleId) {
    return false;
  }
  return true;
}

function accountIdFromEntry(e: CashbookEntry): string {
  if (e.bankAccountId) return e.bankAccountId;
  return CASH_ACCOUNT_ID;
}

const VAT_LABELS: Record<string, string> = {
  FULL_VAT: "VAT เต็ม",
  MARGIN_VAT: "VAT Margin ป.111",
  NO_VAT: "ไม่มี VAT",
};

export function CashbookClient({ userName = "" }: { userName?: string }) {
  const { isAdmin } = useAuth();
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
  const [cashOpening, setCashOpening] = useState(0);
  /** บัญชีที่ตัดเงิน — เงินสดหน้าร้าน หรือบัญชีจากการตั้งค่า */
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [vatType, setVatType] = useState<CashVatType>("NO_VAT");
  const [entities, setEntities] = useState<EntityRecord[]>([]);
  const [direction, setDirection] = useState<"IN" | "OUT">("OUT");
  const [expenseCategory, setExpenseCategory] = useState<VehicleCostCategory | "MISC">("PARTS");
  const [createPvNoBill, setCreatePvNoBill] = useState(false);
  const initialRange = defaultMonthRange();
  const [filterYear, setFilterYear] = useState(initialRange.year);
  const [filterMonthFrom, setFilterMonthFrom] = useState(initialRange.from);
  const [filterMonthTo, setFilterMonthTo] = useState(initialRange.to);
  /** "" = ทุกบัญชี, CASH_ACCOUNT_ID = เงินสดหน้าร้าน, หรือ id บัญชีจากตั้งค่า */
  const [filterAccountId, setFilterAccountId] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<CashbookEntry | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editAccountId, setEditAccountId] = useState(CASH_ACCOUNT_ID);
  const PAGE_SIZE = 20;

  const reload = useCallback(async () => {
    const data = await loadCashbookDashboard();
    setEntries(data.entries);
    setBanks(data.banks);
    setTotalIn(data.totalIn);
    setTotalOut(data.totalOut);
    setBalance(data.balance);
    setCashBalance(data.cashBalance);
    setBankBalances(data.bankBalances);
    setCashOpening(data.cashOpening ?? 0);
    setSelectedAccountId((prev) => prev || data.primary?.id || CASH_ACCOUNT_ID);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    void listEntitiesClient().then(setEntities);
  }, []);

  const partnerOptions = useMemo(() => {
    if (expenseCategory === "LABOR") {
      return entities.filter(
        (e) =>
          entityHasRoleGroup(e.roles, "CONTRACTOR") ||
          entityHasRoleGroup(e.roles, "SELLER_SUPPLIER"),
      );
    }
    if (expenseCategory === "PARTS" || expenseCategory === "REPAIR") {
      return entities.filter((e) => entityHasRoleGroup(e.roles, "SELLER_SUPPLIER"));
    }
    return entities;
  }, [entities, expenseCategory]);

  const primaryBank = banks.find((b) => b.isPrimary && b.kind !== "CASH")
    || banks.find((b) => b.kind !== "CASH")
    || banks[0];
  const primaryBalance = primaryBank
    ? sumBalanceForAccountNumber(banks, bankBalances, primaryBank.accountNumber)
    : 0;
  const cashPots = banks.filter((b) => b.kind === "CASH");
  const otherBanks = banks.filter(
    (b) => b.kind !== "CASH" && b.id !== primaryBank?.id,
  );

  const yearOptions = (() => {
    const years = new Set<number>([filterYear, nowParts().year]);
    for (const e of entries) {
      const y = Number(String(e.entryDate).slice(0, 4));
      if (Number.isFinite(y) && y >= 2000 && y <= 2100) years.add(y);
    }
    return [...years].sort((a, b) => b - a);
  })();

  const monthFrom = Math.min(filterMonthFrom, filterMonthTo);
  const monthTo = Math.max(filterMonthFrom, filterMonthTo);
  const filterStartYmd = `${filterYear}-${String(monthFrom).padStart(2, "0")}-01`;

  const filteredEntries = useMemo(() => {
    const primaryId = (banks.find((b) => b.isPrimary && b.kind !== "CASH") ||
      banks.find((b) => b.kind !== "CASH") ||
      banks[0])?.id;

    return entries
      .filter((e) => {
        if (isAutoCarryNoiseEntry(e)) return false;
        const d = String(e.entryDate ?? "");
        const y = Number(d.slice(0, 4));
        const m = Number(d.slice(5, 7));
        if (y !== filterYear) return false;
        if (!Number.isFinite(m) || m < monthFrom || m > monthTo) return false;
        if (!matchesAccountFilter(e, filterAccountId, banks, primaryId)) return false;
        return true;
      })
      .sort(
        (a, b) =>
          a.entryDate.localeCompare(b.entryDate) ||
          a.createdAt.localeCompare(b.createdAt) ||
          a.entryNo.localeCompare(b.entryNo),
      );
  }, [entries, filterYear, monthFrom, monthTo, filterAccountId, banks]);

  /** ยอดยกมาของช่วงที่เลือก (คำนวณ — ไม่ใช่รายการรับ/จ่าย) แบบ Saha ledger */
  const periodStartingBalance = useMemo(() => {
    const primaryId = (banks.find((b) => b.isPrimary && b.kind !== "CASH") ||
      banks.find((b) => b.kind !== "CASH") ||
      banks[0])?.id;
    if (filterAccountId) {
      return balanceForAccountBefore(
        entries.filter((e) => !isAutoCarryNoiseEntry(e)),
        banks,
        filterAccountId,
        filterStartYmd,
        cashOpening,
      );
    }
    // ทุกบัญชี: รวมยอดก่อนช่วงของทุกช่องทาง
    let sum = balanceForAccountBefore(
      entries.filter((e) => !isAutoCarryNoiseEntry(e)),
      banks,
      CASH_ACCOUNT_ID,
      filterStartYmd,
      cashOpening,
    );
    const seen = new Set<string>();
    for (const b of banks) {
      if (b.kind === "CASH") {
        sum = roundMoney2(
          sum +
            balanceForAccountBefore(
              entries.filter((e) => !isAutoCarryNoiseEntry(e)),
              banks,
              b.id,
              filterStartYmd,
              cashOpening,
            ),
        );
        continue;
      }
      const norm = normalizeAccountNumber(b.accountNumber);
      if (seen.has(norm)) continue;
      seen.add(norm);
      const group = resolveAccountGroupIds(b.id, banks);
      const canonical =
        banks.find((x) => group.includes(x.id) && x.isPrimary) ||
        banks.find((x) => group.includes(x.id)) ||
        b;
      sum = roundMoney2(
        sum +
          balanceForAccountBefore(
            entries.filter((e) => !isAutoCarryNoiseEntry(e)),
            banks,
            canonical.id,
            filterStartYmd,
            cashOpening,
          ),
      );
    }
    void primaryId;
    return sum;
  }, [entries, banks, filterAccountId, filterStartYmd, cashOpening]);

  /** คงเหลือสะสมต่อแถว (เมื่อเลือกบัญชีเดียว) */
  const runningBalanceById = useMemo(() => {
    const map = new Map<string, number>();
    if (!filterAccountId) return map;
    const asc = [...filteredEntries].sort(
      (a, b) =>
        a.entryDate.localeCompare(b.entryDate) ||
        a.createdAt.localeCompare(b.createdAt) ||
        a.entryNo.localeCompare(b.entryNo),
    );
    let bal = periodStartingBalance;
    for (const e of asc) {
      const amt = Number(e.amount) || 0;
      bal = roundMoney2(bal + (e.direction === "IN" ? amt : -amt));
      map.set(e.id, bal);
    }
    return map;
  }, [filteredEntries, filterAccountId, periodStartingBalance]);

  /** ยอดสุดท้ายของช่วง = ยอดยกไปเดือนถัดไป (เมื่อเลือกบัญชีเดียว) */
  const periodClosingBalance = useMemo(() => {
    if (!filterAccountId) return null;
    if (filteredEntries.length === 0) return periodStartingBalance;
    const last = filteredEntries[filteredEntries.length - 1];
    return runningBalanceById.get(last.id) ?? periodStartingBalance;
  }, [filterAccountId, filteredEntries, periodStartingBalance, runningBalanceById]);

  /** Cashflow ช่วงที่เลือก = เฉพาะรายการรับ/จ่ายจริง */
  const periodEntriesForTotals = filteredEntries;

  const totalPages = Math.max(1, Math.ceil(filteredEntries.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedEntries = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredEntries.slice(start, start + PAGE_SIZE);
  }, [filteredEntries, safePage, PAGE_SIZE]);

  useEffect(() => {
    setPage(1);
  }, [filterYear, filterMonthFrom, filterMonthTo, filterAccountId]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const monthsWithData = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of entries) {
      const d = String(e.entryDate ?? "");
      const y = Number(d.slice(0, 4));
      const m = Number(d.slice(5, 7));
      if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) continue;
      const key = `${y}-${m}`;
      map.set(key, (map.get(key) || 0) + 1);
    }
    return [...map.entries()]
      .map(([key, count]) => {
        const [y, m] = key.split("-").map(Number);
        return { year: y, month: m, count };
      })
      .sort((a, b) => b.year - a.year || b.month - a.month);
  }, [entries]);

  const monthBalances = useMemo(
    () => calcBalancesFromEntries(periodEntriesForTotals, banks, 0),
    [periodEntriesForTotals, banks],
  );

  const accountFilterOptions = useMemo(() => {
    const opts: { id: string; label: string }[] = [
      { id: "", label: "ทุกบัญชี" },
      { id: CASH_ACCOUNT_ID, label: "เงินสดหน้าร้าน" },
    ];
    for (const b of banks) {
      if (b.kind === "CASH") {
        opts.push({ id: b.id, label: `เงินสด · ${b.accountName}` });
      } else {
        opts.push({
          id: b.id,
          label: `${b.bankName} ${b.accountNumber}${b.isPrimary ? " · หลัก" : ""}`,
        });
      }
    }
    return opts;
  }, [banks]);

  const accountPickerOptions = useMemo(
    () => accountFilterOptions.filter((o) => o.id !== ""),
    [accountFilterOptions],
  );

  const filterPeriodLabel =
    monthFrom === monthTo
      ? `${monthLabel(monthFrom)} ${filterYear}`
      : `${monthLabel(monthFrom)}–${monthLabel(monthTo)} ${filterYear}`;

  const filterAccountLabel =
    accountFilterOptions.find((o) => o.id === filterAccountId)?.label ?? "ทุกบัญชี";

  function printDoc(documentId: string) {
    startTransition(async () => {
      const res = await printDocumentClient(documentId, userName);
      if (!res.ok) {
        setMsgOk(false);
        setMsg(res.message);
      }
    });
  }

  function onQuick(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const dir = (String(fd.get("direction") ?? direction) as "IN" | "OUT") || "OUT";
    const entryDate = String(fd.get("entryDate") ?? "") || new Date().toISOString().slice(0, 10);
    const amount = String(fd.get("amount") ?? "0");
    const description = String(fd.get("description") ?? "");
    const entityId = String(fd.get("entityId") ?? "").trim() || null;
    const billNo = String(fd.get("billNo") ?? "").trim();
    const entity = entityId ? entities.find((x) => x.id === entityId) || null : null;

    startTransition(async () => {
      let entryType: CashbookEntryType = "MANUAL";
      let withholdingDocumentId: string | null = null;
      let withholdingDocumentNumber: string | null = null;
      let paymentVoucherDocumentId: string | null = null;
      let paymentVoucherDocumentNumber: string | null = null;
      let cashOutAmount = Number(String(amount).replace(/,/g, "")) || 0;
      let withholdingAmount = 0;

      if (dir === "OUT" && (expenseCategory === "LABOR" || expenseCategory === "PARTS")) {
        if (expenseCategory === "LABOR" && !entity) {
          setMsgOk(false);
          setMsg("ค่าแรงต้องเลือกคู่ค้า");
          return;
        }
        if (expenseCategory === "PARTS" && !billNo && createPvNoBill && !entity) {
          setMsgOk(false);
          setMsg("ไม่มีเลขบิล — เลือกคู่ค้าเพื่อสร้างใบสำคัญจ่าย");
          return;
        }
        const docs = await createDocsForVehicleCostExpense({
          category: expenseCategory,
          amount,
          date: entryDate,
          description,
          entity,
          billNo,
          createPaymentVoucher: createPvNoBill,
          withholdingEnabled: expenseCategory === "LABOR",
          vehicleId: "",
          vehicleLabel: description || "รายจ่าย",
          issuedByName: userName,
          channel: channelForAccountId(selectedAccountId || CASH_ACCOUNT_ID, banks),
        });
        if (!docs.ok) {
          setMsgOk(false);
          setMsg(docs.message);
          return;
        }
        withholdingDocumentId = docs.withholdingDocumentId;
        withholdingDocumentNumber = docs.withholdingDocumentNumber;
        paymentVoucherDocumentId = docs.paymentVoucherDocumentId;
        paymentVoucherDocumentNumber = docs.paymentVoucherDocumentNumber;
        cashOutAmount = docs.cashOutAmount;
        withholdingAmount = docs.withholdingAmount;
        entryType = expenseCategory === "LABOR" ? "LABOR" : "PARTS";
      }

      const billHint = billNo ? ` บิล ${billNo}` : "";
      const whtHint =
        withholdingAmount > 0
          ? ` (หัก ณ ที่จ่าย ${withholdingAmount.toLocaleString("th-TH", { minimumFractionDigits: 2 })} · จ่ายสุทธิ ${cashOutAmount.toLocaleString("th-TH", { minimumFractionDigits: 2 })})`
          : "";
      const postChannel = channelForAccountId(selectedAccountId || CASH_ACCOUNT_ID, banks);
      const postBankId =
        !selectedAccountId || selectedAccountId === CASH_ACCOUNT_ID
          ? null
          : selectedAccountId;

      const res = await postCashbookEntryClient({
        entryDate,
        direction: dir,
        entryType,
        amount: cashOutAmount,
        description: `${description}${billHint}${whtHint}`,
        channel: postChannel,
        bankAccountId: postBankId,
        vatType,
        entityId,
        billNo: billNo || null,
        documentId: paymentVoucherDocumentId ?? withholdingDocumentId,
        documentKind: paymentVoucherDocumentId
          ? "PAYMENT_VOUCHER"
          : withholdingDocumentId
            ? "WITHHOLDING_TAX"
            : null,
        documentNumber: paymentVoucherDocumentNumber ?? withholdingDocumentNumber,
        withholdingDocumentId,
        withholdingDocumentNumber,
        paymentVoucherDocumentId,
        paymentVoucherDocumentNumber,
        createdByName: userName,
      });
      if (!res.ok) {
        setMsgOk(false);
        setMsg(res.message);
        return;
      }
      setMsgOk(true);
      const extra = [
        withholdingDocumentNumber && `หัก ${withholdingDocumentNumber}`,
        paymentVoucherDocumentNumber && `จ่าย ${paymentVoucherDocumentNumber}`,
        withholdingAmount > 0 &&
          `ตัดบัญชี ฿${cashOutAmount.toLocaleString("th-TH", { minimumFractionDigits: 2 })}`,
      ]
        .filter(Boolean)
        .join(" · ");
      setMsg(`บันทึกแล้ว (${res.entryNo})${extra ? ` — ${extra}` : ""} — ยอดบัญชีอัปเดตทันที`);
      form.reset();
      setDirection("OUT");
      setExpenseCategory("PARTS");
      setCreatePvNoBill(false);
      setShowQuick(false);
      await reload();
    });
  }

  function openEdit(e: CashbookEntry) {
    setEditing(e);
    setEditDate(e.entryDate);
    setEditAmount(e.amount);
    setEditAccountId(accountIdFromEntry(e));
  }

  function saveEdit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!editing) return;
    const pay = resolvePaymentAccount(editAccountId, banks);
    startTransition(async () => {
      const res = await updateCashbookEntryClient(editing.id, {
        entryDate: editDate,
        amount: editAmount,
        channel: pay.channel,
        bankAccountId: pay.bankAccountId,
      });
      if (!res.ok) {
        setMsgOk(false);
        setMsg(res.message);
        return;
      }
      setMsgOk(true);
      setMsg(`แก้ไข ${editing.entryNo} แล้ว — ยอดบัญชีอัปเดตแล้ว`);
      setEditing(null);
      await reload();
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">สมุดเงินสด & บัญชีธนาคาร</h1>
        <p className="mt-1 text-sm text-slate-600">
          ตัดเงินสด / บัญชีธนาคารตามช่องทางแต่ละรายการ — Cashflow รวมทุกบัญชี
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
          <p className="mt-1 text-[11px] text-slate-400">
            ยอดยกมาตั้งต้นบัญชี + รายการรับ/จ่ายจริง (ไม่นับยอดยกมาปลอม)
          </p>
          {otherBanks.length > 0 ? (
            <ul className="mt-2 space-y-1 border-t border-slate-100 pt-2">
              {otherBanks.map((b) => (
                <li
                  key={b.id}
                  className="flex items-baseline justify-between gap-2 text-xs text-slate-600"
                >
                  <span className="truncate">
                    {b.bankName} {b.accountNumber}
                  </span>
                  <span className="shrink-0 tabular-nums font-medium text-slate-800">
                    ฿{formatBaht(bankBalances[b.id] ?? 0)}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">เงินสดหน้าร้าน</p>
          <p className="mt-1 text-xl font-bold tabular-nums">฿{formatBaht(cashBalance)}</p>
          <p className="mt-1 text-[11px] text-slate-400">
            ยอดยกมาเงินสดตั้งต้น + รับ/จ่ายช่องทางนี้
          </p>
          {cashPots.length > 0 ? (
            <ul className="mt-2 space-y-1 border-t border-slate-100 pt-2">
              {cashPots.map((b) => (
                <li
                  key={b.id}
                  className="flex items-baseline justify-between gap-2 text-xs text-slate-600"
                >
                  <span className="truncate">เงินสด · {b.accountName}</span>
                  <span className="shrink-0 tabular-nums font-medium text-slate-800">
                    ฿{formatBaht(bankBalances[b.id] ?? 0)}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Cashflow ({filterPeriodLabel})</p>
          <p className="mt-0.5 text-[11px] text-slate-400">
            รับ/จ่ายจริงในช่วงที่เลือก · ยอดยกมาแถวแรกในตารางไม่นับซ้ำ
          </p>
          <p className="mt-1 text-xl font-bold tabular-nums text-emerald-700">
            รับ ฿{formatBaht(monthBalances.totalIn)}
          </p>
          <p className="text-sm tabular-nums text-red-600">
            จ่าย ฿{formatBaht(monthBalances.totalOut)}
          </p>
          <p className="mt-1 text-lg font-bold tabular-nums">
            สุทธิ ฿{formatBaht(monthBalances.balance)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            ทั้งระบบ: รับ ฿{formatBaht(totalIn)} · จ่าย ฿{formatBaht(totalOut)} · สุทธิ ฿
            {formatBaht(balance)}
          </p>
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
            <span className="mb-1 block text-slate-600">เริ่มต้นเดือน</span>
            <select
              className={`${inp} min-w-[9rem]`}
              value={filterMonthFrom}
              onChange={(e) => {
                const v = Number(e.target.value);
                setFilterMonthFrom(v);
                if (v > filterMonthTo) setFilterMonthTo(v);
              }}
            >
              {MONTH_OPTIONS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">สิ้นสุดเดือน</span>
            <select
              className={`${inp} min-w-[9rem]`}
              value={filterMonthTo}
              onChange={(e) => {
                const v = Number(e.target.value);
                setFilterMonthTo(v);
                if (v < filterMonthFrom) setFilterMonthFrom(v);
              }}
            >
              {MONTH_OPTIONS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">บัญชี</span>
            <select
              className={`${inp} min-w-[14rem]`}
              value={filterAccountId}
              onChange={(e) => setFilterAccountId(e.target.value)}
            >
              {accountFilterOptions.map((o) => (
                <option key={o.id || "all"} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <div className="pb-2 text-xs text-slate-500">
            <p>
              แสดง {filteredEntries.length} รายการ ({filterPeriodLabel}
              {filterAccountId ? ` · ${filterAccountLabel}` : ""})
              {filteredEntries.length > PAGE_SIZE
                ? ` · หน้า ${safePage}/${totalPages}`
                : ""}
            </p>
            {monthsWithData.length > 0 && (
              <p className="mt-1">
                มีข้อมูล:{" "}
                {monthsWithData.slice(0, 6).map((row, i) => {
                  const inRange =
                    row.year === filterYear &&
                    row.month >= monthFrom &&
                    row.month <= monthTo;
                  return (
                    <span key={`${row.year}-${row.month}`}>
                      {i > 0 ? " · " : ""}
                      <button
                        type="button"
                        className={
                          inRange
                            ? "font-semibold text-slate-800 underline"
                            : "text-blue-700 hover:underline"
                        }
                        onClick={() => {
                          setFilterYear(row.year);
                          setFilterMonthFrom(row.month);
                          setFilterMonthTo(row.month);
                        }}
                      >
                        {monthLabel(row.month)} {row.year} ({row.count})
                      </button>
                    </span>
                  );
                })}
              </p>
            )}
          </div>
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
              <select
                name="direction"
                className={inp}
                value={direction}
                onChange={(e) => setDirection(e.target.value as "IN" | "OUT")}
              >
                <option value="OUT">จ่ายออก</option>
                <option value="IN">รับเข้า</option>
              </select>
            </label>
            {direction === "OUT" && (
              <label className="text-sm">
                <span className="mb-1 block text-slate-600">ประเภทจ่าย</span>
                <select
                  className={inp}
                  value={expenseCategory}
                  onChange={(e) => {
                    setExpenseCategory(e.target.value as VehicleCostCategory | "MISC");
                    setCreatePvNoBill(false);
                  }}
                >
                  <option value="PARTS">อะไหล่/สินค้า</option>
                  <option value="LABOR">ค่าแรง</option>
                  <option value="MISC">อื่นๆ</option>
                </select>
              </label>
            )}
            {direction === "OUT" && expenseCategory !== "MISC" && (
              <label className="text-sm">
                <span className="mb-1 block text-slate-600">
                  คู่ค้า {expenseCategory === "LABOR" ? "*" : ""}
                </span>
                <select
                  name="entityId"
                  className={inp}
                  required={expenseCategory === "LABOR" || createPvNoBill}
                  defaultValue=""
                  key={`${expenseCategory}-${createPvNoBill}`}
                >
                  <option value="">— เลือกคู่ค้า —</option>
                  {partnerOptions.map((ent) => (
                    <option key={ent.id} value={ent.id}>
                      {ent.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {direction === "OUT" && expenseCategory === "PARTS" && (
              <>
                <label className="text-sm">
                  <span className="mb-1 block text-slate-600">เลขที่บิล</span>
                  <input
                    name="billNo"
                    className={inp}
                    placeholder="เช่น INV-001"
                    disabled={createPvNoBill}
                  />
                </label>
                <label className="flex items-end gap-2 pb-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={createPvNoBill}
                    onChange={(e) => setCreatePvNoBill(e.target.checked)}
                  />
                  ไม่มีบิล — สร้างใบสำคัญจ่าย
                </label>
              </>
            )}
            {direction === "OUT" && expenseCategory === "LABOR" && (
              <p className="text-xs text-slate-600 sm:col-span-2 lg:col-span-4">
                จะสร้างใบสำคัญจ่าย (+ ใบหัก ณ ที่จ่ายอัตโนมัติ)
              </p>
            )}
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">บัญชี / ช่องทาง</span>
              <select
                className={inp}
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                required
              >
                {accountPickerOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
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

      {editing ? (
        <form
          onSubmit={saveEdit}
          className="space-y-3 rounded-lg border border-amber-200 bg-amber-50/50 p-4 shadow-sm"
        >
          <p className="text-sm font-medium text-slate-800">
            แก้ไข {editing.entryNo}
            <span className="ml-2 font-normal text-slate-500">{editing.description}</span>
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">วันที่</span>
              <input
                type="date"
                className={inp}
                required
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">จำนวนเงิน</span>
              <input
                className={inp}
                required
                inputMode="decimal"
                value={editAmount}
                onChange={(e) => setEditAmount(e.target.value)}
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">บัญชีที่ตัด</span>
              <select
                className={inp}
                value={editAccountId}
                onChange={(e) => setEditAccountId(e.target.value)}
              >
                {accountPickerOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              บันทึกการแก้ไข
            </button>
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm"
            >
              ยกเลิก
            </button>
          </div>
        </form>
      ) : null}

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
              <th className="px-3 py-2 text-right">คงเหลือสะสม</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {filterAccountId && safePage === 1 ? (
              <tr className="border-b border-slate-100 bg-slate-50/80 italic">
                <td colSpan={8} className="px-3 py-2 text-slate-700">
                  ยอดยกมา
                  <span className="ml-2 rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold not-italic uppercase tracking-wide text-sky-800">
                    auto
                  </span>
                  <span className="ml-2 text-[11px] not-italic text-slate-400">
                    ก่อนรายการแรกในช่วงนี้ — ไม่ใช่รายการรับ/จ่าย
                  </span>
                </td>
                <td className="px-3 py-2 text-right tabular-nums font-semibold text-slate-900">
                  ฿{formatBaht(periodStartingBalance)}
                </td>
                <td />
              </tr>
            ) : null}
            {filteredEntries.length === 0 && (
              <tr>
                <td colSpan={10} className="px-3 py-8 text-center text-slate-500">
                  {entries.length === 0 ? (
                    "ยังไม่มีรายการ — ออกใบเสร็จ/ใบสำคัญจ่าย หรือบันทึกรายการด่วน"
                  ) : (
                    <span>
                      ไม่พบรายการในช่วงที่เลือก — ลองเปลี่ยนเดือนหรือบัญชีด้านบน
                      {monthsWithData[0] && (
                        <>
                          {" "}
                          หรือไปที่{" "}
                          <button
                            type="button"
                            className="text-blue-700 hover:underline"
                            onClick={() => {
                              setFilterYear(monthsWithData[0].year);
                              setFilterMonthFrom(monthsWithData[0].month);
                              setFilterMonthTo(monthsWithData[0].month);
                              setFilterAccountId("");
                            }}
                          >
                            {monthLabel(monthsWithData[0].month)} {monthsWithData[0].year}
                          </button>
                        </>
                      )}
                    </span>
                  )}
                </td>
              </tr>
            )}
            {pagedEntries.map((e) => {
              const amt = Number(e.amount) || 0;
              const bank = banks.find((b) => b.id === e.bankAccountId);
              const channelLabel =
                e.channel === "BANK"
                  ? bank
                    ? `${bank.bankName} ${bank.accountNumber}`
                    : "ธนาคาร"
                  : bank?.kind === "CASH"
                    ? `เงินสด · ${bank.accountName}`
                    : "เงินสดหน้าร้าน";
              const runBal = runningBalanceById.get(e.id);
              return (
                <tr key={e.id} className="border-b border-slate-100">
                  <td className="px-3 py-2 font-mono text-xs">{e.entryNo}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{formatDateThBE(e.entryDate)}</td>
                  <td className="px-3 py-2 text-xs">{channelLabel}</td>
                  <td className="px-3 py-2 text-xs">
                    {TYPE_LABELS[e.entryType] ?? e.entryType}
                  </td>
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
                  <td className="px-3 py-2 text-right tabular-nums font-medium text-slate-800">
                    {filterAccountId && runBal != null ? `฿${formatBaht(runBal)}` : "—"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {(() => {
                      const { whtId, pvId } = cashbookPrintTargets(e);
                      return (
                        <div className="flex flex-wrap items-center justify-end gap-1">
                          {whtId && (
                            <PrintDocIconButton
                              label="หัก"
                              disabled={pending}
                              onClick={() => printDoc(whtId)}
                            />
                          )}
                          {pvId && (
                            <PrintDocIconButton
                              label="จ่าย"
                              disabled={pending}
                              onClick={() => printDoc(pvId)}
                            />
                          )}
                          {isAdmin && cashbookEditableHere(e) ? (
                            <button
                              type="button"
                              className="text-blue-700 hover:underline disabled:opacity-50"
                              disabled={pending}
                              onClick={() => openEdit(e)}
                            >
                              แก้ไข
                            </button>
                          ) : isAdmin &&
                            (e.documentId ||
                              e.vehicleId ||
                              e.entryType === "DOCUMENT_AUTO" ||
                              e.entryType === "VEHICLE_PURCHASE" ||
                              e.entryType === "VEHICLE_SALE") ? (
                            <span
                              className="text-[11px] text-slate-400"
                              title="รายการนี้คำนวณจากเอกสารหรือรถ — แก้ที่ยอดต้นทาง"
                            >
                              แก้ที่เอกสาร
                            </span>
                          ) : null}
                          {isAdmin && (
                            <button
                              type="button"
                              className="text-red-600 hover:underline disabled:opacity-50"
                              disabled={pending}
                              onClick={() => {
                                if (!confirm(`ลบรายการ ${e.entryNo}?\n${e.description}`)) return;
                                startTransition(async () => {
                                  const res = await deleteCashbookEntryClient(e.id);
                                  if (!res.ok) {
                                    setMsgOk(false);
                                    setMsg(res.message);
                                    return;
                                  }
                                  setMsgOk(true);
                                  setMsg(`ลบ ${e.entryNo} แล้ว`);
                                  await reload();
                                });
                              }}
                            >
                              ลบ
                            </button>
                          )}
                        </div>
                      );
                    })()}
                  </td>
                </tr>
              );
            })}
            {filterAccountId && safePage === totalPages ? (
              <tr className="border-t-2 border-slate-300 bg-emerald-50/60 font-semibold">
                <td colSpan={8} className="px-3 py-2 text-slate-800">
                  คงเหลือยกไป
                  <span className="ml-2 rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-800">
                    auto
                  </span>
                  <span className="ml-2 text-[11px] font-normal text-slate-500">
                    ยอดนี้คือยอดยกมาของเดือนถัดไป
                  </span>
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-900">
                  ฿{formatBaht(periodClosingBalance ?? 0)}
                </td>
                <td />
              </tr>
            ) : null}
          </tbody>
        </table>
        {filteredEntries.length > PAGE_SIZE && (
          <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-3 py-2">
            <span className="mr-2 text-xs text-slate-500">
              {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filteredEntries.length)}{" "}
              จาก {filteredEntries.length}
            </span>
            <button
              type="button"
              aria-label="หน้าก่อน"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex h-8 w-8 items-center justify-center rounded border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ←
            </button>
            <span className="min-w-[3.5rem] text-center text-xs tabular-nums text-slate-600">
              {safePage}/{totalPages}
            </span>
            <button
              type="button"
              aria-label="หน้าถัดไป"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="inline-flex h-8 w-8 items-center justify-center rounded border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              →
            </button>
          </div>
        )}
      </div>
      <p className="text-xs text-slate-500">
        ตั้งค่าบัญชีธนาคารได้ที่เมนู <a className="text-blue-800 underline" href="/settings/bank-accounts">ตั้งค่าบัญชีธนาคาร</a>
      </p>
    </div>
  );
}
