import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, validAdmin } from "./security";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  // Next's internal URL can use localhost while the browser uses 127.0.0.1.
  // Host is controlled by the browser/network, unlike arbitrary forwarded headers.
  const host = request.headers.get("host") ?? new URL(request.url).host;
  let allowed = false;
  try {
    const url = new URL(origin ?? "");
    allowed =
      ["https:", "http:"].includes(url.protocol) &&
      url.host === host &&
      url.protocol === new URL(request.url).protocol;
  } catch {
    /* Missing or malformed origin. */
  }
  if (!allowed)
    throw new HttpError(403, "Request rejected. Please reload the page.");
}
export function requireAdmin(request: NextRequest) {
  if (!validAdmin(request.cookies.get(ADMIN_COOKIE)?.value))
    throw new HttpError(401, "Please sign in again.");
}
export async function body(request: NextRequest) {
  const raw = await request.text();
  if (raw.length > 4096) throw new HttpError(413, "The request is too large.");
  try {
    const value = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new Error();
    return value;
  } catch {
    throw new HttpError(400, "Invalid request.");
  }
}
export function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store, private" },
  });
}
export async function handle(fn: () => Promise<NextResponse>) {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof HttpError)
      return json({ error: error.message }, error.status);
    console.error(
      "Request failed:",
      error instanceof Error ? error.message : "Unknown error",
    );
    return json(
      { error: "Could not connect. Please try again in a moment." },
      503,
    );
  }
}
