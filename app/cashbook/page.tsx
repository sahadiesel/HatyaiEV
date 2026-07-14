import { calcCashflowBalance } from "@/lib/cashbook-repository";
import { CashbookClient } from "./CashbookClient";

export const metadata = { title: "สมุดเงินสด — HYEV" };
export const dynamic = "force-dynamic";

export default async function CashbookPage() {
  const { openingBalance, totalIn, totalOut, balance, entries } = await calcCashflowBalance();
  return (
    <CashbookClient
      openingBalance={openingBalance}
      totalIn={totalIn}
      totalOut={totalOut}
      balance={balance}
      entries={entries}
      userName=""
    />
  );
}
