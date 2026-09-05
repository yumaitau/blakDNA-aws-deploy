#!/bin/sh
set -eu
checksums="$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)/validation-tool-checksums.txt"
architecture="$(uname -m)"
case "$architecture" in
  x86_64) architecture=amd64; gitleaks_architecture=x64 ;;
  aarch64) architecture=arm64; gitleaks_architecture=arm64 ;;
  *) echo 'Unsupported validation architecture' >&2; exit 1 ;;
esac
temporary="$(mktemp -d)"
trap 'rm -rf "$temporary"' EXIT HUP INT TERM
cd "$temporary"
fetch() { curl --proto '=https' --proto-redir '=https' --fail --silent --show-error --location --retry 3 "$1" --output "$2"; }
verify() {
  checksum="$(awk -v file="$1" '$2 == file || $2 == "*" file {print $1}' "$checksums")"
  test "${#checksum}" -eq 64
  printf '%s  %s\n' "$checksum" "$1" | sha256sum --check --strict
}
archive="terraform_1.15.8_linux_${architecture}.zip"
fetch "https://releases.hashicorp.com/terraform/1.15.8/$archive" "$archive"
verify "$archive"
unzip -q "$archive" terraform
install -m 755 terraform /usr/local/bin/terraform
archive="tflint_linux_${architecture}.zip"
fetch "https://github.com/terraform-linters/tflint/releases/download/v0.64.0/$archive" "$archive"
verify "$archive"
unzip -q "$archive" tflint
install -m 755 tflint /usr/local/bin/tflint
archive="helm-v3.21.4-linux-${architecture}.tar.gz"
fetch "https://get.helm.sh/$archive" "$archive"
verify "$archive"
tar -xzf "$archive" "linux-${architecture}/helm"
install -m 755 "linux-${architecture}/helm" /usr/local/bin/helm
archive="gitleaks_8.30.1_linux_${gitleaks_architecture}.tar.gz"
fetch "https://github.com/gitleaks/gitleaks/releases/download/v8.30.1/$archive" "$archive"
verify "$archive"
tar -xzf "$archive" gitleaks
install -m 755 gitleaks /usr/local/bin/gitleaks
case "$architecture" in amd64) trivy_architecture=64bit ;; arm64) trivy_architecture=ARM64 ;; esac
archive="trivy_0.74.0_Linux-${trivy_architecture}.tar.gz"
fetch "https://github.com/aquasecurity/trivy/releases/download/v0.74.0/$archive" "$archive"
verify "$archive"
tar -xzf "$archive" trivy
install -m 755 trivy /usr/local/bin/trivy
