import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

test("isolated preflight accepts licensed HTTP readiness and rejects internal or unlicensed images", { skip: process.env.BLAKDNA_ISOLATED_PREFLIGHT_TESTS !== "1" }, () => {
  const temporary = mkdtempSync(join(tmpdir(), "blakdna-preflight-test-"));
  try {
    for (const health of [
      { organism: "blakDNA", distribution: "internal", license: { ready: true } },
      { organism: "blakDNA", distribution: "aws-marketplace", license: { ready: false } },
      { organism: "blakDNA", distribution: "aws-marketplace", license: { ready: true } },
    ]) {
      writeFileSync(join(temporary, "server.js"), `require("node:http").createServer((request,response)=>response.end(${JSON.stringify(JSON.stringify(health))})).listen(3000,"127.0.0.1");`);
      const execute = () => execFileSync(process.execPath, [resolve("scripts/preflight.cjs")], { cwd: temporary, encoding: "utf8", stdio: "pipe", timeout: 15_000 });
      if (health.distribution === "aws-marketplace" && health.license.ready) assert.match(execute(), /Preflight passed/);
      else assert.throws(execute);
    }
  } finally { rmSync(temporary, { recursive: true, force: true }); }
});
