import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { handle, HttpError } from "@/lib/http";

export async function GET() {
  return handle(async () => {
    const [document] = await query<{ name: string; content: string }>(
      "SELECT name, content FROM site_document WHERE id = 1",
    );
    if (!document) throw new HttpError(404, "No PDF is available yet.");
    const bytes = Buffer.from(document.content, "base64");
    const name = encodeURIComponent(document.name).replace(
      /['()*]/g,
      (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
    );
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="document.pdf"; filename*=UTF-8''${name}`,
        "Content-Length": String(bytes.length),
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  });
}
