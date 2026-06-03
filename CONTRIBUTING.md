# Contributing to TalkTree

TalkTree is an open-source experiment in real-time thought trajectory visualization. Contributions are welcome when they make the project easier to use, safer to run, or clearer to maintain.

## Useful Contribution Areas

- Topic analysis quality: better local heuristics, prompt wording, and transition detection.
- Privacy and security: safer API-key handling, clearer provider configuration, dependency review.
- Accessibility: keyboard navigation, reduced-motion support, screen-reader labels, contrast improvements.
- Creator workflows: transcript import, SRT timing, transparent overlay export, editing-tool compatibility.
- Documentation: setup guides, examples, troubleshooting, bilingual documentation.

## Local Setup

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:5173/
```

Before opening a pull request:

```bash
npm run build
```

## Pull Request Guidelines

1. Keep changes focused. A PR should solve one issue or improve one workflow.
2. Explain user-facing behavior changes in the PR description.
3. Include screenshots or short recordings for UI changes.
4. Do not add shared API keys, secrets, server credentials, or telemetry.
5. Prefer browser-local behavior unless a server-side feature is explicitly discussed in an issue.

## Security-Sensitive Changes

TalkTree can store user-provided API configuration in browser storage. Any change touching provider configuration, local storage, transcript handling, export files, or future proxy code should explain the privacy/security impact in the PR.

If you find a vulnerability, do not open a public issue. Follow `SECURITY.md`.
