"use client";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import type { AdminUserProfileUpdate, AppPermissionId, UserProfile, UserRole } from "./auth-utils";
import { nationalIdToAuthEmail, normalizeNationalId } from "./auth-utils";
import { getFirestoreDb } from "./firebase";

export const usersCollection = "users";
export const metaCollection = "meta";
export const metaAppDocId = "app";

export const nationalIdIndexCollection = "nationalIdIndex";

export type RegisterProfileInput = {
  nationalId: string;
  name: string;
  address: string;
  phone: string;
  recoveryEmail: string;
};

function docToUserProfile(uid: string, data: Record<string, unknown>): UserProfile {
  return {
    uid,
    nationalId: String(data.nationalId ?? ""),
    name: String(data.name ?? ""),
    address: String(data.address ?? ""),
    phone: String(data.phone ?? ""),
    role: (data.role === "admin" ? "admin" : "user") as UserRole,
    approved: Boolean(data.approved),
    appRoleId: String(data.appRoleId ?? ""),
    permissions: Array.isArray(data.permissions) ? (data.permissions as AppPermissionId[]) : [],
    recoveryEmail: String(data.recoveryEmail ?? ""),
    rejected: Boolean(data.rejected),
    createdAt: data.createdAt,
  };
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const db = getFirestoreDb();
  if (!db) return null;
  const snap = await getDoc(doc(db, usersCollection, uid));
  if (!snap.exists()) return null;
  return docToUserProfile(uid, snap.data() as Record<string, unknown>);
}

/** รายชื่อผู้ใช้ทั้งหมด (admin) */
export async function listAllUsers(): Promise<UserProfile[]> {
  const db = getFirestoreDb();
  if (!db) return [];
  const snap = await getDocs(collection(db, usersCollection));
  return snap.docs
    .map((d) => docToUserProfile(d.id, d.data() as Record<string, unknown>))
    .sort((a, b) => a.name.localeCompare(b.name, "th"));
}

export async function updateUserProfileByAdmin(
  uid: string,
  input: AdminUserProfileUpdate,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const db = getFirestoreDb();
  if (!db) return { ok: false, message: "ยังไม่ได้ตั้งค่า Firebase" };

  const name = input.name.trim();
  if (!name) return { ok: false, message: "กรอกชื่อ-นามสกุล" };

  const recoveryEmail = input.recoveryEmail.trim().toLowerCase();
  if (!recoveryEmail) return { ok: false, message: "กรอกอีเมลสำรอง" };

  try {
    const userRef = doc(db, usersCollection, uid);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) return { ok: false, message: "ไม่พบผู้ใช้" };

    const nationalId = String(userSnap.data().nationalId ?? "");

    await updateDoc(userRef, {
      name,
      address: input.address.trim(),
      phone: input.phone.trim(),
      recoveryEmail,
    });

    if (nationalId.length === 13) {
      const indexRef = doc(db, nationalIdIndexCollection, nationalId);
      const indexSnap = await getDoc(indexRef);
      if (indexSnap.exists()) {
        await updateDoc(indexRef, { recoveryEmail });
      }
    }

    return { ok: true };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

export async function isNationalIdTaken(nationalId: string): Promise<boolean> {
  const db = getFirestoreDb();
  if (!db) return false;
  const nid = normalizeNationalId(nationalId);
  const snap = await getDoc(doc(db, nationalIdIndexCollection, nid));
  return snap.exists();
}

/** สร้างโปรไฟล์หลังสมัคร — คนแรกเป็น admin อัตโนมัติ */
export async function createUserProfileAfterRegister(
  uid: string,
  input: RegisterProfileInput,
): Promise<{ ok: true; role: UserRole; approved: boolean } | { ok: false; message: string }> {
  const db = getFirestoreDb();
  if (!db) return { ok: false, message: "ยังไม่ได้ตั้งค่า Firebase" };

  const nationalId = normalizeNationalId(input.nationalId);
  if (nationalId.length !== 13) {
    return { ok: false, message: "เลขบัตรประชาชนต้องมี 13 หลัก" };
  }

  try {
    const role = await runTransaction(db, async (tx) => {
      const metaRef = doc(db, metaCollection, metaAppDocId);
      const userRef = doc(db, usersCollection, uid);
      const metaSnap = await tx.get(metaRef);

      const isFirst = !metaSnap.exists() || !metaSnap.data()?.bootstrapComplete;
      const assignedRole: UserRole = isFirst ? "admin" : "user";
      const approved = isFirst;

      const authEmail = nationalIdToAuthEmail(nationalId);
      const recoveryEmail = input.recoveryEmail.trim().toLowerCase();

      tx.set(userRef, {
        nationalId,
        name: input.name.trim(),
        address: input.address.trim(),
        phone: input.phone.trim(),
        authEmail,
        recoveryEmail,
        role: assignedRole,
        approved,
        permissions: [],
        appRoleId: "",
        createdAt: serverTimestamp(),
      });

      tx.set(doc(db, nationalIdIndexCollection, nationalId), {
        uid,
        authEmail,
        recoveryEmail,
      });

      if (isFirst) {
        tx.set(metaRef, {
          bootstrapComplete: true,
          firstAdminUid: uid,
          createdAt: serverTimestamp(),
        });
      }

      return assignedRole;
    });

    return { ok: true, role, approved: role === "admin" };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, message };
  }
}

export async function listPendingUsers(): Promise<UserProfile[]> {
  const db = getFirestoreDb();
  if (!db) return [];
  const q = query(collection(db, usersCollection), where("approved", "==", false));
  const snap = await getDocs(q);
  return snap.docs
    .filter((d) => !d.data().rejected)
    .map((d) => docToUserProfile(d.id, d.data() as Record<string, unknown>));
}

export async function listApprovedUsers(): Promise<UserProfile[]> {
  const db = getFirestoreDb();
  if (!db) return [];
  const q = query(collection(db, usersCollection), where("approved", "==", true));
  const snap = await getDocs(q);
  return snap.docs.map((d) => docToUserProfile(d.id, d.data() as Record<string, unknown>));
}

export async function approveUser(uid: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const db = getFirestoreDb();
  if (!db) return { ok: false, message: "ยังไม่ได้ตั้งค่า Firebase" };
  try {
    await updateDoc(doc(db, usersCollection, uid), {
      approved: true,
      permissions: [],
      appRoleId: "default-staff",
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

export async function rejectUser(uid: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const db = getFirestoreDb();
  if (!db) return { ok: false, message: "ยังไม่ได้ตั้งค่า Firebase" };
  try {
    await updateDoc(doc(db, usersCollection, uid), {
      approved: false,
      rejected: true,
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

export async function updateUserAppRoleId(
  uid: string,
  appRoleId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const db = getFirestoreDb();
  if (!db) return { ok: false, message: "ยังไม่ได้ตั้งค่า Firebase" };
  try {
    await updateDoc(doc(db, usersCollection, uid), { appRoleId: appRoleId || "" });
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

/** อีเมลสำหรับส่งลิงก์รีเซ็ตรหัสผ่าน (อ่านได้โดยไม่ต้อง login) */
export async function findRecoveryEmailByNationalId(nationalId: string): Promise<string | null> {
  const db = getFirestoreDb();
  if (!db) return null;
  const nid = normalizeNationalId(nationalId);
  const snap = await getDoc(doc(db, nationalIdIndexCollection, nid));
  if (!snap.exists()) return null;
  const recoveryEmail = snap.data().recoveryEmail;
  return typeof recoveryEmail === "string" && recoveryEmail ? recoveryEmail : null;
}
