# Security Policy

## Supported Versions

The `main` branch is the actively maintained version of TalkTree.

## Reporting a Vulnerability

Please do not report security issues in public GitHub issues.

Report privately by opening a GitHub security advisory for this repository, or email the maintainer listed on the GitHub profile if advisories are unavailable.

Include:

- A clear description of the issue.
- Steps to reproduce.
- Affected browser, OS, and provider configuration.
- Whether API keys, transcripts, exported media, or local files can be exposed.

## Security Model

The public GitHub Pages deployment is a static browser app:

- TalkTree does not ship a shared public API key.
- User-provided API keys are stored in the user's browser only.
- API keys are sent only to the configured OpenAI-compatible base URL.
- Local video files and transcripts are processed in the browser unless a user explicitly configures a provider endpoint.

Future server-side demo features must use secret storage, rate limits, abuse monitoring, and a public privacy note before launch.
