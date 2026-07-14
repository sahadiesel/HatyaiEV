"use client";

import { useEffect, useRef, useState } from "react";
import {
  contractPhotoSrc,
  deleteVehicleContractPhoto,
  resolveContractPhotoUrls,
  uploadVehicleContractPhoto,
} from "@/lib/firebase-storage";
import type { ContractPhoto } from "@/lib/vehicle-inspection-items";
import { MAX_PHOTO_BYTES, MAX_VEHICLE_PHOTOS } from "@/lib/vehicle-inspection-items";

type Props = {
  contractId: string;
  lineIndex: number;
  photos: ContractPhoto[];
  onChange: (photos: ContractPhoto[]) => void;
  disabled?: boolean;
};

type PreviewState = { src: string; fileName: string };

export function VehiclePhotoUpload({ contractId, lineIndex, photos, onChange, disabled }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const resolvingRef = useRef(false);

  useEffect(() => {
    if (!preview) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setPreview(null);
    }
    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [preview]);

  useEffect(() => {
    const needsResolve = photos.some((p) => p.storagePath && !p.downloadUrl && !p.dataUrl);
    if (!needsResolve || resolvingRef.current) return;

    resolvingRef.current = true;
    void resolveContractPhotoUrls(photos)
      .then((resolved) => onChange(resolved))
      .finally(() => {
        resolvingRef.current = false;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resolve when storage paths load
  }, [contractId, lineIndex]);

  async function addFiles(files: FileList | null) {
    if (!files?.length || disabled || uploading) return;
    setError(null);
    setUploading(true);
    const next = [...photos];

    try {
      for (const file of Array.from(files)) {
        if (next.length >= MAX_VEHICLE_PHOTOS) {
          setError(`แนบได้สูงสุด ${MAX_VEHICLE_PHOTOS} รูป`);
          break;
        }
        if (!file.type.startsWith("image/")) {
          setError("เลือกได้เฉพาะไฟล์รูปภาพ");
          continue;
        }
        if (file.size > MAX_PHOTO_BYTES) {
          setError(`รูป ${file.name} เกิน 500 KB`);
          continue;
        }
        const uploaded = await uploadVehicleContractPhoto(contractId, lineIndex, file);
        next.push(uploaded);
      }
      onChange(next.slice(0, MAX_VEHICLE_PHOTOS));
    } catch (e) {
      setError(e instanceof Error ? e.message : "อัปโหลดไม่สำเร็จ");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
      if (cameraRef.current) cameraRef.current.value = "";
    }
  }

  async function removePhoto(photo: ContractPhoto) {
    if (photo.storagePath) {
      await deleteVehicleContractPhoto(photo.storagePath);
    }
    onChange(photos.filter((p) => p.id !== photo.id));
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-slate-700">
        รูปแนบตอนทำสัญญา (สูงสุด {MAX_VEHICLE_PHOTOS} รูป · รูปละไม่เกิน 500 KB · เก็บใน Firebase Storage)
      </p>
      {error && <p className="text-xs text-red-700">{error}</p>}
      {uploading && <p className="text-xs text-blue-700">กำลังอัปโหลด…</p>}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={disabled || uploading || photos.length >= MAX_VEHICLE_PHOTOS}
          onClick={() => cameraRef.current?.click()}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 hover:bg-slate-50 disabled:opacity-50"
        >
          ถ่ายจากกล้อง
        </button>
        <button
          type="button"
          disabled={disabled || uploading || photos.length >= MAX_VEHICLE_PHOTOS}
          onClick={() => fileRef.current?.click()}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 hover:bg-slate-50 disabled:opacity-50"
        >
          อัปโหลดไฟล์
        </button>
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => void addFiles(e.target.files)}
        />
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => void addFiles(e.target.files)}
        />
      </div>
      {photos.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {photos.map((p) => {
            const src = contractPhotoSrc(p);
            return (
              <div key={p.id} className="relative overflow-hidden rounded-md border border-slate-200 bg-white">
                {src ? (
                  <button
                    type="button"
                    title="คลิกดูภาพขยาย"
                    onClick={() => setPreview({ src, fileName: p.fileName })}
                    className="group relative block w-full cursor-zoom-in"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt={p.fileName} className="h-24 w-full object-cover" />
                    <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
                      ดูภาพใหญ่
                    </span>
                  </button>
                ) : (
                  <div className="flex h-24 items-center justify-center text-xs text-slate-500">กำลังโหลดรูป…</div>
                )}
                {!disabled && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void removePhoto(p);
                    }}
                    className="absolute right-1 top-1 z-10 rounded bg-black/60 px-1.5 py-0.5 text-xs text-white hover:bg-black/80"
                  >
                    ลบ
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {preview && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="ดูภาพขยาย"
          onClick={() => setPreview(null)}
        >
          <button
            type="button"
            onClick={() => setPreview(null)}
            className="absolute right-4 top-4 rounded-md bg-white/90 px-3 py-1.5 text-sm font-medium text-slate-900 shadow hover:bg-white"
          >
            ปิด
          </button>
          <div
            className="flex max-h-[92vh] max-w-[min(96vw,56rem)] flex-col items-center gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview.src}
              alt={preview.fileName}
              className="max-h-[85vh] max-w-full rounded-lg object-contain shadow-2xl"
            />
            <p className="max-w-full truncate text-center text-sm text-white/90">{preview.fileName}</p>
          </div>
        </div>
      )}
    </div>
  );
}
