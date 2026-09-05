import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("buyer artifacts preserve entrypoints, credential privacy and sensitive-file exclusions", () => {
  for (const filename of [".dockerignore", ".gitignore"]) assert.ok(readFileSync(filename, "utf8").includes("*.tfvars.json"));
  const cloudformation = readFileSync("cloudformation/blakdna-fargate.yaml", "utf8");
  assert.doesNotMatch(cloudformation, /SampledRequestsEnabled: true/);
  assert.match(cloudformation, /RedactedFields:.*Name: cookie/);
  assert.match(cloudformation, /DataKey:\n\s+Type: AWS::KMS::Key\n\s+DeletionPolicy: Retain\n\s+UpdateReplacePolicy: Retain/);
  assert.doesNotMatch(cloudformation, /EntryPoint:|SKIP_DB_MIGRATE/);
  const terraform = readFileSync("terraform/load-balancer.tf", "utf8");
  assert.doesNotMatch(terraform, /sampled_requests_enabled\s*=\s*true/);
  assert.match(terraform, /single_header \{ name = "cookie" \}/);
  for (const filename of ["charts/blakdna/templates/preflight.yaml", "charts/blakdna/templates/deployments.yaml"]) {
    assert.doesNotMatch(readFileSync(filename, "utf8"), /^\s+command:|SKIP_DB_MIGRATE/m);
  }
  const checksums = readFileSync("scripts/validation-tool-checksums.txt", "utf8").trim().split("\n");
  assert.equal(checksums.length, 10);
  assert.ok(checksums.every((line) => /^[a-f0-9]{64}  [A-Za-z0-9_.-]+$/.test(line)));
});
