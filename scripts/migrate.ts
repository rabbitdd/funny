import { neon } from "@neondatabase/serverless";
import { schema } from "../src/lib/schema";
if (!process.env.DATABASE_URL) {
  console.error(
    "Set DATABASE_URL in .env.local or the environment before running migrations.",
  );
  process.exit(1);
}
const sql = neon(process.env.DATABASE_URL);
const statements = schema
  .split(";")
  .map((s) => s.trim())
  .filter(Boolean);
await sql.transaction(statements.map((statement) => sql.query(statement)));
console.log("Database schema is ready.");
