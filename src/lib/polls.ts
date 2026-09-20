import { query } from "./db";
import { HttpError } from "./http";

export type Poll = {
  id: string;
  question: string;
  paused: boolean;
  revision: number;
  created_at: string;
};
export async function currentPoll() {
  const [poll] = await query<Poll>(
    "SELECT * FROM polls ORDER BY created_at DESC, id DESC LIMIT 1",
  );
  if (!poll) throw new HttpError(503, "This poll is not set up yet.");
  return poll;
}
export async function recordVisit(pollId: string, visitor: string) {
  await query(
    "INSERT INTO visitors(poll_id, visitor_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
    [pollId, visitor],
  );
}
export async function vote(
  pollId: string,
  revision: number,
  visitor: string,
  answer: string,
) {
  const rows = await query<{ answer: "yes" | "no" }>(
    `
    WITH eligible AS (
      SELECT id FROM polls WHERE id = $1 AND revision = $2 AND NOT paused
      AND id = (SELECT id FROM polls ORDER BY created_at DESC, id DESC LIMIT 1)
    ), visit AS (
      INSERT INTO visitors(poll_id, visitor_id) SELECT id, $3 FROM eligible ON CONFLICT DO NOTHING
    )
    INSERT INTO votes(poll_id, visitor_id, answer) SELECT id, $3, $4 FROM eligible
    ON CONFLICT (poll_id, visitor_id) DO UPDATE SET answer = votes.answer
    RETURNING answer`,
    [pollId, revision, visitor, answer],
  );
  if (!rows[0])
    throw new HttpError(
      409,
      "The poll has changed or is paused. Please reload the page.",
    );
  return rows[0].answer;
}
export async function resetVote(
  pollId: string,
  revision: number,
  visitor: string,
) {
  const [result] = await query<{ eligible: boolean }>(
    `WITH eligible AS (
      SELECT id FROM polls WHERE id = $1 AND revision = $2 AND NOT paused
      AND id = (SELECT id FROM polls ORDER BY created_at DESC, id DESC LIMIT 1)
    ), removed AS (
      DELETE FROM votes USING eligible
      WHERE votes.poll_id = eligible.id AND votes.visitor_id = $3
      RETURNING votes.poll_id
    )
    SELECT EXISTS (SELECT 1 FROM eligible) AS eligible`,
    [pollId, revision, visitor],
  );
  if (!result.eligible)
    throw new HttpError(
      409,
      "The poll has changed or is paused. Please reload the page.",
    );
}

export async function rateLimit(key: string, limit: number, seconds: number) {
  await query(
    "DELETE FROM rate_limits WHERE expires_at < now() - interval '1 day'",
  );
  const [row] = await query<{ attempts: number }>(
    `
    INSERT INTO rate_limits(key, attempts, expires_at) VALUES ($1, 1, now() + $2 * interval '1 second')
    ON CONFLICT (key) DO UPDATE SET
      attempts = CASE WHEN rate_limits.expires_at <= now() THEN 1 ELSE rate_limits.attempts + 1 END,
      expires_at = CASE WHEN rate_limits.expires_at <= now() THEN now() + $2 * interval '1 second' ELSE rate_limits.expires_at END
    RETURNING attempts`,
    [key, seconds],
  );
  if (row.attempts > limit)
    throw new HttpError(429, "Too many attempts. Please try again later.");
}
export async function stats(pollId?: string) {
  const polls = await query<Poll>(
    "SELECT * FROM polls ORDER BY created_at DESC, id DESC",
  );
  const selected = pollId ? polls.find((p) => p.id === pollId) : polls[0];
  if (!selected) throw new HttpError(404, "Poll not found.");
  const [totals] = await query<{
    visitors: number;
    total: number;
    yes: number;
    no: number;
    today: number;
  }>(
    `
    SELECT (SELECT count(*)::int FROM visitors WHERE poll_id = $1) AS visitors,
      count(*)::int AS total, count(*) FILTER (WHERE answer = 'yes')::int AS yes,
      count(*) FILTER (WHERE answer = 'no')::int AS no,
      count(*) FILTER (WHERE created_at >= date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')::int AS today
    FROM votes WHERE poll_id = $1`,
    [selected.id],
  );
  const daily = await query<{ day: string; yes: number; no: number }>(
    `
    SELECT to_char(d.day, 'YYYY-MM-DD') AS day,
      count(v.answer) FILTER (WHERE v.answer = 'yes')::int AS yes,
      count(v.answer) FILTER (WHERE v.answer = 'no')::int AS no
    FROM generate_series((now() AT TIME ZONE 'UTC')::date - 6, (now() AT TIME ZONE 'UTC')::date, interval '1 day') d(day)
    LEFT JOIN votes v ON v.poll_id = $1 AND (v.created_at AT TIME ZONE 'UTC')::date = d.day::date
    GROUP BY d.day ORDER BY d.day`,
    [selected.id],
  );
  return { polls, selected, totals, daily, currentId: polls[0]?.id };
}
export type Statistics = Awaited<ReturnType<typeof stats>>;
