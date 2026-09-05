# Scoped teardown

**Warning:** Teardown permanently removes application infrastructure and can
make data or evidence unrecoverable. Preserve a tested backup and its encryption
keys before proceeding. Never delete Terraform state to recover from an error.

## Terraform wrapper

Use the original AWS profile, account, Region and `BLAKDNA_WORKDIR`.
Read `deployment.json` privately to identify its `runId`.
The wrapper checks STS identity, workspace provenance and state lineage before
mutation. It never auto-removes the workspace.

For real data, copy an available encrypted RDS snapshot to an independent
retained KMS key in the approved account/Region. Test restoration and retain
the runtime encryption secret separately. A snapshot encrypted by this stack's
key is insufficient: Terraform schedules that key for deletion.

```sh
export BLAKDNA_INDEPENDENT_BACKUP='YOUR_VERIFIED_SNAPSHOT_IDENTIFIER'
export BLAKDNA_DESTROY_CONFIRM='destroy:YOUR_RUN_ID'
node scripts/lifecycle.mjs destroy
```

The snapshot must match the recorded database, be available and encrypted,
belong to the approved account/Region, and use a different key. The wrapper
does not prove restoration or key retention; those remain operator gates.

Only a disposable synthetic test environment may use this alternative:

```sh
export BLAKDNA_DISPOSABLE_TEST='test-data-only:YOUR_RUN_ID'
export BLAKDNA_DESTROY_CONFIRM='destroy:YOUR_RUN_ID'
node scripts/lifecycle.mjs destroy
```

Log deletion is not implicit. Archive logs first. If their deletion is approved,
set `BLAKDNA_DELETE_STACK_LOGS=delete:YOUR_RUN_ID`; otherwise a non-empty log
bucket can block destroy. The wrapper disables services and deletion protections,
applies a saved destroy plan, and checks empty state plus scoped RDS, VPC, ALB,
S3 and ECS absence. Access-denied, expired credentials and transport failures
are failures, never evidence of absence.

Expected phase: `PRIMARY_RESOURCES_ABSENCE_VERIFIED`. Final snapshots, independent
backups and pending KMS deletions may remain. Review these separately against
retention policy. Empty state alone does not prove a clean account.

## CloudFormation

Protect a separately encrypted, tested backup before disabling database and ALB
deletion protection. Inspect a change set for the exact stack, then delete that
stack only. RDS has snapshot retention; account for encryption-key retention.
The data KMS key and ALB log bucket have Retain policies on deletion and
replacement. Verify stack deletion and each removed resource independently,
and record the retained key, snapshots and bucket as a separate inventory.
Retire a key only after every encrypted backup is no longer needed. Resolve
retained log objects and versions explicitly; do not empty unrelated buckets.

## Helm

`helm uninstall blakdna --namespace blakdna` removes chart workloads, not the
buyer-managed database, secrets, IRSA, DNS or ingress controller. Hook Jobs may
remain; inspect their release labels and delete only approved release-owned
Jobs. Handle external dependencies under their separate retention policy.
