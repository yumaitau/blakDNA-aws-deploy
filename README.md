# blakDNA AWS deployment

Public buyer-facing infrastructure for blakDNA. **Status: preparation in progress.**
No deployment release, approved image digest or live Marketplace offer is
published here yet. These templates are not production-verified.

## Subscription and image

The intended delivery is a customer-hosted AWS Marketplace container contract,
not SaaS. A buyer must hold the matching entitlement and pull an approved
immutable Marketplace ECR digest. Product identity is embedded in the image;
runtime settings cannot replace or disable licensing.

Do not use another product's offer, ECR repository or product identity.
Evaluation enquiries: [Yuma IT](https://www.yumait.com.au/contact).
The publisher must supply the blakDNA listing, approved offer and image before
any real deployment. Availability, supported Regions and both native image
architectures remain release-verification gates. Terraform and CloudFormation
currently target Linux x86_64 Fargate.

## Fastest safe path

1. Obtain the approved subscription and immutable image.
2. Prepare buyer AWS credentials, DNS, ACM HTTPS certificate, a reachable Hermes
   endpoint, TLS SMTP relay and runtime secret.
3. Follow [Terraform](terraform/README.md) to prepare a new private workspace.
4. Apply with services disabled; require licensing, migration and HTTP preflight.
5. Create and verify the owner account; create the organisation and purpose-scoped
   API credentials through the application.
6. Prove observation ingestion, investigation, human response, remediation,
   restart persistence and learning before declaring success.

Alternative paths: [CloudFormation](cloudformation/README.md) for an existing
three-tier VPC; [EKS Helm](charts/blakdna/README.md) for buyer-provisioned cluster
and external dependencies. These are separate operating models.

## Architecture and responsibility

```text
Buyer identity / DNS / HTTPS
              |
       ALB + WAF (public subnets)
              |
     web + worker (private subnets) ----- Hermes (buyer-controlled)
              |
     PostgreSQL RDS (isolated subnets)
              |
  authoritative temporal state and evidence

Secrets Manager + KMS: runtime secrets and encryption
CloudWatch + private S3: operational logs and audit support
```

| Area | Publisher | Buyer |
| --- | --- | --- |
| Application | Licensed image, migrations, release evidence | Approved version and rollout |
| AWS | Reference templates | Account, network, costs, IAM, backups and recovery |
| Data | Application schema and isolation controls | Ownership, retention, access and restore proof |
| Hermes | Scoped MCP contract | Endpoint, models, tokens, tool policy and availability |
| Sensors | Normalisation contracts | Least-privilege source access and consent |
| Remediation | Recommendations and verification | Approval of consequential actions |

PostgreSQL remains authoritative. Hermes reasons through scoped interfaces;
it is not a publisher-hosted control plane. This public repository contains
deployment material only, not private application history, prompts, credentials
or customer evidence.

## Operations and release gates

- [Operations, secrets and recovery](OPERATIONS.md)
- [Upgrade and rollback](UPGRADE.md)
- [Guarded teardown](TEARDOWN.md)

AWS costs include Fargate, Multi-AZ RDS, NAT gateways, ALB, WAF, KMS, logs,
backups and data transfer. Marketplace and model usage are separate charges.
Obtain a region-specific estimate and set buyer budgets before applying.

Current validation is not a real AWS deployment. Release requires green security
CI, entitled image pull and startup, HTTPS, independently verified persistence,
restart/upgrade proof, network inspection and scoped teardown evidence.
No release tag should be published until those gates pass.

## Validation

Pushes and trusted same-repository pull requests run
[security CI](.github/workflows/security.yml): Terraform fmt/init/validate/tests,
TFLint, Helm lint/render, CloudFormation lint, ShellCheck, lifecycle tests,
Checkov, Gitleaks and Trivy dependency/secret/configuration scans. External
forks do not execute on organisation self-hosted runners.

The isolated validation container uses synthetic data and receives no AWS
credentials. It does not apply infrastructure or pull Marketplace images.
Resource-specific scanner exceptions are documented beside the resource;
there is no global skipped-check list.

## Product and support

Learn the product at [blakdna-landing.pages.dev](https://blakdna-landing.pages.dev).
Public marketing source: [yumaitau/blakDNA-landing](https://github.com/yumaitau/blakDNA-landing).
The website is live; the deployment pack remains preparation-only.

Support and private security reports: support@yumait.com.au.
Never paste credentials, Terraform state, customer evidence or unredacted
scanner output into public issues.
