import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { approvedImage, context, prepare, deploy, destroy, expectAwsAbsent } from "../scripts/lifecycle.mjs";

const image = `111111111111.dkr.ecr.us-east-1.amazonaws.com/validation-only@sha256:${"a".repeat(64)}`;
const identity = { BLAKDNA_EXPECTED_AWS_ACCOUNT_ID: "111111111111", BLAKDNA_AWS_REGION: "ap-southeast-2" };

test("account identity and immutable-image guards fail before mutation", () => {
  assert.throws(() => context(identity, () => "222222222222"), /account mismatch/);
  for (const value of ["ghcr.io/example/app:latest", "111111111111.dkr.ecr.us-east-1.amazonaws.com/example:latest", ""]) assert.throws(() => approvedImage(value));
  assert.equal(approvedImage(image), image);
});

test("a failed deployment preserves its workspace and refuses unrelated teardown", async () => {
  const temporary = mkdtempSync(join(tmpdir(), "blakdna-lifecycle-test-"));
  try {
    const variables = join(temporary, "inputs.tfvars");
    writeFileSync(variables, "container_image = \"\"\n", { mode: 0o600 });
    const environment = { ...identity, BLAKDNA_WORKDIR: join(temporary, "buyer"), BLAKDNA_TFVARS: variables, BLAKDNA_CONTAINER_IMAGE: image, BLAKDNA_DEPLOY_CONFIRM: "apply-buyer-stack" };
    const calls = [];
    const execute = (command, argumentsList) => {
      calls.push([command, ...argumentsList]);
      if (command === "aws") return identity.BLAKDNA_EXPECTED_AWS_ACCOUNT_ID;
      if (argumentsList[0] === "plan") throw new Error("Synthetic provider outage");
      return "";
    };
    prepare(environment, execute);
    await assert.rejects(deploy(environment, execute), /provider outage/);
    assert.ok(existsSync(join(environment.BLAKDNA_WORKDIR, "terraform/buyer.tfvars")));
    assert.equal(JSON.parse(readFileSync(join(environment.BLAKDNA_WORKDIR, "deployment.json"), "utf8")).phase, "PLANNING");
    assert.ok(!calls.some((argumentsList) => argumentsList[0] === "terraform" && argumentsList[1] === "apply"));
    assert.throws(() => prepare(environment, execute), /new isolated workspace/);
    assert.throws(() => destroy({ ...environment, BLAKDNA_DESTROY_CONFIRM: "destroy:unrelated" }, execute), /confirmation/);
    writeFileSync(join(environment.BLAKDNA_WORKDIR, "terraform/terraform.tfstate"), JSON.stringify({ lineage: "unrelated-stack" }), { mode: 0o600 });
    await assert.rejects(deploy(environment, execute), /state lineage changed/);
    rmSync(join(environment.BLAKDNA_WORKDIR, "terraform/terraform.tfstate"));
    const marker = join(environment.BLAKDNA_WORKDIR, "deployment.json");
    const manifest = JSON.parse(readFileSync(marker, "utf8"));
    manifest.lineage = "original-stack";
    writeFileSync(marker, JSON.stringify(manifest));
    await assert.rejects(deploy(environment, execute), /state is missing/);
    manifest.phase = "AWAITING_OWNER_BOOTSTRAP_AND_DURABLE_JOURNEY";
    writeFileSync(marker, JSON.stringify(manifest));
    const previousCalls = calls.length;
    await assert.rejects(deploy(environment, execute), /cannot restart/);
    assert.equal(calls.slice(previousCalls).filter(([command]) => command === "terraform").length, 0);
  } finally { rmSync(temporary, { recursive: true, force: true }); }
});

test("AWS absence requires the specific not-found response, not access or transport errors", () => {
  const deployment = { manifest: { region: "ap-southeast-2" }, directory: tmpdir(), execute: () => { throw Object.assign(new Error("AWS error"), { stderr: "An error occurred (DBInstanceNotFound)" }); } };
  expectAwsAbsent(deployment, ["rds", "describe-db-instances"], "DBInstanceNotFound");
  for (const code of ["AccessDenied", "ExpiredToken", "RequestTimeout"]) {
    deployment.execute = () => { throw Object.assign(new Error("AWS error"), { stderr: `An error occurred (${code})` }); };
    assert.throws(() => expectAwsAbsent(deployment, ["rds", "describe-db-instances"], "DBInstanceNotFound"), /absence is unproven/);
  }
  deployment.execute = () => "{}";
  assert.throws(() => expectAwsAbsent(deployment, ["rds", "describe-db-instances"], "DBInstanceNotFound"), /still exists/);
});

test("the standalone Helm preflight is identical to the buyer preflight", () => {
  assert.equal(readFileSync("scripts/preflight.cjs", "utf8"), readFileSync("charts/blakdna/files/preflight.cjs", "utf8"));
});
