import { listEntities } from "@/lib/entities-repository";
import { PaymentVoucherForm } from "@/components/documents/PaymentVoucherForm";

export const metadata = { title: "แก้ไขใบสำคัญจ่าย — HYEV" };
export const dynamic = "force-dynamic";

export default async function EditPaymentVoucherPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const entities = await listEntities();
  return <PaymentVoucherForm entities={entities} documentId={id} />;
}
