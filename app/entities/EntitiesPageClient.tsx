"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import {
  deleteEntityClient,
  listEntitiesClient,
  saveEntityClient,
} from "@/lib/entities-client";
import type { EntityKind, EntityRecord, EntityRole } from "@/lib/domain-types";
import {
  displayEntityRoleLabels,
  ENTITY_ROLE_GROUPS,
  entityHasRoleGroup,
  toggleEntityRoleGroup,
  type EntityRoleGroupId,
} from "@/lib/entity-roles";

const inp =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

const DEFAULT_ROLES: EntityRole[] = ["CUSTOMER", "BUYER"];

type KindFilter = "ALL" | EntityKind;
type RoleFilter = "ALL" | EntityRoleGroupId;

export function EntitiesPageClient({ entities: initial = [] }: { entities?: EntityRecord[] }) {
  const [pending, startTransition] = useTransition();
  const [entities, setEntities] = useState<EntityRecord[]>(initial);
  const [editing, setEditing] = useState<EntityRecord | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [msgOk, setMsgOk] = useState(true);
  const [kindFilter, setKindFilter] = useState<KindFilter>("ALL");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("ALL");
  const [search, setSearch] = useState("");

  const [name, setName] = useState("");
  const [entityKind, setEntityKind] = useState<EntityKind>("INDIVIDUAL");
  const [roles, setRoles] = useState<EntityRole[]>(DEFAULT_ROLES);
  const [taxId, setTaxId] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [defaultWhtPercent, setDefaultWhtPercent] = useState("3");
  const [notes, setNotes] = useState("");

  const reload = useCallback(async () => {
    const rows = await listEntitiesClient();
    setEntities(rows);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entities.filter((e) => {
      if (kindFilter !== "ALL" && e.entityKind !== kindFilter) return false;
      if (roleFilter !== "ALL" && !entityHasRoleGroup(e.roles, roleFilter)) return false;
      if (!q) return true;
      const hay = [e.name, e.code, e.taxId, e.phone, e.email, e.address, ...displayEntityRoleLabels(e.roles)]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [entities, kindFilter, roleFilter, search]);

  function openNew() {
    setEditing(null);
    setName("");
    setEntityKind("INDIVIDUAL");
    setRoles(DEFAULT_ROLES);
    setTaxId("");
    setAddress("");
    setPhone("");
    setEmail("");
    setBankName("");
    setBankAccount("");
    setDefaultWhtPercent("3");
    setNotes("");
    setShowForm(true);
    setMsg(null);
  }

  function openEdit(e: EntityRecord) {
    setEditing(e);
    setName(e.name);
    setEntityKind(e.entityKind);
    setRoles(e.roles?.length ? e.roles : DEFAULT_ROLES);
    setTaxId(e.taxId);
    setAddress(e.address);
    setPhone(e.phone);
    setEmail(e.email);
    setBankName(e.bankName);
    setBankAccount(e.bankAccount);
    setDefaultWhtPercent(e.defaultWhtPercent);
    setNotes(e.notes);
    setShowForm(true);
    setMsg(null);
  }

  function toggleRoleGroup(groupId: EntityRoleGroupId) {
    setRoles((prev) => toggleEntityRoleGroup(prev, groupId));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (roles.length === 0) {
      setMsgOk(false);
      setMsg("เลือกบทบาทอย่างน้อย 1 รายการ");
      return;
    }
    startTransition(async () => {
      const res = await saveEntityClient(editing?.id ?? null, {
        name,
        entityKind,
        roles,
        taxId,
        address,
        phone,
        email,
        branchHeadOffice: true,
        branchNo: "",
        bankName,
        bankAccount,
        defaultWhtPercent,
        notes,
      });
      if (!res.ok) {
        setMsgOk(false);
        setMsg(res.message);
        return;
      }
      await reload();
      setShowForm(false);
      setMsgOk(true);
      setMsg("บันทึกแล้ว");
    });
  }

  function chipClass(active: boolean) {
    return active
      ? "rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white"
      : "rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50";
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">จัดการคู่ค้า</h1>
          <p className="mt-1 text-sm text-slate-600">
            รวมลูกค้า/ผู้ซื้อ ผู้ขาย/ซัพพลายเออร์ ผู้รับจ้าง และผู้ว่าจ้างไว้ที่เดียว
          </p>
        </div>
        <button
          type="button"
          onClick={openNew}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          + เพิ่มรายการ
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

      <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-500">ประเภทนิติบุคคล</span>
          {(
            [
              ["ALL", "ทั้งหมด"],
              ["INDIVIDUAL", "บุคคลธรรมดา"],
              ["COMPANY", "นิติบุคคล"],
            ] as const
          ).map(([k, label]) => (
            <button key={k} type="button" onClick={() => setKindFilter(k)} className={chipClass(kindFilter === k)}>
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-500">บทบาท</span>
          <button type="button" onClick={() => setRoleFilter("ALL")} className={chipClass(roleFilter === "ALL")}>
            ทุกบทบาท
          </button>
          {ENTITY_ROLE_GROUPS.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => setRoleFilter(g.id)}
              className={chipClass(roleFilter === g.id)}
            >
              {g.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหาชื่อ / โทร / เลขภาษี…"
            className="w-full max-w-sm rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <p className="text-sm text-slate-500">
            แสดง {filtered.length} จาก {entities.length} รายการ
          </p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="border-b bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-3 py-2">รหัส</th>
              <th className="px-3 py-2">ชื่อ</th>
              <th className="px-3 py-2">ประเภท</th>
              <th className="px-3 py-2">บทบาท</th>
              <th className="px-3 py-2">เลขภาษี</th>
              <th className="px-3 py-2">โทร</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-10 text-center text-slate-500">
                  {entities.length === 0
                    ? "ยังไม่มีข้อมูล — กดเพิ่มรายการ"
                    : "ไม่พบรายการตามตัวกรอง — ลองเปลี่ยนฟิลเตอร์"}
                </td>
              </tr>
            )}
            {filtered.map((e) => (
              <tr key={e.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-3 py-2 font-mono text-xs">{e.code}</td>
                <td className="px-3 py-2">
                  <p className="font-medium text-slate-900">{e.name}</p>
                  {e.address && <p className="line-clamp-1 text-xs text-slate-500">{e.address}</p>}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {e.entityKind === "COMPANY" ? "นิติบุคคล" : "บุคคลธรรมดา"}
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {(() => {
                      const labels = displayEntityRoleLabels(e.roles);
                      if (labels.length === 0) return <span className="text-slate-400">—</span>;
                      return labels.map((label) => (
                        <span
                          key={label}
                          className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
                        >
                          {label}
                        </span>
                      ));
                    })()}
                  </div>
                </td>
                <td className="px-3 py-2 font-mono text-xs">{e.taxId || "—"}</td>
                <td className="px-3 py-2 whitespace-nowrap">{e.phone || "—"}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <button type="button" className="text-blue-700 hover:underline" onClick={() => openEdit(e)}>
                    แก้ไข
                  </button>
                  <button
                    type="button"
                    className="ml-3 text-red-600 hover:underline"
                    disabled={pending}
                    onClick={() => {
                      if (!confirm("ลบรายการนี้?")) return;
                      startTransition(async () => {
                        const res = await deleteEntityClient(e.id);
                        if (!res.ok) {
                          setMsgOk(false);
                          setMsg(res.message);
                          return;
                        }
                        await reload();
                        setMsgOk(true);
                        setMsg("ลบแล้ว");
                      });
                    }}
                  >
                    ลบ
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <form onSubmit={onSubmit} className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-slate-900">{editing ? "แก้ไขคู่ค้า" : "เพิ่มคู่ค้าใหม่"}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block text-slate-600">ชื่อ / ชื่อบริษัท *</span>
              <input className={inp} value={name} onChange={(e) => setName(e.target.value)} required />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-slate-600">ประเภท</span>
              <select
                className={inp}
                value={entityKind}
                onChange={(e) => setEntityKind(e.target.value as EntityKind)}
              >
                <option value="INDIVIDUAL">บุคคลธรรมดา</option>
                <option value="COMPANY">นิติบุคคล / บริษัท</option>
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-slate-600">เลขผู้เสียภาษี / บัตรประชาชน</span>
              <input className={inp} value={taxId} onChange={(e) => setTaxId(e.target.value)} />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-slate-600">โทรศัพท์</span>
              <input className={inp} value={phone} onChange={(e) => setPhone(e.target.value)} />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block text-slate-600">ที่อยู่</span>
              <textarea className={inp} rows={2} value={address} onChange={(e) => setAddress(e.target.value)} />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-slate-600">อีเมล</span>
              <input className={inp} value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-slate-600">อัตราหัก ณ ที่จ่าย (%)</span>
              <input className={inp} value={defaultWhtPercent} onChange={(e) => setDefaultWhtPercent(e.target.value)} />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-slate-600">ธนาคาร</span>
              <input className={inp} value={bankName} onChange={(e) => setBankName(e.target.value)} />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-slate-600">เลขบัญชี</span>
              <input className={inp} value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} />
            </label>
          </div>
          <div>
            <p className="mb-2 text-sm text-slate-600">บทบาท *</p>
            <div className="flex flex-wrap gap-3">
              {ENTITY_ROLE_GROUPS.map((g) => (
                <label key={g.id} className="flex items-center gap-1.5 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={entityHasRoleGroup(roles, g.id)}
                    onChange={() => toggleRoleGroup(g.id)}
                  />
                  {g.label}
                </label>
              ))}
            </div>
          </div>
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">หมายเหตุ</span>
            <textarea className={inp} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {pending ? "กำลังบันทึก…" : "บันทึก"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700"
            >
              ยกเลิก
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
