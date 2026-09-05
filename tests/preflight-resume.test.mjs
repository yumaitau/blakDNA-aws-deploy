import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { prepare, deploy } from "../scripts/lifecycle.mjs";

test("deployment resumes a recorded task or retries the identical idempotent request", async () => {
  for (const interruption of ["run-task", "wait"]) {
    const temporary = mkdtempSync(join(tmpdir(), "blakdna-resume-test-"));
    const originalFetch = globalThis.fetch;
    try {
      writeFileSync(join(temporary, "inputs.tfvars"), "", { mode: 0o600 });
      const environment = { BLAKDNA_EXPECTED_AWS_ACCOUNT_ID: "111111111111", BLAKDNA_AWS_REGION: "ap-southeast-2", BLAKDNA_WORKDIR: join(temporary, "buyer"), BLAKDNA_TFVARS: join(temporary, "inputs.tfvars"), BLAKDNA_CONTAINER_IMAGE: `111111111111.dkr.ecr.us-east-1.amazonaws.com/validation-only@sha256:${"a".repeat(64)}`, BLAKDNA_DEPLOY_CONFIRM: "apply-buyer-stack" };
      const resources = { aws_account_id: "111111111111", aws_region: "ap-southeast-2", ecs_cluster_name: "synthetic", preflight_task_definition: "synthetic-preflight", application_subnet_ids: ["subnet-synthetic"], task_security_group_id: "sg-synthetic", application_url: "https://blakdna.example" };
      const requests = [];
      let interrupted = false;
      let bootstrapApplies = 0;
      const execute = (command, argumentsList, directory) => {
        if (command === "terraform") {
          if (argumentsList[0] === "apply") {
            if (argumentsList.includes("bootstrap.tfplan")) bootstrapApplies += 1;
            writeFileSync(join(directory, "terraform.tfstate"), JSON.stringify({ lineage: "synthetic-lineage" }));
          }
          if (argumentsList[0] === "output") return JSON.stringify(Object.fromEntries(Object.entries(resources).map(([key, value]) => [key, { value }])));
          return "";
        }
        if (argumentsList[0] === "sts") return "111111111111";
        if (argumentsList[1] === "run-task") requests.push(argumentsList[3]);
        if (argumentsList[1] === interruption && !interrupted) { interrupted = true; throw new Error("Synthetic interrupted response"); }
        if (argumentsList[1] === "run-task") return JSON.stringify({ tasks: [{ taskArn: "synthetic-existing-task" }] });
        if (argumentsList[1] === "describe-tasks") return JSON.stringify({ tasks: [{ containers: [{ exitCode: 0 }] }] });
        return "{}";
      };
      globalThis.fetch = async () => Response.json({ organism: "blakDNA", distribution: "aws-marketplace", license: { ready: true } });
      prepare(environment, execute);
      await assert.rejects(deploy(environment, execute), /interrupted response/);
      const checkpoint = JSON.parse(readFileSync(join(environment.BLAKDNA_WORKDIR, "deployment.json")));
      assert.equal(checkpoint.phase, "PREFLIGHT_STARTED");
      assert.ok(checkpoint.preflightRequest.clientToken);
      assert.equal((await deploy(environment, execute)).phase, "AWAITING_OWNER_BOOTSTRAP_AND_DURABLE_JOURNEY");
      assert.equal(bootstrapApplies, 1);
      assert.equal(new Set(requests).size, 1);
      assert.equal(requests.length, interruption === "wait" ? 1 : 2);
    } finally { globalThis.fetch = originalFetch; rmSync(temporary, { recursive: true, force: true }); }
  }
});
