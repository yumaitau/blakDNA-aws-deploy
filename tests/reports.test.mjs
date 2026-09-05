import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

test("scanner runs receive unique upload categories and source provenance excludes reports", () => {
  const directory = mkdtempSync(join(tmpdir(), "blakdna-reports-test-"));
  try {
    mkdirSync(join(directory, "reports/sarif"), { recursive: true });
    const names = ["checkov", "trivy-source", "trivy-terraform", "trivy-cloudformation", "trivy-helm"];
    for (const name of names) writeFileSync(join(directory, `reports/sarif/${name}.sarif`), JSON.stringify({ version: "2.1.0", runs: [{}, {}] }));
    writeFileSync(join(directory, "reports/source-sbom.cdx.json"), JSON.stringify({ bomFormat: "CycloneDX" }));
    writeFileSync(join(directory, "source.txt"), "synthetic-source");
    execFileSync(process.execPath, [resolve("scripts/verify-reports.mjs")], { cwd: directory });
    const categories = names.flatMap((name) => JSON.parse(readFileSync(join(directory, `reports/sarif/${name}.sarif`))).runs.map((scannerRun) => scannerRun.automationDetails.id));
    assert.equal(new Set(categories).size, 10);
    const provenance = JSON.parse(readFileSync(join(directory, "reports/source-provenance.json")));
    assert.equal(provenance.awsDeploymentVerified, false);
    assert.equal(provenance.files.length, 1);
    assert.equal(provenance.files[0].path, "source.txt");
    assert.match(provenance.files[0].sha256, /^[a-f0-9]{64}$/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
