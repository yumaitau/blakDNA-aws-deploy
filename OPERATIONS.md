# Operations

## Runtime secret and owner bootstrap

Before deployment, create a buyer-owned Secrets Manager JSON secret containing:

| Key | Requirement |
| --- | --- |
| BETTER_AUTH_SECRET | Cryptographically random, at least 32 characters |
| BLAKDNA_ENCRYPTION_KEY | Exactly 32 random bytes encoded as base64 |
| HERMES_API_TOKEN | Outbound credential accepted by your Hermes endpoint |
| SMTP_HOST | TLS relay hostname, without scheme or port |
| SMTP_FROM | Verified sender address |
| SMTP_USER | Relay username; include empty string only if authentication is not required |
| SMTP_PASSWORD | Relay password; include empty string only if authentication is not required |

Generate values privately with a password manager or approved secret tooling.
Do not put secret values in Terraform variables, shell arguments, tickets or
source control. Templates inject JSON keys directly into web, worker and
preflight tasks. On ECS, RDS supplies its separately managed database password.
On EKS, the buyer's secret controller must also populate `DATABASE_PASSWORD`
(or the configured `runtimeSecret.databasePasswordKey`) in that same Kubernetes
Secret from the external database credential. The chart does not copy the RDS
password or create the Secret. Verify all eight keys before installation.
If the runtime secret uses a customer KMS key, grant decrypt only on that key.

SMTP uses implicit TLS on port 465. Set Terraform `smtp_relay_cidrs` or CloudFormation
`SmtpRelayCidr` to the relay's approved IPv4 networks and maintain them when
the relay changes addresses. Unrestricted SMTP egress is rejected.
Notification destination validation uses
the configured SMTP hostname; do not replace it with a wildcard. The public
HTTPS origin becomes BETTER_AUTH_URL and must match buyer DNS and certificate.

Create the owner account through the application, verify its email, sign in,
then create the organisation. Organisation identity lives in PostgreSQL.
Create separate ingestion and MCP purpose credentials through authenticated
administration; record ownership, scope and expiry.

HERMES_API_TOKEN is outbound authentication, not a substitute for inbound
MCP credentials. Legacy environment-only ingestion/MCP tokens are not the
production authentication path. Never configure a shared fixed organisation ID.

## Health and evidence

GET /api/health must return HTTP 200, organism blakDNA, distribution
aws-marketplace and license.ready true. This proves readiness, not the full
organism journey or storage durability.

Inspect ECS desired/running counts, target health, web/worker log groups,
WAF logs, VPC flow logs and RDS events. For EKS inspect rollout, hook Jobs,
Pod events, readiness and logs. Avoid copying raw logs into public issues.

Record the image digest, task ARN, UTC timestamp, redacted health result and
tenant-scoped persisted object IDs. Prove readback after task restart.
A successful write response alone is not persistence proof.

## Backup and recovery

RDS automated backups are encrypted. Preserve PostgreSQL backups, runtime
encryption key, authentication secret, Terraform state and approved configuration
under separate restricted retention policies. A snapshot is unusable after its
KMS key is deleted. Before teardown, copy backups under an independent retained key.

Recovery drill:

1. Restore a tested backup into isolated data subnets with a restricted DB group.
2. Supply restored credentials and the original runtime encryption key privately.
3. Start an isolated licensed application revision compatible with the schema.
4. Verify HTTPS and retrieve historical observations, evidence and genome state.
5. Confirm tenant boundaries and that outbound notifications cannot reach real
   recipients during the drill.
6. Record recovery time, data-loss interval and evidence before production cutover.

Test restoration quarterly and before material upgrades. Successful backup jobs
alone do not prove recoverability.

## Rotation and onboarding

Preserve BLAKDNA_ENCRYPTION_KEY across redeployments and upgrades. Changing it
without a supported re-encryption migration makes stored credentials unreadable.
Authentication secret changes can invalidate sessions; schedule deliberately.

Rotate outbound Hermes tokens and inbound purpose credentials independently.
RDS manages password generation; coordinate rotation with a controlled rollout
and verify fresh connections. Do not place static AWS keys in runtime secrets.

For AWS sensing, use a dedicated read-only role scoped to approved accounts and
services, not the deployment administrator or ECS execution role. Start with the
specific APIs required by the enabled collector. Review its effective policy and
audit CloudTrail. Do not attach destructive remediation permissions by default.

For GitHub, use a dedicated app installation restricted to selected repositories
and read-only metadata/configuration permissions required by the collector.
Store its credential through authenticated connector configuration. Expand
permissions only after reviewing a concrete missing capability. Never paste
tokens into issues, sample payloads or Hermes prompts.

## Incidents

License failures must fail closed. Distinguish entitlement/access failures from
transient checkout errors. Preserve deployment digests and redacted logs.
Do not disable licensing or broaden IAM as a recovery shortcut.

Consequential remediation needs human approval by default. Preserve evidence,
record concise reasoning summaries and action outcomes, and independently verify
the resulting environmental change.
