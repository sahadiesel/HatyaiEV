"use client";

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import type { AppRoleDefinition, MenuAccessLevel, MenuId } from "./menu-access";
import { emptyMenuAccess } from "./menu-access";
import { getFirestoreDb } from "./firebase";

export const appRolesCollection = "appRoles";

function parseRole(id: string, data: Record<string, unknown>): AppRoleDefinition {
  const menusRaw = (data.menus ?? {}) as Record<string, string>;
  const menus: Partial<Record<MenuId, MenuAccessLevel>> = {};
  for (const [key, val] of Object.entries(menusRaw)) {
    if (val === "view" || val === "edit" || val === "none") {
      menus[key as MenuId] = val;
    }
  }
  return {
    id,
    name: String(data.name ?? ""),
    menus,
    updatedAt: data.updatedAt,
  };
}

export async function listAppRoles(): Promise<AppRoleDefinition[]> {
  const db = getFirestoreDb();
  if (!db) return [];
  try {
    const snap = await getDocs(collection(db, appRolesCollection));
    return snap.docs
      .map((d) => parseRole(d.id, d.data() as Record<string, unknown>))
      .sort((a, b) => a.name.localeCompare(b.name, "th"));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("permission") || msg.includes("Permission")) {
      throw new Error(
        "ไม่มีสิทธิ์อ่านบทบาท — รัน firebase deploy --only firestore:rules แล้วรีเฟรชหน้า",
      );
    }
    throw e;
  }
}

export async function getAppRole(roleId: string): Promise<AppRoleDefinition | null> {
  const db = getFirestoreDb();
  if (!db || !roleId) return null;
  const snap = await getDoc(doc(db, appRolesCollection, roleId));
  if (!snap.exists()) return null;
  return parseRole(snap.id, snap.data() as Record<string, unknown>);
}

export async function createAppRole(
  name: string,
  menus: Partial<Record<MenuId, MenuAccessLevel>>,
): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const db = getFirestoreDb();
  if (!db) return { ok: false, message: "ยังไม่ได้ตั้งค่า Firebase" };
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, message: "กรอกชื่อบทบาท" };

  try {
    const ref = await addDoc(collection(db, appRolesCollection), {
      name: trimmed,
      menus,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { ok: true, id: ref.id };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

export async function updateAppRole(
  roleId: string,
  name: string,
  menus: Partial<Record<MenuId, MenuAccessLevel>>,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const db = getFirestoreDb();
  if (!db) return { ok: false, message: "ยังไม่ได้ตั้งค่า Firebase" };
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, message: "กรอกชื่อบทบาท" };

  try {
    await updateDoc(doc(db, appRolesCollection, roleId), {
      name: trimmed,
      menus,
      updatedAt: serverTimestamp(),
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

export async function deleteAppRole(roleId: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const db = getFirestoreDb();
  if (!db) return { ok: false, message: "ยังไม่ได้ตั้งค่า Firebase" };
  try {
    await deleteDoc(doc(db, appRolesCollection, roleId));
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

/** สร้างบทบาทเริ่มต้นถ้ายังไม่มีเลย */
export async function ensureDefaultAppRole(): Promise<void> {
  const db = getFirestoreDb();
  if (!db) return;
  try {
    const snap = await getDocs(collection(db, appRolesCollection));
    if (!snap.empty) return;

    const menus = emptyMenuAccess();
    menus.clients = "view";
    menus.contractors = "view";
    menus.contracts = "view";
    menus.documents = "view";

    await setDoc(doc(db, appRolesCollection, "default-staff"), {
      name: "พนักงานทั่วไป (ดูอย่างเดียว)",
      menus,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch {
    /* ข้ามถ้ายังไม่มีสิทธิ์ — admin สร้างบทบาทเองได้ */
  }
}
