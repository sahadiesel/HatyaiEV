"use client";

import { useAuth } from "@/components/AuthProvider";
import { printDocumentClient } from "@/lib/documents-client";
import { useState, useTransition } from "react";

export function DocumentPrintLink({
  documentId,
  className = "text-blue-800 hover:underline",
  label = "พิมพ์",
}: {
  documentId: string;
  className?: string;
  label?: string;
}) {
  const { profile } = useAuth();
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  return (
    <>
      <button
        type="button"
        disabled={pending}
        className={className}
        onClick={() => {
          setErr(null);
          startTransition(async () => {
            const r = await printDocumentClient(documentId, profile?.name);
            if (!r.ok) setErr(r.message);
          });
        }}
      >
        {pending ? "…" : label}
      </button>
      {err && <span className="ml-1 text-xs text-red-600">{err}</span>}
    </>
  );
}
