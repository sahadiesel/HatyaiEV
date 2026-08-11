"use client";

import { useEffect, useState } from "react";
import type { EntityRecord, VehicleRecord } from "@/lib/domain-types";
import { listEntitiesClient } from "@/lib/entities-client";
import { getVehicleClient } from "@/lib/vehicles-client";
import { VehicleDetailClient } from "./VehicleDetailClient";

export function VehicleDetailLoader({ vehicleId }: { vehicleId: string }) {
  const [vehicle, setVehicle] = useState<VehicleRecord | null>(null);
  const [entities, setEntities] = useState<EntityRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void Promise.all([getVehicleClient(vehicleId), listEntitiesClient()]).then(([v, ents]) => {
      if (cancelled) return;
      if (!v) setMissing(true);
      else {
        setVehicle(v);
        setEntities(ents);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [vehicleId]);

  if (loading) {
    return <p className="text-sm text-slate-500">กำลังโหลดข้อมูลรถ…</p>;
  }
  if (missing || !vehicle) {
    return <p className="text-sm text-red-700">ไม่พบรถคันนี้</p>;
  }
  return <VehicleDetailClient vehicle={vehicle} entities={entities} />;
}
