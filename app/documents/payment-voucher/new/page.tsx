import { listEntities } from "@/lib/entities-repository";
import { PaymentVoucherForm } from "@/components/documents/PaymentVoucherForm";

export const metadata = { title: "สร้างใบสำคัญจ่าย — HYEV" };
export const dynamic = "force-dynamic";

export default async function NewPaymentVoucherPage() {
  const entities = await listEntities();
  return <PaymentVoucherForm entities={entities} />;
}
