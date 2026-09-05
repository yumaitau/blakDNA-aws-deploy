const { spawn } = require("node:child_process");
const { setTimeout: delay } = require("node:timers/promises");

async function main() {
  const server = spawn(process.execPath, ["server.js"], { stdio: "inherit", env: { ...process.env, HOSTNAME: "0.0.0.0", PORT: "3000" } });
  let exited = false;
  server.on("exit", () => { exited = true; });
  server.on("error", () => { exited = true; });
  try {
    for (let attempt = 0; attempt < 90; attempt++) {
      if (exited) throw new Error("Preflight server exited before licensing readiness");
      let health;
      try {
        const response = await fetch("http://127.0.0.1:3000/api/health", { redirect: "error", signal: AbortSignal.timeout(1000) });
        if (response.ok) health = await response.json();
      } catch {}
      if (health) {
        if (health.organism !== "blakDNA" || health.distribution !== "aws-marketplace" || health.license?.ready !== true) {
          throw new Error("Preflight refused an unlicensed or non-Marketplace runtime");
        }
        console.log("Preflight passed: Marketplace licensing, migrations and HTTP readiness");
        return;
      }
      await delay(1000);
    }
    throw new Error("Preflight readiness timed out");
  } finally {
    server.kill("SIGTERM");
    for (let attempt = 0; attempt < 20 && !exited; attempt++) await delay(100);
    if (!exited) server.kill("SIGKILL");
  }
}
main().catch(() => { console.error("Preflight failed; services must remain disabled. Inspect the scoped task logs."); process.exitCode = 1; });
