import { parseAmount } from "@/lib/documents/calc";

/** เงื่อนไขชำระเงินในสัญญาซื้อ (เก็บใน legalDocuments เท่านั้น — ไม่กระทบ cashbook) */
export type PurchaseContractPaymentLine = {
  id: string;
  label: string;
  amount: string;
  note: string;
};

export type PurchaseContractTerms = {
  paymentLines: PurchaseContractPaymentLine[];
};

export function newPaymentLine(
  partial?: Partial<Omit<PurchaseContractPaymentLine, "id">> & { id?: string },
): PurchaseContractPaymentLine {
  return {
    id:
      partial?.id ||
      (typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID().slice(0, 8)
        : `p${Date.now().toString(36)}`),
    label: partial?.label ?? "",
    amount: partial?.amount ?? "",
    note: partial?.note ?? "",
  };
}

export function emptyPurchaseContractTerms(): PurchaseContractTerms {
  return { paymentLines: [] };
}

export function parsePurchaseContractTerms(raw: string | null | undefined): PurchaseContractTerms {
  if (!raw?.trim()) return emptyPurchaseContractTerms();
  try {
    const data = JSON.parse(raw) as {
      paymentLines?: unknown;
      paymentTerms?: string;
    };
    if (Array.isArray(data.paymentLines)) {
      return {
        paymentLines: data.paymentLines.map((row, i) => {
          const r = (row && typeof row === "object" ? row : {}) as Record<string, unknown>;
          return newPaymentLine({
            id: typeof r.id === "string" ? r.id : `L${i + 1}`,
            label: String(r.label ?? ""),
            amount: String(r.amount ?? ""),
            note: String(r.note ?? ""),
          });
        }),
      };
    }
    // รูปแบบเก่า: ข้อความเดียว
    if (typeof data.paymentTerms === "string" && data.paymentTerms.trim()) {
      return {
        paymentLines: [
          newPaymentLine({ label: "เงื่อนไขการชำระเงิน", amount: "", note: data.paymentTerms }),
        ],
      };
    }
  } catch {
    /* ignore */
  }
  return emptyPurchaseContractTerms();
}

export function serializePurchaseContractTerms(terms: PurchaseContractTerms): string {
  return JSON.stringify({
    paymentLines: terms.paymentLines.map((l) => ({
      id: l.id,
      label: l.label.trim(),
      amount: String(parseAmount(l.amount) || l.amount || "0"),
      note: l.note.trim(),
    })),
  });
}

export function sumPaymentLines(lines: PurchaseContractPaymentLine[]): number {
  return lines.reduce((s, l) => s + parseAmount(l.amount), 0);
}
