import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { HiringContractEditor, type InstallmentRow, type VehicleRow } from "./HiringContractEditor";

export default async function HiringContractDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [contract, clients] = await Promise.all([
    prisma.hiringContract.findUnique({
      where: { id },
      include: { vehicles: { orderBy: { lineIndex: "asc" } }, installments: { orderBy: { sequence: "asc" } } },
    }),
    prisma.client.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!contract) notFound();

  const initialVehicles: VehicleRow[] = contract.vehicles.map((v) => ({
    lineIndex: v.lineIndex,
    brand: v.brand,
    model: v.model,
    year: v.year,
    color: v.color,
    engineType: v.engineType,
    engineSize: v.engineSize,
    extraNotes: v.extraNotes,
  }));

  const initialInstallments: InstallmentRow[] = contract.installments.map((m) => ({
    sequence: m.sequence,
    label: m.label,
    amount: m.amount.toString(),
    percent: m.percent != null ? m.percent.toString() : "",
  }));

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-slate-600">
          <Link href="/contracts/hiring-contracts" className="text-blue-800 hover:underline">
            ← สัญญารับจ้าง
          </Link>
        </p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">
          แก้ไขสัญญารับจ้าง <span className="text-slate-600">{contract.code}</span>
        </h1>
      </div>

      <HiringContractEditor
        contractId={contract.id}
        clients={clients}
        initialClientId={contract.clientId}
        initialTitle={contract.title}
        initialVehicleCount={contract.vehicleCount}
        initialPriceExVat={contract.pricePerVehicleExVat.toString()}
        initialVatRate={contract.vatRate.toString()}
        initialNotes={contract.notes}
        initialStatus={contract.status}
        initialVehicles={initialVehicles}
        initialInstallments={initialInstallments}
      />
    </div>
  );
}
