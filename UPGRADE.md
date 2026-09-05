# Upgrade and rollback

No released upgrade pair or completed AWS upgrade proof is published yet.
Initial deployment health is not upgrade qualification.

1. Read release notes and migration compatibility. Record current image digest,
   task revisions, schema version and an organisation-scoped persisted object ID.
2. Back up PostgreSQL and the runtime encryption key separately. Prove a restore
   in isolation before material schema changes.
3. Obtain the approved immutable Marketplace ECR digest. Verify publisher release
   provenance and architecture support. Do not replace tags or use latest.
4. Schedule maintenance. Quiesce ingestion and workers before incompatible
   migrations. Do not assume an old process is safe against a new schema.
5. Review the Terraform plan or CloudFormation change set. Reject unrelated
   deletion/replacement. Keep services disabled during preflight.
6. Run the new image's licensing/migration/HTTP preflight as a one-off task in
   the same private network and roles. Require a successful exit before enabling
   new services. Preserve its task ARN and logs.
7. Wait for service stability. Verify HTTPS, expected version, worker health,
   unchanged tenant boundaries, and retrieval of the persisted object.
8. Restart tasks and repeat retrieval. Record old/new digests and evidence.

The initial deploy wrapper deliberately refuses to restart enabled stacks.
Automated upgrade orchestration and its durable journey test remain release
gates; do not work around that guard by editing the manifest.

For EKS, pre-install/pre-upgrade hooks run preflight before chart resources.
Existing workloads still require an explicit compatibility/maintenance decision.
Run Helm with reviewed private values and `--atomic --wait --timeout 15m`.
Helm rollback does not reverse database migrations.

Keep the previous digest available. Roll back application code only when the
schema is backward-compatible. Otherwise restore the validated backup to an
isolated database and follow recovery cutover; never silently overwrite
current evidence. Preserve failed upgrade logs and state.
