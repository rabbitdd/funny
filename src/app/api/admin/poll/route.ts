import { NextRequest } from "next/server";
import {
  body,
  handle,
  HttpError,
  json,
  requireAdmin,
  sameOrigin,
} from "@/lib/http";
import { query } from "@/lib/db";
import { currentPoll } from "@/lib/polls";
export async function POST(request: NextRequest) {
  return handle(async () => {
    sameOrigin(request);
    requireAdmin(request);
    const data = await body(request);
    if (
      typeof data.question !== "string" ||
      data.question.trim().length < 3 ||
      data.question.trim().length > 180 ||
      !["new", "edit", "pause"].includes(data.mode)
    )
      throw new HttpError(
        400,
        "The question must be between 3 and 180 characters.",
      );
    if (data.mode === "new") {
      await query("INSERT INTO polls(question) VALUES ($1)", [
        data.question.trim(),
      ]);
    } else {
      if (
        typeof data.paused !== "boolean" ||
        typeof data.pollId !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          data.pollId,
        ) ||
        !Number.isInteger(data.revision) ||
        data.revision < 1
      )
        throw new HttpError(400, "Invalid poll state.");
      const rows = await query(
        `UPDATE polls SET question = $1, paused = $2, revision = revision + 1
      WHERE id = $3 AND revision = $4 AND id = (SELECT id FROM polls ORDER BY created_at DESC, id DESC LIMIT 1) RETURNING id`,
        [data.question.trim(), data.paused, data.pollId, data.revision],
      );
      if (!rows.length)
        throw new HttpError(
          409,
          "The poll has already changed. Please refresh the statistics.",
        );
    }
    return json({ poll: await currentPoll() });
  });
}
