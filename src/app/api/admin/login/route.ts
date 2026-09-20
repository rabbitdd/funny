import { NextRequest } from "next/server";
import { body, handle, HttpError, json, sameOrigin } from "@/lib/http";
import {
  ADMIN_COOKIE,
  adminVersion,
  cookieOptions,
  digest,
  signToken,
  verifyPassword,
} from "@/lib/security";
import { rateLimit } from "@/lib/polls";

export async function POST(request: NextRequest) {
  return handle(async () => {
    sameOrigin(request);
    const data = await body(request);
    if (
      typeof data.username !== "string" ||
      typeof data.password !== "string" ||
      data.username.length > 100 ||
      data.password.length > 512
    )
      throw new HttpError(400, "Please check your username and password.");
    // Vercel overwrites x-vercel-forwarded-for. Do not trust arbitrary forwarded headers.
    const ip = process.env.VERCEL
      ? request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
        "unknown"
      : "local";
    await rateLimit(`login:ip:${digest(ip)}`, 10, 900);
    await rateLimit("login:global", 100, 900);
    if (!verifyPassword(data.username, data.password))
      throw new HttpError(401, "Incorrect username or password.");
    const response = json({ ok: true });
    response.cookies.set(
      ADMIN_COOKIE,
      signToken("admin", adminVersion(), 8 * 3600),
      cookieOptions(8 * 3600),
    );
    return response;
  });
}
