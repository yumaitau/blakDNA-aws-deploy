# EKS deployment

Preparation only; no approved image or EKS deployment proof is published yet.
The chart deploys web and worker workloads plus licensing/migration/HTTP
preflight. It does not provision a cluster, PostgreSQL, DNS, HTTPS controller,
backups, runtime Secret, service account, IRSA role or network policies.

Create those dependencies before installing. The pre-install hook requires
an existing service account and Secret; creating them inside this chart would
be too late. Attach [License Manager permissions](../../iam-policy.json) to
the buyer-managed IRSA role. Restrict its trust to the exact namespace/service
account and approve only additional permissions actually needed.

The Secret needs DATABASE_PASSWORD plus all seven runtime keys listed in
[Operations](../../OPERATIONS.md). Use a buyer-approved secret controller.
Never commit secret values. Set publicOrigin to the real HTTPS origin;
organisation identity is created through application onboarding, not values.yaml.

Create a private values file containing the approved image repository/digest,
existing serviceAccount.name, runtimeSecret.name, database endpoint, publicOrigin,
Hermes base URL and ingress configuration appropriate to the chosen controller.

From repository root:

```sh
helm lint charts/blakdna --strict -f "$HOME/blakdna-buyer/eks-values.yaml"
helm template blakdna charts/blakdna -f "$HOME/blakdna-buyer/eks-values.yaml"
helm upgrade --install blakdna charts/blakdna \
  --namespace blakdna --atomic --wait --timeout 15m \
  -f "$HOME/blakdna-buyer/eks-values.yaml"
```

Review rendered resources before applying. The namespace and external dependencies
must already exist. Tests' validation-only image must never be deployed.
Both Deployment replica counts default to zero. After a successful preparation
hook, explicitly set `web.replicas: 1` and `worker.replicas: 1` in the reviewed
private values and run the same upgrade command. That upgrade repeats preflight
before starting services. Do not declare application readiness at zero replicas.
For upgrades, existing workloads still need a schema-compatibility decision;
a Helm hook is not a maintenance policy.

Pods use non-root execution, read-only root filesystems, dropped capabilities,
seccomp, probes, resource limits and disruption budgets. Buyer cluster policy
must enforce destination-scoped egress, database isolation and HTTPS. Kubernetes
Secret encoding is not encryption; enable encryption at rest and restrictive RBAC.

Retain preflight logs as evidence. Hook Jobs are deleted before the next hook
creation, not automatically on uninstall; inspect and clean only this release's
Jobs. See [teardown](../../TEARDOWN.md) and [upgrades](../../UPGRADE.md).

The supported image entrypoint must finish licensing and database migrations
before executing the supplied command. The chart supplies `args`, never an
entrypoint override, and exposes no migration-skip setting. The HTTP hook starts
the server only after that entrypoint has completed. Its isolated tests prove
HTTP acceptance/rejection, not real database migration; the published image and
buyer deployment must independently prove the startup contract before release.
