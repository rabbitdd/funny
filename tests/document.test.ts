import { beforeAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { GET as metadata } from "@/app/api/document/route";
import { GET as download } from "@/app/api/document/download/route";
import { POST as upload } from "@/app/api/admin/document/route";
import { adminVersion, signToken } from "@/lib/security";
import { MAX_PDF_SIZE } from "@/lib/document";

beforeAll(() => {
  delete process.env.DATABASE_URL;
  process.env.SESSION_SECRET = "document-test-secret-at-least-32-characters";
  process.env.ADMIN_USERNAME = "owner";
  process.env.ADMIN_PASSWORD_HASH = "test-document-hash";
});

function request(
  content = "%PDF-1.7\noriginal\n%%EOF",
  options: {
    name?: string;
    cookie?: string;
    origin?: string;
    type?: string;
    length?: number;
  } = {},
) {
  return new NextRequest("http://localhost:3000/api/admin/document", {
    method: "POST",
    headers: {
      origin: options.origin ?? "http://localhost:3000",
      cookie:
        options.cookie ??
        `yesno_admin=${signToken("admin", adminVersion(), 60)}`,
      "content-type": options.type ?? "application/pdf",
      "x-file-name": encodeURIComponent(options.name ?? "Информация.pdf"),
      ...(options.length !== undefined
        ? { "content-length": String(options.length) }
        : {}),
    },
    body: content,
  });
}

describe("site PDF", () => {
  it("hides an absent document and returns 404 for downloads", async () => {
    expect(await (await metadata()).json()).toEqual({ document: null });
    expect((await download()).status).toBe(404);
  });

  it("requires an admin session and the same origin before accepting files", async () => {
    expect((await upload(request(undefined, { cookie: "" }))).status).toBe(401);
    expect(
      (
        await upload(
          request(undefined, { origin: "https://elsewhere.example" }),
        )
      ).status,
    ).toBe(403);
    expect(await (await metadata()).json()).toEqual({ document: null });
  });

  it("publishes metadata and downloads the exact bytes with a Unicode filename", async () => {
    const bytes = "%PDF-1.7\noriginal\n%%EOF";
    expect((await upload(request(bytes))).status).toBe(200);
    expect(await (await metadata()).json()).toEqual({
      document: { name: "Информация.pdf", size: Buffer.byteLength(bytes) },
    });
    const response = await download();
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toContain(
      `attachment; filename="document.pdf"; filename*=UTF-8''${encodeURIComponent("Информация.pdf")}`,
    );
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-length")).toBe(
      String(Buffer.byteLength(bytes)),
    );
    expect(await response.text()).toBe(bytes);
  });

  it("rejects invalid files and oversized streams while keeping the previous PDF", async () => {
    const before = await (await download()).text();
    for (const invalid of [
      request("not a PDF"),
      request(""),
      request(undefined, { name: "file.html" }),
      request(undefined, { name: "../file.pdf" }),
      request(undefined, { name: "bad\r\nheader.pdf" }),
      request(undefined, { type: "text/html" }),
    ]) {
      expect((await upload(invalid)).status).toBe(400);
    }
    expect(
      (await upload(request(undefined, { length: MAX_PDF_SIZE + 1 }))).status,
    ).toBe(413);
    // No Content-Length: the streaming limit must still protect the server.
    expect(
      (await upload(request("%PDF-" + "x".repeat(MAX_PDF_SIZE)))).status,
    ).toBe(413);
    expect(await (await download()).text()).toBe(before);
  });

  it("replaces the file at the same download URL", async () => {
    const bytes = "%PDF-1.7\nreplacement\n%%EOF";
    expect((await upload(request(bytes, { name: "Updated.PDF" }))).status).toBe(
      200,
    );
    expect(await (await metadata()).json()).toEqual({
      document: { name: "Updated.PDF", size: Buffer.byteLength(bytes) },
    });
    expect(await (await download()).text()).toBe(bytes);
  });
});
