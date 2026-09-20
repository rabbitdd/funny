import { randomBytes, scryptSync } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
let muted = false;
const output = new Writable({
  write(chunk, encoding, callback) {
    if (!muted) process.stdout.write(chunk, encoding);
    callback();
  },
});
const prompt = createInterface({
  input: process.stdin,
  output,
  terminal: true,
});
process.stdout.write("New admin password (at least 12 characters): ");
muted = true;
const password = await prompt.question("");
muted = false;
prompt.close();
process.stdout.write("\n");
if (password.length < 12) {
  console.error("Use at least 12 characters.");
  process.exit(1);
}
const salt = randomBytes(16).toString("hex");
console.log(
  `ADMIN_PASSWORD_HASH=scrypt:${salt}:${scryptSync(password, salt, 64).toString("hex")}`,
);
