# Security Policy

## Supported Versions

SpecGantry is a prompt-based framework. The `main` branch is the only actively maintained version. Security issues should be reported against the latest state of `main`.

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

If you discover a security vulnerability — including but not limited to prompt injection patterns in skill files, logic that could be exploited to cause unintended AI behavior, or sensitive data exposure risks — please report it privately using **GitHub's private vulnerability reporting** feature:

1. Go to the [Security tab](../../security) of this repository.
2. Click **"Report a vulnerability"**.
3. Provide a clear description of the issue, steps to reproduce, and potential impact.

The maintainer will acknowledge receipt and respond with next steps. Please allow reasonable time for the issue to be assessed and addressed before any public disclosure.

## Scope

Given the nature of this project (markdown-based prompt files, no runtime code), the most relevant security concerns are:

- **Prompt injection** — skill or configuration files that could be manipulated to override intended AI behavior in harmful ways.
- **Sensitive data leakage** — patterns in prompts or artifacts that could cause the AI to expose or mishandle sensitive user data.
- **Dependency on third-party services** — this project relies on Claude Code (Anthropic). Vulnerabilities in that platform are out of scope here and should be reported to Anthropic directly.

## Disclaimer

This project is provided "as is" with no warranty. See [LICENSE](LICENSE) for full terms. Security patches are provided on a best-effort basis by the maintainer.
