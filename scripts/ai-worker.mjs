// The AI worker: answers the "Ask Claude" questions queued in the app, by
// running Claude Code (`claude -p`) on this computer with your own Claude
// subscription. The app itself never calls Claude.
//
//   npm run ai-worker            keep checking for questions until stopped
//   npm run ai-worker -- --once  answer whatever is waiting, then exit
//
// Config, from the environment or this project's .env:
//   HOUSE_LIST_URL           the app, e.g. https://your-app.vercel.app (default http://localhost:3000)
//   HOUSE_LIST_WORKER_TOKEN  from Settings → "Ask Claude" in the app. Locally it can be
//                            left out: it's derived from AUTH_SECRET in .env instead.
//   HOUSE_LIST_CLAUDE_MODEL  model alias for claude (default "sonnet")
//   HOUSE_LIST_CLAUDE_BIN    path to the claude executable, if it isn't found on PATH
//   HOUSE_LIST_WORKER_MAX_IDLE  longest wait between checks when quiet, in seconds (default 60)
//
// Plain Node (20+), no dependencies, so it runs anywhere Claude Code does.

import { spawn } from "node:child_process";
import { createHmac } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildPrompt, claudeArgs, idleDelay, parseClaudeOutput, parseEnvFile } from "./ai-worker-lib.mjs";

const JOB_TIMEOUT_MS = 5 * 60_000;
const OUTPUT_CAP = 5_000_000;

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const once = process.argv.includes("--once");

// The environment wins over .env. .env values are read into this config only,
// never into process.env, so they aren't handed on to claude.
let fileEnv = {};
try {
  fileEnv = parseEnvFile(readFileSync(join(root, ".env"), "utf8"));
} catch {
  // No .env: everything must come from the environment.
}
const setting = (key) => process.env[key] ?? fileEnv[key];

const baseUrl = (setting("HOUSE_LIST_URL") || "http://localhost:3000").replace(/\/+$/, "");
const model = setting("HOUSE_LIST_CLAUDE_MODEL") || "sonnet";
const maxIdle = Number(setting("HOUSE_LIST_WORKER_MAX_IDLE")) || 60;

let token = setting("HOUSE_LIST_WORKER_TOKEN");
if (!token && setting("AUTH_SECRET")) {
  // The same derivation as computeWorkerToken in src/lib/auth.ts: only right
  // when this AUTH_SECRET is the app's, i.e. running against your local copy.
  token = createHmac("sha256", setting("AUTH_SECRET")).update("ai-worker").digest("hex");
}
if (!token) {
  console.error("Set HOUSE_LIST_WORKER_TOKEN (copy it from Settings → Ask Claude in the app).");
  process.exit(1);
}

const log = (...args) => console.log(`[${new Date().toLocaleTimeString("en-GB")}]`, ...args);

/**
 * Where the real claude executable is. On Windows npm installs a claude.cmd
 * shim, and Node can only start a .cmd through cmd.exe, which would put the
 * arguments through its parsing. So find claude.exe itself.
 */
function findClaude() {
  const configured = setting("HOUSE_LIST_CLAUDE_BIN");
  if (configured) return configured;
  if (process.platform !== "win32") return "claude";
  const dirs = (process.env.PATH ?? "").split(delimiter).filter(Boolean);
  for (const dir of dirs) {
    if (existsSync(join(dir, "claude.exe"))) return join(dir, "claude.exe");
    const npmExe = join(dir, "node_modules", "@anthropic-ai", "claude-code", "bin", "claude.exe");
    if (existsSync(join(dir, "claude.cmd")) && existsSync(npmExe)) return npmExe;
  }
  const native = join(process.env.USERPROFILE ?? "", ".local", "bin", "claude.exe");
  return existsSync(native) ? native : "claude.exe";
}

const claudeBin = findClaude();

async function api(path, body) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
    signal: AbortSignal.timeout(30_000),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    console.error(
      `${baseUrl} doesn't accept this worker token. Copy the token from Settings → Ask Claude in the app into HOUSE_LIST_WORKER_TOKEN.`,
    );
    process.exit(1);
  }
  if (!res.ok) throw new Error(data.error ?? `${res.status} ${res.statusText}`);
  return data;
}

let current = null;

/** Run claude on one prompt in an empty folder; resolves to its stdout. */
function runClaude(prompt) {
  return new Promise((resolve, reject) => {
    // An empty working folder, so there's nothing of this computer's for it to see.
    const cwd = mkdtempSync(join(tmpdir(), "house-list-ai-"));
    // A stub script (for testing) runs under this Node; anything else directly.
    const [command, args] = /\.(mjs|cjs|js)$/i.test(claudeBin)
      ? [process.execPath, [claudeBin, ...claudeArgs({ model })]]
      : [claudeBin, claudeArgs({ model })];
    const child = spawn(command, args, { cwd, stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
    current = child;
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, JOB_TIMEOUT_MS);
    child.stdout.on("data", (d) => {
      if (stdout.length < OUTPUT_CAP) stdout += d;
    });
    child.stderr.on("data", (d) => {
      if (stderr.length < OUTPUT_CAP) stderr += d;
    });
    const finish = () => {
      clearTimeout(timer);
      current = null;
      rmSync(cwd, { recursive: true, force: true });
    };
    child.on("error", (err) => {
      finish();
      reject(
        new Error(
          err.code === "ENOENT"
            ? `Couldn't find the claude CLI (${claudeBin}). Install Claude Code and log in, or set HOUSE_LIST_CLAUDE_BIN.`
            : `Couldn't start claude: ${err.message}`,
        ),
      );
    });
    child.on("close", (code) => {
      finish();
      if (timedOut) return reject(new Error("Claude took longer than five minutes, so it was stopped. Try again."));
      // A failed run still prints its JSON result (e.g. not logged in), so
      // read stdout first and only fall back to stderr.
      if (code !== 0 && !stdout.trim()) {
        return reject(new Error(stderr.trim().slice(0, 500) || `claude exited with code ${code}`));
      }
      resolve(stdout);
    });
    child.stdin.on("error", () => {});
    child.stdin.end(prompt);
  });
}

let working = null;

async function handle(claim) {
  const { job, item } = claim;
  working = job.id;
  log(`Researching “${item.title}” (${job.kind.toLowerCase().replace(/_/g, " ")})…`);
  const started = Date.now();
  let outcome;
  try {
    outcome = parseClaudeOutput(await runClaude(buildPrompt(claim)));
  } catch (err) {
    outcome = { ok: false, error: err.message };
  }
  const secs = Math.round((Date.now() - started) / 1000);
  try {
    await api(`/api/worker/jobs/${job.id}`, outcome);
    log(outcome.ok ? `Done in ${secs}s.` : `Failed after ${secs}s: ${outcome.error}`);
  } catch (err) {
    log(`Couldn't hand the answer back: ${err.message}`);
  }
  working = null;
}

// Stopping mid-job: say so, rather than leaving it "working" for ten minutes.
let stopping = false;
async function stop() {
  if (stopping) process.exit(1);
  stopping = true;
  current?.kill();
  if (working) {
    await api(`/api/worker/jobs/${working}`, { ok: false, error: "The worker was stopped before it finished. Try again." }).catch(
      () => {},
    );
  }
  process.exit(0);
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);

const sleep = (secs) => new Promise((r) => setTimeout(r, secs * 1000));

log(`Checking ${baseUrl} for questions${once ? " (once)" : ""}. Using ${claudeBin}, model ${model}.`);
let idle = 0;
for (;;) {
  let claim = null;
  try {
    claim = await api("/api/worker/claim");
  } catch (err) {
    // fetch's own message is just "fetch failed"; the cause says why (DNS, timeout, refused…).
    const why = err.cause?.code ?? err.cause?.message;
    log(`Couldn't reach the app: ${err.message}${why ? ` (${why})` : ""}.${once ? "" : " Trying again shortly."}`);
    if (once) process.exit(1);
  }
  if (claim?.job) {
    idle = 0;
    await handle(claim);
    continue;
  }
  if (once) {
    log("Nothing waiting.");
    break;
  }
  await sleep(idleDelay(idle++, { max: maxIdle }));
}
