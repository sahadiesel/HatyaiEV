"use client";

import { useAuth } from "@/components/AuthProvider";
import { documentPrintUrl } from "@/lib/documents/print-url";

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
  const href = documentPrintUrl(documentId, profile?.name);

  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {label}
    </a>
  );
}
