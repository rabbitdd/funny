import { NextRequest } from "next/server";
import { handle, json, requireAdmin } from "@/lib/http";
import { stats } from "@/lib/polls";
export async function GET(request: NextRequest) {
  return handle(async () => {
    requireAdmin(request);
    return json(
      await stats(request.nextUrl.searchParams.get("poll") || undefined),
    );
  });
}
