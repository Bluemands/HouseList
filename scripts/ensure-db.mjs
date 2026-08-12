// Runs before `next dev` (see the "predev" script in package.json) so that
// `npm install && npm run dev` is genuinely all that's needed locally: start
// (or reuse) Prisma's local dev Postgres, then apply any pending migrations.
// `prisma dev -d` is safe to call even when already running (it just prints
// the existing server's connection info and exits 0), and `migrate deploy`
// only ever applies pending migrations, so both are safe to run on every
// startup.
import { execSync } from "node:child_process";

function run(cmd) {
  execSync(cmd, { stdio: "inherit" });
}

try {
  run("npx prisma dev -d");
} catch {
  // DATABASE_URL may intentionally point elsewhere (e.g. a developer
  // testing against Neon locally) — that's fine, migrate deploy below
  // targets whatever DATABASE_URL is actually set to.
}

// `prisma dev -d` returns as soon as the server process is launched, not once
// it's actually accepting connections — so the first migrate attempt can
// race a database that isn't listening yet. Retry quietly before surfacing
// a real failure.
const maxAttempts = 10;
let migrated = false;
let lastOutput = "";
for (let attempt = 1; attempt <= maxAttempts; attempt++) {
  try {
    execSync("npx prisma migrate deploy", { stdio: "pipe" });
    migrated = true;
    break;
  } catch (err) {
    lastOutput = err.stdout?.toString() ?? err.message;
    if (attempt < maxAttempts) {
      execSync('node -e "setTimeout(()=>{}, 800)"');
    }
  }
}

if (!migrated) {
  console.error(lastOutput);
  console.error(
    "\nCouldn't apply database migrations. If this is your first run, check DATABASE_URL in .env is set — see README.md.",
  );
  process.exit(1);
}

console.log("Database ready.");
