import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("buyer README leads to the live product website without implying release readiness", async () => {
  const readme = await readFile("README.md", "utf8");
  assert.ok(readme.includes("https://blakdna-landing.pages.dev"));
  assert.ok(readme.includes("preparation in progress"));
  const response = await fetch("https://blakdna-landing.pages.dev", { signal: AbortSignal.timeout(20_000) });
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.ok(html.includes("https://github.com/yumaitau/blakDNA-aws-deploy"));
  assert.ok(html.includes("cyber DNA"));
});
