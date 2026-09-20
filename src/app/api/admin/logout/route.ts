import { NextRequest } from "next/server";
import { handle, json, sameOrigin } from "@/lib/http";
import { ADMIN_COOKIE, cookieOptions } from "@/lib/security";
export async function POST(request: NextRequest) {
  return handle(async () => {
    sameOrigin(request);
    const response = json({ ok: true });
    response.cookies.set(ADMIN_COOKIE, "", cookieOptions(0));
    return response;
  });
}
