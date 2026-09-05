# CloudFormation deployment

Preparation only. No real CloudFormation buyer deployment is certified yet.
Unlike Terraform, this template uses an existing VPC: two public ALB subnets,
two private application subnets with NAT egress, and two isolated data subnets.
The buyer owns route tables, subnet isolation and VPC flow logging.

It creates ECS, encrypted RDS, KMS, database Secrets Manager credentials, HTTPS
ALB, WAF, operational logs, alarms and DNS. Fixed resource names currently permit
one reference stack per account/Region. Use Terraform for isolated repeated tests.

## Prepare and inspect

Set the approved AWS profile and Region. Verify STS account identity before every
change. Create the runtime JSON secret described in [Operations](../OPERATIONS.md).
Copy parameters.example.json outside the checkout, replace every example,
include the approved image and SMTP relay network, and keep ServicesEnabled=false.

From repository root:

```sh
aws cloudformation validate-template \
  --template-body file://cloudformation/blakdna-fargate.yaml
aws cloudformation deploy \
  --stack-name blakdna-buyer \
  --template-file cloudformation/blakdna-fargate.yaml \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides file://"$HOME/blakdna-buyer/parameters.json" \
  --no-execute-changeset
```

Inspect the generated change set in the approved account. Execute only after
reviewing cost, IAM and topology; wait for CREATE_COMPLETE. Services remain
disabled. Do not enable them directly to bypass preflight.

## License, migration and HTTP preflight

Obtain the exact stack ARN from CloudFormation. Choose a new private evidence
path outside the checkout. The helper validates account/Region, stable stack
identity and zero desired/running/pending tasks before launching one preflight
task. It overrides only the worker command, preserving the image entrypoint.

```sh
export BLAKDNA_EXPECTED_AWS_ACCOUNT_ID=YOUR_APPROVED_ACCOUNT_ID
export BLAKDNA_AWS_REGION=ap-southeast-2
export BLAKDNA_STACK_ARN='YOUR_EXACT_STACK_ARN'
export BLAKDNA_PREFLIGHT_CONFIRM=preflight:blakdna-buyer
export BLAKDNA_PREFLIGHT_EVIDENCE="$HOME/blakdna-buyer/cfn-preflight.json"
node scripts/cloudformation-preflight.mjs
```

Expected phase: PREFLIGHT_PASSED_SERVICES_STILL_DISABLED. Failure leaves services
disabled and preserves evidence. Inspect the recorded task ARN and redacted logs.
A successful preflight is necessary but not sufficient for full readiness.

Only after success, create and review an update change set changing
ServicesEnabled to true with all other parameters preserved. Execute it and wait
for service stability. Verify real HTTPS health, owner bootstrap, scoped
observation ingestion and readback after task restart before declaring success.

See [Upgrade](../UPGRADE.md) and [Teardown](../TEARDOWN.md). RDS snapshot retention
and the data KMS key are retained on deletion/replacement, as is the ALB log
bucket. Retire them separately only after reviewing every dependent backup.

`ServicesEnabled` is a buyer-administered operational gate, not an IAM boundary.
CloudFormation cannot prevent an account administrator from editing this template
or updating the parameter directly. Such bypasses are unsupported. Constrain
stack updates to the buyer's reviewed deployment role/process. The supported
image entrypoint still enforces licensing and runs migrations before every
command; this template does not override it or expose migration-skip settings.
