# blakDNA AWS deployment

Public buyer-facing deployment repository for blakDNA.

**Status: preparation in progress. No deployment release or live Marketplace offer is available from this repository yet. Do not treat this placeholder as an installable or production-verified package.**

The planned package includes Terraform and CloudFormation for customer-hosted ECS Fargate, an EKS Helm chart, least-privilege onboarding, licensing preflight, persistence verification, upgrades, backup/restore, and guarded teardown.

The application and authoritative PostgreSQL state belong in the buyer's approved AWS environment. Hermes uses scoped interfaces. This repository will not contain private application source, source history, customer data, credentials, or unpublished Marketplace identifiers.

Current information and evaluation enquiries: https://www.yumait.com.au/contact

The public marketing repository is [yumaitau/blakDNA-landing](https://github.com/yumaitau/blakDNA-landing). Production site and release links will be added only after verification.

Never paste secrets or customer evidence into public issues. Contact support@yumait.com.au for private security reporting.
