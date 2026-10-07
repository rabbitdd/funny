import { query } from "@/lib/db";
import type { DocumentInfo } from "@/lib/document";
import { handle, json } from "@/lib/http";

export async function GET() {
  return handle(async () => {
    const [document] = await query<DocumentInfo>(
      "SELECT name, size FROM site_document WHERE id = 1",
    );
    return json({ document: document ?? null });
  });
}
