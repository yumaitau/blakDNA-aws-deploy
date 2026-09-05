# Contributing

Use a branch and pull request. Keep changes limited to public buyer-facing
infrastructure, documentation, scripts and synthetic validation data. Do not
copy private app files, source history, prompts or internal fixtures here.

For each change, describe the buyer journey, acceptance criteria, failure modes
and evidence. Add automated tests for complete supported journeys, including
negative cases and safe recovery. Static tests do not substitute for AWS proof.

Run the same isolated validation container used by CI:

```sh
docker build -f Dockerfile.validation -t blakdna-buyer-validation .
docker run --rm blakdna-buyer-validation
```

The container receives no cloud credentials and must not mount a Docker socket.
Use a native architecture. Preserve failures; do not mask scanner exit codes.
Format Terraform before proposing changes. Full-history Gitleaks runs separately
in trusted CI because the image deliberately excludes .git.

External contributions require maintainer source review before a trusted branch
can run on organisation self-hosted runners. Do not use pull_request_target to
execute contributor code with privileged access.

Reviewers must examine public-source boundaries, IAM, network defaults, state
preservation, provenance, migrations and consequential actions. Green CI is not
independent approval. Never merge while relevant required checks are failing.
