import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { prepare, deploy, destroy } from "../scripts/lifecycle.mjs";

test("synthetic deployment gates service enablement on successful preflight", async () => {
  for (const preflightExit of [1, 0]) {
    const temporary = mkdtempSync(join(tmpdir(), "blakdna-deployment-journey-"));
    const originalFetch = globalThis.fetch;
    try {
      const variables = join(temporary, "inputs.tfvars");
      writeFileSync(variables, "", { mode: 0o600 });
      const environment = {
        BLAKDNA_EXPECTED_AWS_ACCOUNT_ID: "111111111111",
        BLAKDNA_AWS_REGION: "ap-southeast-2",
        BLAKDNA_WORKDIR: join(temporary, "buyer"),
        BLAKDNA_TFVARS: variables,
        BLAKDNA_CONTAINER_IMAGE: `111111111111.dkr.ecr.us-east-1.amazonaws.com/validation-only@sha256:${"a".repeat(64)}`,
        BLAKDNA_DEPLOY_CONFIRM: "apply-buyer-stack",
      };
      const resources = {
        aws_account_id: environment.BLAKDNA_EXPECTED_AWS_ACCOUNT_ID,
        aws_region: environment.BLAKDNA_AWS_REGION,
        ecs_cluster_name: "synthetic-only",
        preflight_task_definition: "synthetic-preflight",
        application_subnet_ids: ["subnet-synthetic"],
        task_security_group_id: "sg-synthetic",
        application_url: "https://blakdna.example",
        database_identifier: "synthetic-database",
        data_key_arn: "arn:aws:kms:ap-southeast-2:111111111111:key/stack-key",
      };
      const calls = [];
      const execute = (command, argumentsList, directory) => {
        calls.push({ command, argumentsList });
        if (command === "terraform") {
          if (argumentsList[0] === "apply") writeFileSync(join(directory, "terraform.tfstate"), JSON.stringify({ lineage: "synthetic-lineage" }));
          if (argumentsList[0] === "output") return JSON.stringify(Object.fromEntries(Object.entries(resources).map(([key, value]) => [key, { value }])));
          return "";
        }
        if (argumentsList[0] === "sts") return environment.BLAKDNA_EXPECTED_AWS_ACCOUNT_ID;
        if (argumentsList[1] === "run-task") return JSON.stringify({ tasks: [{ taskArn: "synthetic-task" }] });
        if (argumentsList[1] === "describe-tasks") return JSON.stringify({ tasks: [{ containers: [{ exitCode: preflightExit }] }] });
        if (argumentsList[1] === "describe-db-snapshots") return JSON.stringify({ DBSnapshots: [{ Status: "available", DBInstanceIdentifier: resources.database_identifier, Encrypted: true, KmsKeyId: resources.data_key_arn, DBSnapshotArn: "arn:aws:rds:ap-southeast-2:111111111111:snapshot:synthetic" }] });
        return "{}";
      };
      let healthRequests = 0;
      globalThis.fetch = async () => {
        healthRequests += 1;
        return Response.json({ organism: "blakDNA", distribution: "aws-marketplace", license: { ready: true }, version: "synthetic" });
      };
      prepare(environment, execute);
      if (preflightExit) {
        await assert.rejects(deploy(environment, execute), /preflight failed/);
        assert.equal(healthRequests, 0);
        assert.ok(!calls.some(({ argumentsList }) => argumentsList.includes("-var=services_enabled=true")));
      } else {
        const result = await deploy(environment, execute);
        assert.equal(result.phase, "AWAITING_OWNER_BOOTSTRAP_AND_DURABLE_JOURNEY");
        assert.equal(healthRequests, 1);
        const preflightCheck = calls.findIndex(({ argumentsList }) => argumentsList[1] === "describe-tasks");
        const enableServices = calls.findIndex(({ argumentsList }) => argumentsList.includes("-var=services_enabled=true"));
        assert.ok(enableServices > preflightCheck);
        assert.ok(result.history.some(({ phase }) => phase === "PREFLIGHT_PASSED"));
        const beforeDestroy = calls.length;
        assert.throws(() => destroy({ ...environment, BLAKDNA_DESTROY_CONFIRM: `destroy:${result.runId}`, BLAKDNA_INDEPENDENT_BACKUP: "synthetic" }, execute), /independent retained key/);
        assert.ok(!calls.slice(beforeDestroy).some(({ command }) => command === "terraform"));
      }
      assert.equal(JSON.parse(readFileSync(join(environment.BLAKDNA_WORKDIR, "terraform/terraform.tfstate"), "utf8")).lineage, "synthetic-lineage");
    } finally {
      globalThis.fetch = originalFetch;
      rmSync(temporary, { recursive: true, force: true });
    }
  }
});
