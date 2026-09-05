#!/bin/sh
set -eu
mkdir -p reports/sarif
temporary="$(mktemp -d)"
trap 'rm -rf "$temporary"' EXIT HUP INT TERM
terraform -chdir=terraform fmt -check -recursive
terraform -chdir=terraform init -backend=false -input=false -lockfile=readonly
terraform -chdir=terraform validate
terraform -chdir=terraform test
tflint --chdir=terraform --minimum-failure-severity=warning
helm lint charts/blakdna --strict -f tests/validation-values.yaml
helm template blakdna charts/blakdna -f tests/validation-values.yaml > "$temporary/blakdna-rendered.yaml"
cfn-lint cloudformation/blakdna-fargate.yaml
shellcheck scripts/*.sh
BLAKDNA_ISOLATED_PREFLIGHT_TESTS=1 node --test tests/*.test.mjs
checkov --directory . --config-file .checkov.yaml -o cli -o sarif --output-file-path console,reports/sarif/checkov.sarif
gitleaks dir . --redact --no-banner
trivy fs --scanners vuln,secret --severity HIGH,CRITICAL --exit-code 1 --skip-dirs terraform/.terraform .
trivy config --severity HIGH,CRITICAL --exit-code 1 terraform
trivy config --severity HIGH,CRITICAL --exit-code 1 cloudformation
trivy config --severity HIGH,CRITICAL --exit-code 1 "$temporary/blakdna-rendered.yaml"
trivy fs --scanners vuln,secret --severity HIGH,CRITICAL --exit-code 1 --skip-dirs terraform/.terraform --format sarif --output reports/sarif/trivy-source.sarif .
trivy config --severity HIGH,CRITICAL --exit-code 1 --format sarif --output reports/sarif/trivy-terraform.sarif terraform
trivy config --severity HIGH,CRITICAL --exit-code 1 --format sarif --output reports/sarif/trivy-cloudformation.sarif cloudformation
trivy config --severity HIGH,CRITICAL --exit-code 1 --format sarif --output reports/sarif/trivy-helm.sarif "$temporary/blakdna-rendered.yaml"
trivy fs --format cyclonedx --skip-dirs terraform/.terraform --output reports/source-sbom.cdx.json .
node scripts/verify-reports.mjs
