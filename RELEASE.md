# Release policy

No deployment release is published yet. Main contains preparation work, not a
qualified AWS Marketplace installation. Never create a release tag merely to
make a placeholder look installable.

Before the first release, record:

1. Public deployment commit, reviewed PR and green security CI run.
2. Approved blakDNA Marketplace offer, buyer entitlement and immutable ECR digest.
3. Native supported image architectures, publisher image scans, SBOM and provenance.
4. Real buyer Terraform apply, licensing/migration preflight and HTTPS proof.
5. AWS/GitHub organism journey and durable readback after restart and upgrade.
6. Network isolation inspection, independently tested backups and guarded teardown.
7. Exact resource-scoped absence checks and separately retained backup/key inventory.

Never publish subscription credentials, license-consumption tokens, customer
identifiers, Terraform state or raw customer evidence. Redact release records.
Retain private originals under the operator's audit policy.

Image tags are immutable. Publish approved digest pins only after the true buyer
journey passes. Deployment template versions and image versions are separate;
document their compatibility and rollback constraints explicitly.

Generate a checksummed artifact inventory from the release commit and attach
the CI-generated source SBOM/provenance alongside publisher image evidence.
CI verifies five SARIF files and a CycloneDX source SBOM, and generates an
unsigned source-file checksum inventory tied to the CI commit and native
architecture. This is validation provenance, not a signed publisher image
attestation. Source SBOMs cannot attest to private image dependencies.
Release qualification and real buyer proof remain open first-release gates.
