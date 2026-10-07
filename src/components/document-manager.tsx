"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Download, FileText, Upload } from "lucide-react";
import {
  type DocumentInfo,
  formatFileSize,
  MAX_PDF_SIZE,
} from "@/lib/document";

export function DocumentManager() {
  const [document, setDocument] = useState<DocumentInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const input = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/document");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setDocument(data.document);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the PDF.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function upload(file: File) {
    setError("");
    setNotice("");
    if (!/\.pdf$/i.test(file.name)) {
      setError("Please choose a PDF file.");
      return;
    }
    if (file.size > MAX_PDF_SIZE) {
      setError("The PDF must be 3 MB or smaller.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/admin/document", {
        method: "POST",
        headers: {
          "Content-Type": "application/pdf",
          "X-File-Name": encodeURIComponent(file.name),
        },
        body: file,
      });
      if (response.status === 401) {
        window.location.assign("/admin");
        return;
      }
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setDocument(data.document);
      setNotice(
        "PDF published. The download button is now available on the poll page.",
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not upload the PDF. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className="panel document-panel"
      aria-labelledby="document-title"
      aria-busy={loading || busy}
    >
      <div className="document-heading">
        <div className="document-icon">
          <FileText size={22} strokeWidth={1.5} aria-hidden="true" />
        </div>
        <div>
          <h2 id="document-title">A little more to share.</h2>
          <p className="small-muted">
            Add a PDF for visitors to download. One file for the whole site.
          </p>
        </div>
      </div>
      <div className="document-controls">
        <div className="document-details">
          <strong>
            {loading
              ? "Loading PDF…"
              : document
                ? document.name
                : "No PDF uploaded yet"}
          </strong>
          <span className="small-muted">
            {document
              ? `PDF · ${formatFileSize(document.size)}`
              : "The download button appears after you upload a file."}
          </span>
        </div>
        <div className="document-actions">
          {document && (
            <a
              className="secondary-button"
              href="/api/document/download"
              download
            >
              <Download size={16} aria-hidden="true" />
              Download
            </a>
          )}
          <button
            type="button"
            className="primary-button"
            disabled={loading || busy}
            onClick={() => input.current?.click()}
          >
            <Upload size={16} aria-hidden="true" />
            {busy ? "Uploading…" : document ? "Replace PDF" : "Upload PDF"}
          </button>
          <input
            ref={input}
            type="file"
            accept="application/pdf,.pdf"
            hidden
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = "";
              if (file) void upload(file);
            }}
          />
        </div>
      </div>
      <p className="document-help small-muted">
        PDF up to 3 MB. Uploading publishes the file immediately; replacing it
        updates the existing button.
      </p>
      {error && (
        <div className="alert error" role="alert">
          {error}
          <button
            className="text-button"
            type="button"
            disabled={loading || busy}
            onClick={load}
          >
            Refresh
          </button>
        </div>
      )}
      {notice && (
        <div className="alert success" role="status">
          <Check size={16} aria-hidden="true" />
          {notice}
        </div>
      )}
    </section>
  );
}
