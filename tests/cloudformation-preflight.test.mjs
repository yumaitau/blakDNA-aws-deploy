import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { preflight } from "../scripts/cloudformation-preflight.mjs";

test("CloudFormation preflight requires idle services and never enables them", () => {
  const temporary = mkdtempSync(join(tmpdir(), "blakdna-cfn-test-"));
  try {
    const environment = {
      BLAKDNA_EXPECTED_AWS_ACCOUNT_ID: "111111111111",
      BLAKDNA_AWS_REGION: "ap-southeast-2",
      BLAKDNA_STACK_ARN: "arn:aws:cloudformation:ap-southeast-2:111111111111:stack/synthetic/identifier",
      BLAKDNA_PREFLIGHT_CONFIRM: "preflight:synthetic",
    };
    for (const [desiredCount, exitCode] of [[1, 0], [0, 1], [0, 0]]) {
      environment.BLAKDNA_PREFLIGHT_EVIDENCE = join(temporary, `${desiredCount}-${exitCode}.json`);
      const calls = [];
      const execute = (command, argumentsList) => {
        calls.push(argumentsList);
        if (argumentsList[0] === "sts") return "111111111111";
        if (argumentsList[1] === "describe-stacks") return JSON.stringify({ Stacks: [{ StackId: environment.BLAKDNA_STACK_ARN, StackStatus: "CREATE_COMPLETE", Outputs: ["ClusterName", "WebServiceName", "WorkerServiceName", "PreflightTaskDefinition", "TaskSecurityGroupId", "ApplicationSubnets"].map((key) => ({ OutputKey: key, OutputValue: `synthetic-${key}` })) }] });
        if (argumentsList[1] === "describe-services") return JSON.stringify({ services: Array.from({ length: 2 }, () => ({ desiredCount, runningCount: 0, pendingCount: 0 })) });
        if (argumentsList[1] === "run-task") return JSON.stringify({ tasks: [{ taskArn: "synthetic-task" }] });
        if (argumentsList[1] === "describe-tasks") return JSON.stringify({ tasks: [{ containers: [{ exitCode }] }] });
        return "{}";
      };
      if (desiredCount) {
        assert.throws(() => preflight(environment, execute), /quiesced/);
        assert.ok(!calls.some((argumentsList) => argumentsList[1] === "run-task"));
      } else if (exitCode) {
        assert.throws(() => preflight(environment, execute), /preflight failed/);
        assert.equal(JSON.parse(readFileSync(environment.BLAKDNA_PREFLIGHT_EVIDENCE)).phase, "PREFLIGHT_FAILED");
      } else {
        assert.equal(preflight(environment, execute).phase, "PREFLIGHT_PASSED_SERVICES_STILL_DISABLED");
        assert.throws(() => preflight(environment, execute), /new private absolute evidence/);
      }
      assert.ok(!calls.some((argumentsList) => argumentsList[1] === "update-service"));
    }
  } finally { rmSync(temporary, { recursive: true, force: true }); }
});
