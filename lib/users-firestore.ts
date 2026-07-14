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
import { isValidEmail, normalizeEmail, normalizeNationalId } from "./auth-utils";
import { getFirestoreDb } from "./firebase";

export const usersCollection = "users";
export const metaCollection = "meta";
export const metaAppDocId = "app";

/** index อีเมล → uid (สำหรับเช็คซ้ำ / กู้รหัส) */
export const emailIndexCollection = "emailIndex";
/** คงไว้เพื่อข้อมูลเก่า */
export const nationalIdIndexCollection = "nationalIdIndex";

export type RegisterProfileInput = {
  email: string;
  name: string;
  address: string;
  phone: string;
  nationalId?: string;
};

function docToUserProfile(uid: string, data: Record<string, unknown>): UserProfile {
  const email = String(data.email ?? data.authEmail ?? data.recoveryEmail ?? "");
  return {
    uid,
    email,
    nationalId: String(data.nationalId ?? ""),
    name: String(data.name ?? ""),
    address: String(data.address ?? ""),
    phone: String(data.phone ?? ""),
    role: (data.role === "admin" ? "admin" : "user") as UserRole,
    approved: Boolean(data.approved),
    appRoleId: String(data.appRoleId ?? ""),
    permissions: Array.isArray(data.permissions) ? (data.permissions as AppPermissionId[]) : [],
    recoveryEmail: String(data.recoveryEmail ?? email),
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

  const recoveryEmail = normalizeEmail(input.recoveryEmail);
  if (!recoveryEmail) return { ok: false, message: "กรอกอีเมลสำรอง" };

  try {
    const userRef = doc(db, usersCollection, uid);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) return { ok: false, message: "ไม่พบผู้ใช้" };

    await updateDoc(userRef, {
      name,
      address: input.address.trim(),
      phone: input.phone.trim(),
      recoveryEmail,
    });

    return { ok: true };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

export async function isEmailTaken(email: string): Promise<boolean> {
  const db = getFirestoreDb();
  if (!db) return false;
  const e = normalizeEmail(email);
  if (!e) return false;
  const snap = await getDoc(doc(db, emailIndexCollection, encodeEmailKey(e)));
  return snap.exists();
}

/** ใช้เป็น doc id ของ emailIndex (Firestore ห้าม / ใน id) */
function encodeEmailKey(email: string): string {
  return normalizeEmail(email).replace(/\//g, "_");
}

/** สร้างโปรไฟล์หลังสมัคร — คนแรกเป็น admin อัตโนมัติ */
export async function createUserProfileAfterRegister(
  uid: string,
  input: RegisterProfileInput,
): Promise<{ ok: true; role: UserRole; approved: boolean } | { ok: false; message: string }> {
  const db = getFirestoreDb();
  if (!db) return { ok: false, message: "ยังไม่ได้ตั้งค่า Firebase" };

  const email = normalizeEmail(input.email);
  if (!isValidEmail(email)) {
    return { ok: false, message: "รูปแบบอีเมลไม่ถูกต้อง" };
  }

  const nationalId = input.nationalId ? normalizeNationalId(input.nationalId) : "";

  try {
    const role = await runTransaction(db, async (tx) => {
      const metaRef = doc(db, metaCollection, metaAppDocId);
      const userRef = doc(db, usersCollection, uid);
      const emailRef = doc(db, emailIndexCollection, encodeEmailKey(email));
      const metaSnap = await tx.get(metaRef);
      const emailSnap = await tx.get(emailRef);

      if (emailSnap.exists()) {
        throw new Error("อีเมลนี้ลงทะเบียนแล้ว");
      }

      const isFirst = !metaSnap.exists() || !metaSnap.data()?.bootstrapComplete;
      const assignedRole: UserRole = isFirst ? "admin" : "user";
      const approved = isFirst;

      tx.set(userRef, {
        email,
        authEmail: email,
        nationalId,
        name: input.name.trim(),
        address: input.address.trim(),
        phone: input.phone.trim(),
        recoveryEmail: email,
        role: assignedRole,
        approved,
        permissions: [],
        appRoleId: "",
        createdAt: serverTimestamp(),
      });

      tx.set(emailRef, {
        uid,
        email,
      });

      if (nationalId.length === 13) {
        tx.set(doc(db, nationalIdIndexCollection, nationalId), {
          uid,
          authEmail: email,
          recoveryEmail: email,
        });
      }

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
