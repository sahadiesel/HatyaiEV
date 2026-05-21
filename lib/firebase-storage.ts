"use client";

import {
  deleteObject,
  getDownloadURL,
  getStorage,
  ref,
  uploadBytes,
  type FirebaseStorage,
} from "firebase/storage";
import type { ContractPhoto } from "./vehicle-inspection-items";
import { getFirebaseApp } from "./firebase";
import { getFirebaseAuth } from "./firebase-auth";

let cachedStorage: FirebaseStorage | null = null;

export function getFirebaseStorageClient(): FirebaseStorage | null {
  const app = getFirebaseApp();
  if (!app) return null;
  if (!cachedStorage) {
    cachedStorage = getStorage(app);
  }
  return cachedStorage;
}

function photoId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `p-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function extFromFile(file: File): string {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]{2,5}$/.test(fromName)) return fromName;
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg";
}

export async function uploadVehicleContractPhoto(
  contractId: string,
  lineIndex: number,
  file: File,
): Promise<ContractPhoto> {
  const auth = getFirebaseAuth();
  if (!auth?.currentUser) {
    throw new Error("ต้องเข้าสู่ระบบก่อนอัปโหลดรูป");
  }
  const storage = getFirebaseStorageClient();
  if (!storage) {
    throw new Error("ยังไม่ได้ตั้งค่า Firebase Storage");
  }

  const id = photoId();
  const path = `hiring-contracts/${contractId}/vehicles/${lineIndex}/${id}.${extFromFile(file)}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file, { contentType: file.type || "image/jpeg" });
  const downloadUrl = await getDownloadURL(storageRef);

  return {
    id,
    fileName: file.name,
    storagePath: path,
    downloadUrl,
  };
}

export async function deleteVehicleContractPhoto(storagePath: string): Promise<void> {
  const storage = getFirebaseStorageClient();
  if (!storage || !storagePath) return;
  try {
    await deleteObject(ref(storage, storagePath));
  } catch {
    /* ไฟล์อาจถูกลบไปแล้ว */
  }
}

export async function resolveContractPhotoUrl(photo: ContractPhoto): Promise<ContractPhoto> {
  if (photo.downloadUrl || photo.dataUrl || !photo.storagePath) return photo;
  const storage = getFirebaseStorageClient();
  if (!storage) return photo;
  try {
    const downloadUrl = await getDownloadURL(ref(storage, photo.storagePath));
    return { ...photo, downloadUrl };
  } catch {
    return photo;
  }
}

export async function resolveContractPhotoUrls(photos: ContractPhoto[]): Promise<ContractPhoto[]> {
  return Promise.all(photos.map((p) => resolveContractPhotoUrl(p)));
}

export function contractPhotoSrc(photo: ContractPhoto): string {
  return photo.downloadUrl ?? photo.dataUrl ?? "";
}
