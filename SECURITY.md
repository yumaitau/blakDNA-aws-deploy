# Security policy

Report suspected vulnerabilities privately to support@yumait.com.au.
Include affected commit, reproducible steps using synthetic data, impact and
redacted evidence. Never include credentials, state files or customer data.
Do not open a public issue containing an unremediated exploit or sensitive logs.

This repository is preparation-only; no supported deployment release is declared.
Security fixes target main until a supported-release policy is published.
There is no promised response-time SLA at this stage.

The public boundary excludes private application source/history, prompts,
publisher credentials and customer identifiers. Changes require a pull request,
green checks and explicit review. External forks cannot execute on self-hosted
runners. Never add AWS credentials to static validation CI.

Scanner exceptions must be narrow, justified beside the affected resource,
and reviewed when tools or cloud capabilities change. Do not suppress all
high/critical findings, disable licensing or weaken account/state safeguards.
