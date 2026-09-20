import { NextRequest } from "next/server";
import { handle, json, sameOrigin } from "@/lib/http";
import { currentPoll, recordVisit } from "@/lib/polls";
import {
  cookieOptions,
  digest,
  newVisitor,
  readToken,
  VISITOR_COOKIE,
} from "@/lib/security";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  return handle(async () => {
    sameOrigin(request);
    let token = request.cookies.get(VISITOR_COOKIE)?.value;
    if (!readToken(token, "visitor")) token = newVisitor();
    const visitor = digest(`visitor:${readToken(token, "visitor")}`);
    const poll = await currentPoll();
    await recordVisit(poll.id, visitor);
    const [existing] = await query<{ answer: string }>(
      "SELECT answer FROM votes WHERE poll_id = $1 AND visitor_id = $2",
      [poll.id, visitor],
    );
    const response = json({ poll, answer: existing?.answer ?? null });
    response.cookies.set(VISITOR_COOKIE, token!, cookieOptions(365 * 86400));
    return response;
  });
}
