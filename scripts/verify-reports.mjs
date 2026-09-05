import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

for (const name of ["checkov", "trivy-source", "trivy-terraform", "trivy-cloudformation", "trivy-helm"]) {
  const report = JSON.parse(readFileSync(`reports/sarif/${name}.sarif`, "utf8"));
  assert.equal(report.version, "2.1.0", `${name}: invalid SARIF version`);
  assert.ok(report.runs?.length > 0, `${name}: missing scanner run`);
  report.runs.forEach((scannerRun, index) => {
    scannerRun.automationDetails = { ...scannerRun.automationDetails, id: `${name}-${index}/` };
  });
  writeFileSync(`reports/sarif/${name}.sarif`, JSON.stringify(report));
}
const sbom = JSON.parse(readFileSync("reports/source-sbom.cdx.json", "utf8"));
assert.equal(sbom.bomFormat, "CycloneDX");

function inventory(directory) {
  return readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name)).flatMap((entry) => {
    if ([".git", ".terraform", "reports", ".DS_Store"].includes(entry.name) || entry.name.startsWith("._")) return [];
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return inventory(path);
    if (!entry.isFile()) throw new Error("Source inventory cannot contain special files or symbolic links");
    return [{ path, sha256: createHash("sha256").update(readFileSync(path)).digest("hex") }];
  });
}
const commit = process.env.BLAKDNA_SOURCE_COMMIT;
if (commit) assert.match(commit, /^[a-f0-9]{40}$/);
writeFileSync("reports/source-provenance.json", JSON.stringify({
  kind: "unsigned-validation-record",
  repository: "https://github.com/yumaitau/blakDNA-aws-deploy",
  commit: commit ?? null,
  generatedAt: new Date().toISOString(),
  architecture: process.arch,
  awsDeploymentVerified: false,
  privateImageDependenciesAttested: false,
  files: inventory("."),
}, null, 2));
console.log("Five SARIF reports, source SBOM and unsigned source inventory verified.");
