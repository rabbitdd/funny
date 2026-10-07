"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import type { DocumentInfo } from "@/lib/document";

export function PdfDownload() {
  const [document, setDocument] = useState<DocumentInfo | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch("/api/document", {
          signal: controller.signal,
        });
        if (!response.ok) return;
        const data = await response.json();
        setDocument(data.document);
      } catch {
        // A document outage must not prevent visitors from answering the poll.
      }
    }
    void load();
    return () => controller.abort();
  }, []);

  if (!document) return null;
  return (
    <div className="pdf-download">
      <a className="pdf-download-button" href="/api/document/download" download>
        <Download size={18} strokeWidth={1.7} aria-hidden="true" />
        <span>click me</span>
      </a>
    </div>
  );
}
