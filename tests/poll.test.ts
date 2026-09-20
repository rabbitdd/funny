import { beforeAll, describe, expect, it } from "vitest";
import { scryptSync } from "node:crypto";
import { NextRequest } from "next/server";
import { query } from "@/lib/db";
import {
  currentPoll,
  rateLimit,
  recordVisit,
  resetVote,
  stats,
  vote,
} from "@/lib/polls";
import {
  adminVersion,
  readToken,
  signToken,
  validAdmin,
  verifyPassword,
} from "@/lib/security";
import { POST as loadPoll } from "@/app/api/poll/route";
import { POST as postVote, DELETE as deleteVote } from "@/app/api/vote/route";
import { POST as login } from "@/app/api/admin/login/route";
import { POST as editPoll } from "@/app/api/admin/poll/route";
import { GET as getStats } from "@/app/api/admin/stats/route";
import { sameOrigin } from "@/lib/http";

beforeAll(async () => {
  delete process.env.DATABASE_URL;
  process.env.SESSION_SECRET = "test-secret-at-least-32-characters-long";
  process.env.ADMIN_USERNAME = "owner";
  process.env.ADMIN_PASSWORD_HASH = `scrypt:test-salt:${scryptSync("test-password-123", "test-salt", 64).toString("hex")}`;
  await currentPoll();
});
function req(
  path: string,
  data?: object,
  cookie?: string,
  origin = "http://localhost:3000",
  method = data ? "POST" : "GET",
) {
  return new NextRequest(`http://localhost:3000${path}`, {
    method,
    headers: {
      origin,
      ...(cookie ? { cookie } : {}),
      "Content-Type": "application/json",
    },
    ...(data ? { body: JSON.stringify(data) } : {}),
  });
}
describe("signed identity and admin access", () => {
  it("uses the incoming Host when Next's internal hostname differs", () => {
    const request = new NextRequest("http://localhost:3000/api/poll", {
      headers: { host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000" },
    });
    expect(() => sameOrigin(request)).not.toThrow();
    request.headers.set("origin", "http://attacker.example");
    expect(() => sameOrigin(request)).toThrow();
  });
  it("rejects forged, expired, and wrong-purpose tokens", () => {
    const token = signToken("visitor", "abc", 60);
    expect(readToken(token, "visitor")).toBe("abc");
    expect(readToken(`${token}x`, "visitor")).toBeNull();
    expect(readToken(token, "admin")).toBeNull();
    expect(readToken(signToken("admin", "abc", -10), "admin")).toBeNull();
  });
  it("verifies password hashes and invalidates sessions when credentials change", () => {
    expect(verifyPassword("owner", "test-password-123")).toBe(true);
    expect(verifyPassword("owner", "wrong")).toBe(false);
    expect(verifyPassword("another", "test-password-123")).toBe(false);
    const token = signToken("admin", adminVersion(), 60);
    expect(validAdmin(token)).toBe(true);
    process.env.ADMIN_USERNAME = "changed";
    expect(validAdmin(token)).toBe(false);
    process.env.ADMIN_USERNAME = "owner";
  });
  it("denies unauthenticated stats and cross-origin mutations", async () => {
    expect((await getStats(req("/api/admin/stats"))).status).toBe(401);
    expect(
      (
        await loadPoll(
          req("/api/poll", {}, undefined, "https://elsewhere.example"),
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await editPoll(
          req("/api/admin/poll", { mode: "new", question: "A new question?" }),
        )
      ).status,
    ).toBe(401);
  });
  it("sets a protected session only after a correct login", async () => {
    expect(
      (
        await login(
          req("/api/admin/login", { username: "owner", password: "wrong" }),
        )
      ).status,
    ).toBe(401);
    const result = await login(
      req("/api/admin/login", {
        username: "owner",
        password: "test-password-123",
      }),
    );
    expect(result.status).toBe(200);
    expect(result.headers.get("set-cookie")).toContain("HttpOnly");
    expect(result.headers.get("set-cookie")).toContain("SameSite=lax");
  });
});
describe("poll integrity", () => {
  it("deduplicates visits and concurrent votes while preserving the first answer", async () => {
    const poll = await currentPoll();
    await Promise.all(
      Array.from({ length: 5 }, () => recordVisit(poll.id, "same-browser")),
    );
    const answers = await Promise.all(
      Array.from({ length: 8 }, () =>
        vote(poll.id, poll.revision, "same-browser", "yes"),
      ),
    );
    expect(answers).toEqual(Array(8).fill("yes"));
    expect(await vote(poll.id, poll.revision, "same-browser", "no")).toBe(
      "yes",
    );
    const result = await stats();
    expect(result.totals).toMatchObject({
      visitors: 1,
      total: 1,
      yes: 1,
      no: 0,
    });
  });
  it("sets identity, remembers a vote on reload, and rejects missing identity", async () => {
    const pollResponse = await loadPoll(req("/api/poll", {}));
    const cookie = pollResponse.headers.get("set-cookie")!.split(";")[0];
    const { poll } = await pollResponse.json();
    const payload = { pollId: poll.id, revision: poll.revision, answer: "no" };
    expect((await postVote(req("/api/vote", payload))).status).toBe(401);
    expect((await postVote(req("/api/vote", payload, cookie))).status).toBe(
      200,
    );
    const reload = await loadPoll(req("/api/poll", {}, cookie));
    expect((await reload.json()).answer).toBe("no");
  });
  it("resets only the caller's answer, preserves their visit, and allows one replacement vote", async () => {
    const pollResponse = await loadPoll(req("/api/poll", {}));
    const cookie = pollResponse.headers.get("set-cookie")!.split(";")[0];
    const { poll } = await pollResponse.json();
    const payload = { pollId: poll.id, revision: poll.revision };
    const before = (await stats()).totals;
    await postVote(req("/api/vote", { ...payload, answer: "no" }, cookie));
    expect((await stats()).totals.total).toBe(before.total + 1);

    const resetRequest = (
      identity?: string,
      origin = "http://localhost:3000",
    ) => req("/api/vote", payload, identity, origin, "DELETE");
    expect((await deleteVote(resetRequest())).status).toBe(401);
    expect((await deleteVote(resetRequest(`${cookie}tampered`))).status).toBe(
      401,
    );
    expect(
      (await deleteVote(resetRequest(cookie, "https://elsewhere.example")))
        .status,
    ).toBe(403);
    expect((await stats()).totals.total).toBe(before.total + 1);

    const resets = await Promise.all(
      Array.from({ length: 3 }, () => deleteVote(resetRequest(cookie))),
    );
    expect(resets.every((response) => response.status === 200)).toBe(true);
    expect((await stats()).totals).toMatchObject(before);
    expect(
      (await (await loadPoll(req("/api/poll", {}, cookie))).json()).answer,
    ).toBeNull();

    await postVote(req("/api/vote", { ...payload, answer: "yes" }, cookie));
    await postVote(req("/api/vote", { ...payload, answer: "no" }, cookie));
    expect((await stats()).totals).toMatchObject({
      visitors: before.visitors,
      total: before.total + 1,
      yes: before.yes + 1,
      no: before.no,
    });
    expect(
      (await (await loadPoll(req("/api/poll", {}, cookie))).json()).answer,
    ).toBe("yes");
  });
  it("rejects stale questions and paused polls", async () => {
    const poll = await currentPoll();
    await query(
      "UPDATE polls SET paused = true, revision = revision + 1 WHERE id = $1",
      [poll.id],
    );
    await expect(
      vote(poll.id, poll.revision, "visitor-stale", "yes"),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      vote(poll.id, poll.revision + 1, "visitor-paused", "yes"),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      resetVote(poll.id, poll.revision + 1, "same-browser"),
    ).rejects.toMatchObject({ status: 409 });
    await query("UPDATE polls SET paused = false WHERE id = $1", [poll.id]);
    await expect(
      vote(poll.id, poll.revision, "visitor-stale", "yes"),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      resetVote(poll.id, poll.revision, "same-browser"),
    ).rejects.toMatchObject({ status: 409 });
  });
  it("starts a fresh poll without losing history; old poll cannot accept votes", async () => {
    const old = await currentPoll();
    const before = await stats(old.id);
    const cookie = `yesno_admin=${signToken("admin", adminVersion(), 60)}`;
    const response = await editPoll(
      req(
        "/api/admin/poll",
        { mode: "new", question: "Новый вопрос?" },
        cookie,
      ),
    );
    expect(response.status).toBe(200);
    const fresh = await currentPoll();
    expect(fresh.id).not.toBe(old.id);
    expect((await stats()).totals.total).toBe(0);
    expect((await stats(old.id)).totals.total).toBe(before.totals.total);
    await expect(
      vote(old.id, old.revision, "late", "yes"),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      resetVote(old.id, old.revision, "same-browser"),
    ).rejects.toMatchObject({ status: 409 });
    expect((await stats()).daily).toHaveLength(7);
    expect((await stats()).daily.every((d) => d.yes === 0 && d.no === 0)).toBe(
      true,
    );
  });
  it("enforces persistent rate limits and resets expired windows", async () => {
    await rateLimit("test-rate", 2, 60);
    await rateLimit("test-rate", 2, 60);
    await expect(rateLimit("test-rate", 2, 60)).rejects.toMatchObject({
      status: 429,
    });
    await query(
      "UPDATE rate_limits SET expires_at = now() - interval '1 second' WHERE key = $1",
      ["test-rate"],
    );
    await expect(rateLimit("test-rate", 2, 60)).resolves.toBeUndefined();
  });
});
