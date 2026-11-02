// Fails the build if browser-reachable code imports the Supabase admin client or reads SUPABASE_SECRET_KEY (SEC-11).
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const HUB_SRC = join(ROOT, "apps/hub/src");
const SERVER_ONLY = [/\/app\/api\//, /\/app\/auth\//, /\/lib\/supabase\/admin\.ts$/, /\/lib\/github\//, /\/lib\/server\//, /\/env\.ts$/];
const BAD = [/lib\/supabase\/admin/, /SUPABASE_SECRET_KEY/, /GITHUB_APP_PRIVATE_KEY/, /GITHUB_WEBHOOK_SECRET/, /CRON_SECRET/];

function* walk(dir) {
  let entries = [];
  try { entries = readdirSync(dir); } catch { return; }
  for (const e of entries) {
    if (e === "node_modules" || e === ".next") continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (/\.(tsx?|jsx?|mjs)$/.test(e)) yield p;
  }
}

const problems = [];
for (const file of walk(HUB_SRC)) {
  const src = readFileSync(file, "utf8");
  const isClient = /^\s*["']use client["']/m.test(src);
  const serverOnly = SERVER_ONLY.some((re) => re.test(file)) || /import\s+["']server-only["']/.test(src);
  if (!isClient && serverOnly) continue;
  if (!isClient) continue; // Server Components may read server env; client modules may not.
  for (const re of BAD) if (re.test(src)) problems.push(`${relative(ROOT, file)}: matches ${re}`);
}
if (problems.length) {
  console.error("Secret material reachable from client code:\n" + problems.join("\n"));
  process.exit(1);
}
console.log("check-secret-imports: ok");
