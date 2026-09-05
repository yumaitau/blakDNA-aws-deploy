# Terraform deployment

Preparation only. No approved image or completed AWS buyer proof is published yet.
Read [prerequisites](../README.md) and [runtime secrets](../OPERATIONS.md) first.

This module creates a dedicated three-tier VPC, HTTPS ALB and Route 53 alias,
private Fargate web/worker tasks, private PostgreSQL RDS, WAF, KMS, logs,
alarms, and ALB access-log storage. PostgreSQL stores authoritative observations,
evidence and organisational state. The log bucket is not an evidence database.

## Prepare isolated state

Requirements: Terraform 1.15.8 or compatible, Node.js 24, AWS CLI v2, renewed
buyer credentials, an ACM certificate and Route 53 zone, a reachable buyer
Hermes endpoint, and the runtime Secrets Manager JSON described in Operations.
The default Region is `ap-southeast-2`; certificate, secrets and resources must
match your selected Region. Static validation does not prove Marketplace availability.

From the repository root, create a private input file outside the checkout:

```sh
umask 077
mkdir -p "$HOME/blakdna-buyer"
cp terraform/terraform.tfvars.example "$HOME/blakdna-buyer/inputs.tfvars"
chmod 600 "$HOME/blakdna-buyer/inputs.tfvars"
```

Edit every example value. `container_image` intentionally has no default.
Use only a publisher-approved Marketplace ECR digest; syntactic validation
does not verify publisher ownership or entitlement. Set `expected_account_id`
to the buyer account. Terraform itself refuses any other account.

```sh
export AWS_PROFILE=marketplace-buyer
export BLAKDNA_EXPECTED_AWS_ACCOUNT_ID=YOUR_APPROVED_ACCOUNT_ID
export BLAKDNA_AWS_REGION=ap-southeast-2
export BLAKDNA_WORKDIR="$HOME/blakdna-buyer/first-deployment"
export BLAKDNA_TFVARS="$HOME/blakdna-buyer/inputs.tfvars"
export BLAKDNA_CONTAINER_IMAGE='APPROVED_MARKETPLACE_ECR@sha256:APPROVED_DIGEST'
node scripts/lifecycle.mjs prepare
```

Expected phase: `PREPARED`. The directory must be new. The wrapper copies
templates, inputs and preflight code, assigns a unique resource suffix, and
records account/Region/path provenance. No resources are created by prepare.
Never put this directory in source control.

## Apply and preflight

The following command creates billable infrastructure in the approved account.
Review the input file and cost drivers before confirming:

```sh
export BLAKDNA_DEPLOY_CONFIRM=apply-buyer-stack
node scripts/lifecycle.mjs deploy
```

First apply keeps both services at zero. A one-off task runs the image's
licensing entrypoint and migrations, then proves local Marketplace HTTP
readiness. Only a zero exit enables services. The wrapper then verifies
real HTTPS health. Internal or unlicensed images cannot pass preflight.

Expected phase: `AWAITING_OWNER_BOOTSTRAP_AND_DURABLE_JOURNEY`.
This is not full deployment success: complete owner onboarding, ingest an
observation, restart services, and retrieve the same organisation-scoped
state before recording persistence proof. This remains a release gate.

On failure, state and plans remain. No automatic destroy runs.
Recorded state lineage cannot be replaced or silently lost. Once service
enablement begins, initial deployment cannot be rerun; follow the upgrade
runbook or inspect the partial apply. Never copy unrelated Terraform state.

## Network and durability

Restrict `allowed_ingress_cidrs`. World-open ingress fails unless the buyer
explicitly enables `allow_internet_ingress`. Tasks have no public IPs; RDS
is private. Outbound HTTPS and TLS SMTP permit AWS, Hermes and the configured
relay. Buyer network policy must constrain destinations where required.

The example selects per-AZ NAT and Multi-AZ RDS. A single NAT reduces cost but
adds an AZ dependency. Deletion protection, backups and final snapshots are
enabled. RDS manages its password; runtime secret values are not Terraform
inputs. Treat all state and plan files as sensitive regardless.

See [Operations](../OPERATIONS.md), [Upgrade](../UPGRADE.md) and
[guarded teardown](../TEARDOWN.md). Never delete state after a failed apply.
