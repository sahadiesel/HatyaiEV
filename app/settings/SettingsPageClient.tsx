"use client";

import { useEffect, useState } from "react";
import { isFirebaseConfigured } from "@/lib/firebase";
import { readCompanySettingsFromFirestore } from "@/lib/firestore";
import { CompanySettingsForm, type CompanySettingsInitial } from "./CompanySettingsForm";

const empty: CompanySettingsInitial = {
  companyName: "",
  address: "",
  taxId: "",
  phone: "",
  email: "",
  docPrefixInvoice: "INV",
  docPrefixTaxInvoice: "TAX",
  docPrefixReceipt: "RC",
  docPrefixPo: "PO",
  docPrefixWht: "WHT",
};

export function SettingsPageClient() {
  const [initial, setInitial] = useState<CompanySettingsInitial>(empty);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (isFirebaseConfigured()) {
        const fs = await readCompanySettingsFromFirestore();
        if (fs) {
          setInitial({
            companyName: fs.companyName,
            address: fs.address,
            taxId: fs.taxId,
            phone: fs.phone,
            email: fs.email,
            docPrefixInvoice: fs.docPrefixInvoice,
            docPrefixTaxInvoice: fs.docPrefixTaxInvoice,
            docPrefixReceipt: fs.docPrefixReceipt,
            docPrefixPo: fs.docPrefixPo,
            docPrefixWht: fs.docPrefixWht,
          });
          setLoading(false);
          return;
        }
      }
      setLoading(false);
    }
    void load();
  }, []);

  if (loading) {
    return <p className="text-sm text-slate-500">กำลังโหลดการตั้งค่า…</p>;
  }

  return <CompanySettingsForm initial={initial} />;
}
