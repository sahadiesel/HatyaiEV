export type DocumentKind =
  | "INVOICE"
  | "TAX_INVOICE"
  | "RECEIPT"
  | "PURCHASE_ORDER"
  | "WITHHOLDING_TAX"
  | "PAYMENT_VOUCHER";

export type DocumentRecord = {
  id: string;
  kind: DocumentKind;
  number: string;
  issueDate: Date;
  subtotal: string;
  vatAmount: string;
  totalAmount: string;
  withholdingAmount: string;
  notes: string;
  linesJson: string;
  metaJson: string;
  clientId: string | null;
  contractorId: string | null;
};

export type DocumentWriteInput = Omit<DocumentRecord, "id" | "number"> & {
  number?: string;
};

export type DocumentListItem = DocumentRecord & {
  clientName: string | null;
  contractorName: string | null;
};
