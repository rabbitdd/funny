import { neon } from "@neondatabase/serverless";
import type { PGlite } from "@electric-sql/pglite";
import { schema } from "./schema";

const globalDb = globalThis as unknown as { localDatabase?: Promise<PGlite> };
export async function query<T>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  if (process.env.DATABASE_URL) {
    return (await neon(process.env.DATABASE_URL).query(sql, params)) as T[];
  }
  if (process.env.NODE_ENV === "production" || process.env.VERCEL) {
    throw new Error("DATABASE_URL is required in production");
  }
  globalDb.localDatabase ??= (async () => {
    const { PGlite } = await import("@electric-sql/pglite");
    const db = new PGlite(
      process.env.NODE_ENV === "test" ? undefined : ".data/poll",
    );
    await db.exec(schema);
    return db;
  })();
  return (await (await globalDb.localDatabase).query<T>(sql, params)).rows;
}
