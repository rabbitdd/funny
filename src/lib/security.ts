import {
  createHmac,
  randomUUID,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";

export const ADMIN_COOKIE = "yesno_admin";
export const VISITOR_COOKIE = "yesno_visitor";
export const isProduction = () =>
  process.env.NODE_ENV === "production" || !!process.env.VERCEL;
function secret() {
  const value = process.env.SESSION_SECRET;
  if (value && value.length >= 32) return value;
  if (isProduction())
    throw new Error("SESSION_SECRET must contain at least 32 characters");
  return "local-development-only-secret-never-for-production";
}
export function digest(value: string) {
  return createHmac("sha256", secret()).update(value).digest("hex");
}
function equal(a: string, b: string) {
  const first = Buffer.from(a);
  const second = Buffer.from(b);
  return first.length === second.length && timingSafeEqual(first, second);
}
export function signToken(kind: string, value: string, lifetime: number) {
  const payload = Buffer.from(
    JSON.stringify({ kind, value, exp: Date.now() + lifetime * 1000 }),
  ).toString("base64url");
  return `${payload}.${digest(payload)}`;
}
export function readToken(
  token: string | undefined,
  kind: string,
): string | null {
  if (!token || token.length > 1024) return null;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra || !equal(signature, digest(payload)))
    return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    return data.kind === kind &&
      typeof data.exp === "number" &&
      data.exp > Date.now() &&
      typeof data.value === "string"
      ? data.value
      : null;
  } catch {
    return null;
  }
}
export function newVisitor() {
  return signToken("visitor", randomUUID(), 365 * 86400);
}
export function verifyPassword(username: string, password: string) {
  const configuredUser = process.env.ADMIN_USERNAME;
  const hash = process.env.ADMIN_PASSWORD_HASH;
  if (!configuredUser || !hash) return false;
  const [method, salt, expected] = hash.split(":");
  if (method !== "scrypt" || !salt || !expected || expected.length !== 128)
    return false;
  const actual = scryptSync(password, salt, 64).toString("hex");
  return (
    equal(actual, expected) && equal(digest(username), digest(configuredUser))
  );
}
export function adminVersion() {
  return digest(
    `admin:${process.env.ADMIN_USERNAME}:${process.env.ADMIN_PASSWORD_HASH}`,
  );
}
export function validAdmin(token?: string) {
  return (
    !!process.env.ADMIN_PASSWORD_HASH &&
    readToken(token, "admin") === adminVersion()
  );
}
export const cookieOptions = (maxAge: number) => ({
  httpOnly: true,
  secure: isProduction(),
  sameSite: "lax" as const,
  path: "/",
  maxAge,
});
