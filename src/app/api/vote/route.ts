import { NextRequest } from "next/server";
import { body, handle, HttpError, json, sameOrigin } from "@/lib/http";
import { resetVote, vote } from "@/lib/polls";
import { digest, readToken, VISITOR_COOKIE } from "@/lib/security";

export async function POST(request: NextRequest) {
  return handle(async () => {
    sameOrigin(request);
    const visitor = readToken(
      request.cookies.get(VISITOR_COOKIE)?.value,
      "visitor",
    );
    if (!visitor)
      throw new HttpError(401, "Enable cookies and reload the page to answer.");
    const data = await body(request);
    if (
      typeof data.pollId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        data.pollId,
      ) ||
      !Number.isInteger(data.revision) ||
      data.revision < 1 ||
      !["yes", "no"].includes(data.answer)
    )
      throw new HttpError(400, "Invalid answer.");
    const answer = await vote(
      data.pollId,
      data.revision,
      digest(`visitor:${visitor}`),
      data.answer,
    );
    return json({ answer });
  });
}

export async function DELETE(request: NextRequest) {
  return handle(async () => {
    sameOrigin(request);
    const visitor = readToken(
      request.cookies.get(VISITOR_COOKIE)?.value,
      "visitor",
    );
    if (!visitor)
      throw new HttpError(
        401,
        "Enable cookies and reload the page to reset your answer.",
      );
    const data = await body(request);
    if (
      typeof data.pollId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        data.pollId,
      ) ||
      !Number.isInteger(data.revision) ||
      data.revision < 1
    )
      throw new HttpError(400, "Invalid poll.");
    await resetVote(data.pollId, data.revision, digest(`visitor:${visitor}`));
    return json({ answer: null });
  });
}
