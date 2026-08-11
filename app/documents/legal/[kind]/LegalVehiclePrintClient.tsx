"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  printLegalRepairDocClient,
  printLegalVehicleDocClient,
  type LegalVehiclePrintKind,
} from "@/lib/documents/legal-print-client";

export function LegalVehiclePrintClient({
  kind,
  vehicleId,
  contractId,
}: {
  kind: string;
  vehicleId: string;
  contractId?: string;
}) {
  const router = useRouter();
  const [msg, setMsg] = useState("กำลังเตรียมเอกสาร…");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (kind === "purchase" && vehicleId) {
        router.replace(`/documents/purchase-contract/new?vehicleId=${vehicleId}`);
        return;
      }

      if (kind === "repair") {
        if (!contractId) {
          setMsg("ต้องระบุ contractId");
          return;
        }
        const res = await printLegalRepairDocClient(contractId);
        if (cancelled) return;
        setMsg(
          res.ok
            ? "เปิดหน้าต่างพิมพ์แล้ว — ถ้าไม่เห็นให้ตรวจว่าเบราว์เซอร์บล็อกป๊อปอัปหรือไม่"
            : res.message,
        );
        return;
      }

      if (!vehicleId) {
        setMsg("ต้องระบุ vehicleId");
        return;
      }
      if (kind !== "sale" && kind !== "receiving") {
        setMsg("ชนิดเอกสารไม่รองรับ");
        return;
      }

      const res = await printLegalVehicleDocClient(kind as LegalVehiclePrintKind, vehicleId);
      if (cancelled) return;
      setMsg(
        res.ok
          ? "เปิดหน้าต่างพิมพ์แล้ว — ถ้าไม่เห็นให้ตรวจว่าเบราว์เซอร์บล็อกป๊อปอัปหรือไม่"
          : res.message,
      );
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [kind, vehicleId, contractId, router]);

  const backHref = vehicleId ? `/vehicles/${vehicleId}` : "/services";

  return (
    <div className="mx-auto max-w-lg space-y-3 p-8">
      <p className="text-sm text-slate-700">{msg}</p>
      <Link href={backHref} className="text-sm text-blue-800 hover:underline">
        ← กลับ
      </Link>
    </div>
  );
}
