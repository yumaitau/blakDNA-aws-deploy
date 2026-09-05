import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, isAbsolute } from "node:path";
import { pathToFileURL } from "node:url";
import { context, required, run } from "./lifecycle.mjs";

export function preflight(environment = process.env, execute = run) {
  const identity = context(environment, execute);
  const stackArn = required("BLAKDNA_STACK_ARN", environment);
  if (!stackArn.startsWith(`arn:aws:cloudformation:${identity.region}:${identity.account}:stack/`)) throw new Error("Stack ARN must belong to the approved account and Region");
  const stackName = stackArn.split("/")[1];
  if (required("BLAKDNA_PREFLIGHT_CONFIRM", environment) !== `preflight:${stackName}`) throw new Error("Explicit stack-specific preflight confirmation is required");
  const evidenceFile = required("BLAKDNA_PREFLIGHT_EVIDENCE", environment);
  if (!isAbsolute(evidenceFile) || existsSync(evidenceFile)) throw new Error("Use a new private absolute evidence file");
  const aws = (argumentsList) => JSON.parse(execute("aws", [...argumentsList, "--region", identity.region, "--output", "json"]));
  const stack = aws(["cloudformation", "describe-stacks", "--stack-name", stackArn]).Stacks?.[0];
  if (!stack || stack.StackId !== stackArn || !["CREATE_COMPLETE", "UPDATE_COMPLETE"].includes(stack.StackStatus)) throw new Error("Stack identity or stable state is unproven");
  const output = Object.fromEntries((stack.Outputs ?? []).map(({ OutputKey, OutputValue }) => [OutputKey, OutputValue]));
  for (const key of ["ClusterName", "WebServiceName", "WorkerServiceName", "PreflightTaskDefinition", "TaskSecurityGroupId", "ApplicationSubnets"]) {
    if (!output[key]) throw new Error(`Missing stack output ${key}`);
  }
  const current = aws(["ecs", "describe-services", "--cluster", output.ClusterName, "--services", output.WebServiceName, output.WorkerServiceName]);
  if (current.failures?.length || current.services?.length !== 2 || current.services.some((service) => service.desiredCount !== 0 || service.runningCount !== 0 || service.pendingCount !== 0)) throw new Error("Both services must be quiesced before preflight");
  const evidence = { ...identity, stackArn, taskDefinition: output.PreflightTaskDefinition, startedAt: new Date().toISOString(), phase: "STARTING" };
  writeFileSync(evidenceFile, JSON.stringify(evidence, null, 2), { flag: "wx", mode: 0o600 });
  const started = aws(["ecs", "run-task", "--cluster", output.ClusterName, "--task-definition", output.PreflightTaskDefinition, "--launch-type", "FARGATE", "--network-configuration", JSON.stringify({ awsvpcConfiguration: { subnets: output.ApplicationSubnets.split(","), securityGroups: [output.TaskSecurityGroupId], assignPublicIp: "DISABLED" } }), "--overrides", JSON.stringify({ containerOverrides: [{ name: "worker", command: ["node", "-e", readFileSync(new URL("./preflight.cjs", import.meta.url), "utf8")] }] })]);
  if (started.failures?.length || started.tasks?.length !== 1) throw new Error("Preflight task failed to start");
  evidence.taskArn = started.tasks[0].taskArn;
  evidence.phase = "RUNNING";
  writeFileSync(evidenceFile, JSON.stringify(evidence, null, 2));
  execute("aws", ["ecs", "wait", "tasks-stopped", "--cluster", output.ClusterName, "--tasks", evidence.taskArn, "--region", identity.region]);
  const stopped = aws(["ecs", "describe-tasks", "--cluster", output.ClusterName, "--tasks", evidence.taskArn]);
  const passed = !stopped.failures?.length && stopped.tasks?.length === 1 && stopped.tasks[0].containers?.length === 1 && stopped.tasks[0].containers[0].exitCode === 0;
  evidence.phase = passed ? "PREFLIGHT_PASSED_SERVICES_STILL_DISABLED" : "PREFLIGHT_FAILED";
  evidence.finishedAt = new Date().toISOString();
  writeFileSync(evidenceFile, JSON.stringify(evidence, null, 2));
  if (!passed) throw new Error("Licensing, migration or HTTP preflight failed; do not enable services");
  return evidence;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { console.log(JSON.stringify(preflight())); }
  catch { console.error("CloudFormation preflight stopped. Preserve private evidence and inspect the stack/task. Services were not enabled."); process.exitCode = 1; }
}
