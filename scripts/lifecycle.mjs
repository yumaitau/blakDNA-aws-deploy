import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repository = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const imagePattern = /^[0-9]{12}\.dkr\.ecr\.[a-z0-9-]+\.amazonaws\.com\/.+@sha256:[a-f0-9]{64}$/;

export function required(name, environment = process.env) {
  const value = environment[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

export function approvedImage(value) {
  if (!imagePattern.test(value)) throw new Error("An approved immutable Marketplace ECR digest is required");
  return value;
}

export function run(command, argumentsList, cwd) {
  return execFileSync(command, argumentsList, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 32 * 1024 * 1024 });
}

export function context(environment = process.env, execute = run) {
  const account = required("BLAKDNA_EXPECTED_AWS_ACCOUNT_ID", environment);
  const region = required("BLAKDNA_AWS_REGION", environment);
  if (!/^[0-9]{12}$/.test(account) || !/^[a-z]{2}-[a-z]+-\d$/.test(region)) throw new Error("Invalid expected AWS account or Region");
  const actual = execute("aws", ["sts", "get-caller-identity", "--query", "Account", "--output", "text", "--region", region]).trim();
  if (actual !== account) throw new Error("AWS account mismatch; refusing resource access");
  return { account, region };
}

function save(directory, manifest, phase) {
  if (manifest.phase !== phase) manifest.history.push({ phase, timestamp: new Date().toISOString() });
  manifest.phase = phase;
  manifest.updatedAt = new Date().toISOString();
  writeFileSync(join(directory, "deployment.json"), JSON.stringify(manifest, null, 2), { mode: 0o600 });
}

export function prepare(environment = process.env, execute = run) {
  const identity = context(environment, execute);
  const supplied = required("BLAKDNA_WORKDIR", environment);
  if (!isAbsolute(supplied)) throw new Error("BLAKDNA_WORKDIR must be an absolute new directory");
  const directory = join(realpathSync(dirname(supplied)), supplied.split("/").at(-1));
  const fromRepository = relative(repository, directory);
  if (!(fromRepository === ".." || fromRepository.startsWith(`..${sep}`)) || existsSync(directory)) throw new Error("Use a new isolated workspace outside this repository");
  const variables = realpathSync(required("BLAKDNA_TFVARS", environment));
  if (!statSync(variables).isFile() || (statSync(variables).mode & 0o077) !== 0) throw new Error("Buyer tfvars must be a private regular file (chmod 600)");
  const manifest = { ...identity, directory, runId: `b${randomBytes(4).toString("hex")}`, image: approvedImage(required("BLAKDNA_CONTAINER_IMAGE", environment)), createdAt: new Date().toISOString(), history: [] };
  mkdirSync(directory, { mode: 0o700 });
  save(directory, manifest, "PREPARING");
  mkdirSync(join(directory, "terraform"), { mode: 0o700 });
  mkdirSync(join(directory, "scripts"), { mode: 0o700 });
  for (const filename of readdirSync(join(repository, "terraform"))) {
    if (filename.endsWith(".tf") || filename === ".terraform.lock.hcl") copyFileSync(join(repository, "terraform", filename), join(directory, "terraform", filename));
  }
  copyFileSync(join(repository, "scripts/preflight.cjs"), join(directory, "scripts/preflight.cjs"));
  writeFileSync(join(directory, "terraform/buyer.tfvars"), readFileSync(variables), { mode: 0o600 });
  save(directory, manifest, "PREPARED");
  return manifest;
}

export function loadDeployment(environment = process.env, execute = run) {
  const identity = context(environment, execute);
  const directory = realpathSync(required("BLAKDNA_WORKDIR", environment));
  const manifest = JSON.parse(readFileSync(join(directory, "deployment.json"), "utf8"));
  if (manifest.directory !== directory || manifest.account !== identity.account || manifest.region !== identity.region || !/^b[a-f0-9]{8}$/.test(manifest.runId)) {
    throw new Error("Workspace provenance does not match the approved account, Region and path");
  }
  approvedImage(manifest.image);
  return { directory, manifest, execute };
}

function aws(deployment, argumentsList) {
  return JSON.parse(deployment.execute("aws", [...argumentsList, "--region", deployment.manifest.region, "--output", "json"], deployment.directory));
}

function terraform(deployment, argumentsList) {
  const stateFile = join(deployment.directory, "terraform/terraform.tfstate");
  if (deployment.manifest.lineage && !existsSync(stateFile)) throw new Error("Terraform state is missing; restore the original state before continuing");
  if (existsSync(stateFile)) {
    const lineage = JSON.parse(readFileSync(stateFile, "utf8")).lineage;
    if (!lineage || lineage !== deployment.manifest.lineage) throw new Error("Terraform state lineage changed; refusing workspace mutation");
  }
  return deployment.execute("terraform", argumentsList, join(deployment.directory, "terraform"));
}

function variables(deployment) {
  return ["-var-file=buyer.tfvars", `-var=aws_region=${deployment.manifest.region}`, `-var=expected_account_id=${deployment.manifest.account}`, "-var=name_prefix=blakdna", `-var=environment=${deployment.manifest.runId}`, `-var=container_image=${deployment.manifest.image}`];
}

function applyPlan(deployment, name, extra = []) {
  terraform(deployment, ["plan", "-input=false", `-out=${name}.tfplan`, ...variables(deployment), ...extra]);
  try { terraform(deployment, ["apply", "-input=false", `${name}.tfplan`]); }
  finally {
    const stateFile = join(deployment.directory, "terraform/terraform.tfstate");
    if (existsSync(stateFile) && !deployment.manifest.lineage) {
      deployment.manifest.lineage = JSON.parse(readFileSync(stateFile, "utf8")).lineage;
      save(deployment.directory, deployment.manifest, deployment.manifest.phase);
    }
  }
}

function outputs(deployment) {
  const output = JSON.parse(terraform(deployment, ["output", "-json"]));
  const values = Object.fromEntries(Object.entries(output).map(([key, item]) => [key, item.value]));
  if (values.aws_account_id !== deployment.manifest.account || values.aws_region !== deployment.manifest.region) throw new Error("Terraform state identity mismatch");
  return values;
}

export async function verifyHealth(origin) {
  const url = new URL(origin);
  if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw new Error("Health verification requires a trusted HTTPS origin");
  const response = await fetch(new URL("/api/health", url), { redirect: "error", signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error("HTTPS health is not ready");
  const health = await response.json();
  if (health.organism !== "blakDNA" || health.distribution !== "aws-marketplace" || health.license?.ready !== true) throw new Error("Marketplace license readiness is not proven");
  return { origin: url.origin, distribution: health.distribution, version: health.version, verifiedAt: new Date().toISOString() };
}

export async function deploy(environment = process.env, execute = run) {
  if (required("BLAKDNA_DEPLOY_CONFIRM", environment) !== "apply-buyer-stack") throw new Error("Explicit apply-buyer-stack confirmation is required");
  const deployment = loadDeployment(environment, execute);
  const { directory, manifest } = deployment;
  if (!["PREPARED", "PLANNING", "INFRASTRUCTURE_CREATED_SERVICES_DISABLED", "PREFLIGHT_STARTED", "PREFLIGHT_PASSED"].includes(manifest.phase)) throw new Error("Initial deployment cannot restart an enabled or retiring stack; use the upgrade runbook");
  const resumingPreflight = ["PREFLIGHT_STARTED", "PREFLIGHT_PASSED"].includes(manifest.phase);
  if (!resumingPreflight) {
    save(directory, manifest, "PLANNING");
    terraform(deployment, ["init", "-input=false", "-backend=false"]);
    applyPlan(deployment, "bootstrap", ["-var=services_enabled=false"]);
  }
  const resources = outputs(deployment);
  if (!resumingPreflight) {
    manifest.resources = resources;
    save(directory, manifest, "INFRASTRUCTURE_CREATED_SERVICES_DISABLED");
    manifest.preflightRequest = {
      cluster: resources.ecs_cluster_name,
      taskDefinition: resources.preflight_task_definition,
      launchType: "FARGATE",
      clientToken: randomBytes(16).toString("hex"),
      networkConfiguration: { awsvpcConfiguration: { subnets: resources.application_subnet_ids, securityGroups: [resources.task_security_group_id], assignPublicIp: "DISABLED" } },
    };
    manifest.preflightRequestedAt = new Date().toISOString();
    save(directory, manifest, "PREFLIGHT_STARTED");
  }
  if (!manifest.preflightRequest || manifest.preflightRequest.taskDefinition !== resources.preflight_task_definition || manifest.preflightRequest.cluster !== resources.ecs_cluster_name) throw new Error("Preflight request provenance is missing or changed; inspect the recorded task manually");
  if (!manifest.preflightTaskArn) {
    const requestAge = Date.now() - Date.parse(manifest.preflightRequestedAt);
    if (!Number.isFinite(requestAge) || requestAge < 0 || requestAge > 30 * 60 * 1000) throw new Error("Preflight request is outside the safe retry window; inspect ECS before continuing");
    const started = aws(deployment, ["ecs", "run-task", "--cli-input-json", JSON.stringify(manifest.preflightRequest)]);
    if (started.failures?.length || started.tasks?.length !== 1 || !started.tasks[0].taskArn) throw new Error("Preflight task could not start; services remain disabled");
    manifest.preflightTaskArn = started.tasks[0].taskArn;
    save(directory, manifest, "PREFLIGHT_STARTED");
  }
  deployment.execute("aws", ["ecs", "wait", "tasks-stopped", "--cluster", resources.ecs_cluster_name, "--tasks", manifest.preflightTaskArn, "--region", manifest.region], directory);
  const stopped = aws(deployment, ["ecs", "describe-tasks", "--cluster", resources.ecs_cluster_name, "--tasks", manifest.preflightTaskArn]);
  if (stopped.failures?.length || stopped.tasks?.length !== 1 || stopped.tasks[0].containers?.length !== 1 || stopped.tasks[0].containers[0].exitCode !== 0) {
    throw new Error("Licensing/migration/HTTP preflight failed; services remain disabled");
  }
  save(directory, manifest, "PREFLIGHT_PASSED");
  save(directory, manifest, "ENABLING_SERVICES");
  applyPlan(deployment, "enable-services", ["-var=services_enabled=true"]);
  manifest.health = await verifyHealth(resources.application_url);
  save(directory, manifest, "AWAITING_OWNER_BOOTSTRAP_AND_DURABLE_JOURNEY");
  return manifest;
}

export function expectAwsAbsent(deployment, argumentsList, expectedCode) {
  try { aws(deployment, argumentsList); }
  catch (error) {
    if (typeof error.stderr === "string" && error.stderr.includes(`(${expectedCode})`)) return;
    throw new Error("AWS absence is unproven: access, credentials or transport failure");
  }
  throw new Error("A stack-owned resource still exists");
}

export function destroy(environment = process.env, execute = run) {
  const deployment = loadDeployment(environment, execute);
  const { directory, manifest } = deployment;
  if (required("BLAKDNA_DESTROY_CONFIRM", environment) !== `destroy:${manifest.runId}`) throw new Error("Explicit per-workspace destroy confirmation is required");
  if (!manifest.resources) throw new Error("No verified resource inventory; inspect the preserved workspace manually");
  const resources = manifest.resources;
  if (environment.BLAKDNA_DISPOSABLE_TEST !== `test-data-only:${manifest.runId}`) {
    const backup = aws(deployment, ["rds", "describe-db-snapshots", "--db-snapshot-identifier", required("BLAKDNA_INDEPENDENT_BACKUP", environment)]).DBSnapshots?.[0];
    if (!backup || backup.Status !== "available" || backup.DBInstanceIdentifier !== resources.database_identifier || backup.Encrypted !== true || !backup.KmsKeyId || backup.KmsKeyId === resources.data_key_arn || !backup.DBSnapshotArn?.startsWith(`arn:aws:rds:${manifest.region}:${manifest.account}:snapshot:`)) {
      throw new Error("A verified available backup encrypted with an independent retained key is required");
    }
    const key = aws(deployment, ["kms", "describe-key", "--key-id", backup.KmsKeyId]).KeyMetadata;
    if (!key || key.KeyState !== "Enabled" || key.DeletionDate || key.Arn !== backup.KmsKeyId) throw new Error("Backup encryption key must be enabled and not pending deletion");
    manifest.independentBackupArn = backup.DBSnapshotArn;
  }
  const deleteLogs = environment.BLAKDNA_DELETE_STACK_LOGS === `delete:${manifest.runId}`;
  const removal = ["-var=services_enabled=false", "-var=database_deletion_protection=false", "-var=load_balancer_deletion_protection=false", `-var=force_destroy_log_bucket=${deleteLogs}`];
  save(directory, manifest, "TEARDOWN_REQUESTED");
  applyPlan(deployment, "remove-protection", removal);
  terraform(deployment, ["plan", "-destroy", "-input=false", "-out=destroy.tfplan", ...variables(deployment), ...removal]);
  terraform(deployment, ["apply", "-input=false", "destroy.tfplan"]);
  if (terraform(deployment, ["state", "list"]).trim()) throw new Error("Terraform state still tracks resources");
  expectAwsAbsent(deployment, ["rds", "describe-db-instances", "--db-instance-identifier", resources.database_identifier], "DBInstanceNotFound");
  expectAwsAbsent(deployment, ["ec2", "describe-vpcs", "--vpc-ids", resources.vpc_id], "InvalidVpcID.NotFound");
  expectAwsAbsent(deployment, ["elbv2", "describe-load-balancers", "--load-balancer-arns", resources.load_balancer_arn], "LoadBalancerNotFound");
  expectAwsAbsent(deployment, ["s3api", "head-bucket", "--bucket", resources.alb_log_bucket, "--expected-bucket-owner", manifest.account], "404");
  const cluster = aws(deployment, ["ecs", "describe-clusters", "--clusters", resources.ecs_cluster_name]);
  if (!((cluster.clusters?.length === 1 && cluster.clusters[0].status === "INACTIVE") || (cluster.clusters?.length === 0 && cluster.failures?.length === 1 && cluster.failures[0].reason === "MISSING"))) throw new Error("ECS cluster absence is unproven");
  manifest.retention = "Final RDS snapshots and scheduled KMS deletion may remain; review retention separately. The workspace and evidence are preserved.";
  save(directory, manifest, "PRIMARY_RESOURCES_ABSENCE_VERIFIED");
  return manifest;
}

async function main() {
  const command = process.argv[2];
  const result = command === "prepare" ? prepare() : command === "deploy" ? await deploy() : command === "destroy" ? destroy() : null;
  if (!result) throw new Error("Use prepare, deploy or destroy; see the buyer runbook");
  console.log(JSON.stringify({ workspace: result.directory, runId: result.runId, phase: result.phase }));
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(() => { console.error("Lifecycle stopped. Preserve the workspace and Terraform state; inspect the last recorded phase. No automatic cleanup ran."); process.exitCode = 1; });
}
