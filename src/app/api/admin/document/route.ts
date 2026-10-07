import { NextRequest } from "next/server";
import { query } from "@/lib/db";
import { MAX_PDF_SIZE } from "@/lib/document";
import { handle, HttpError, json, requireAdmin, sameOrigin } from "@/lib/http";

export async function POST(request: NextRequest) {
  return handle(async () => {
    sameOrigin(request);
    requireAdmin(request);
    if (request.headers.get("content-type") !== "application/pdf")
      throw new HttpError(400, "Please choose a PDF file.");
    let name: string;
    try {
      name = decodeURIComponent(
        request.headers.get("x-file-name") ?? "",
      ).trim();
    } catch {
      throw new HttpError(400, "Invalid file name.");
    }
    if (
      !name ||
      name.length > 180 ||
      /[\x00-\x1f\x7f/\\]/.test(name) ||
      !/\.pdf$/i.test(name)
    )
      throw new HttpError(
        400,
        "Choose a PDF with a file name of up to 180 characters.",
      );
    if (Number(request.headers.get("content-length")) > MAX_PDF_SIZE)
      throw new HttpError(413, "The PDF must be 3 MB or smaller.");
    const reader = request.body?.getReader();
    if (!reader) throw new HttpError(400, "Please choose a PDF file.");
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_PDF_SIZE) {
          await reader.cancel();
          throw new HttpError(413, "The PDF must be 3 MB or smaller.");
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    const bytes = Buffer.concat(chunks);
    if (bytes.subarray(0, 5).toString("ascii") !== "%PDF-")
      throw new HttpError(400, "This file does not have a valid PDF header.");
    await query(
      `INSERT INTO site_document(id, name, size, content) VALUES (1, $1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, size = EXCLUDED.size,
       content = EXCLUDED.content, updated_at = now()`,
      [name, size, bytes.toString("base64")],
    );
    return json({ document: { name, size } });
  });
}
