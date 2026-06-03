# Provider Configuration and API-Key Safety

TalkTree supports bring-your-own-key provider configuration for OpenAI-compatible chat completion endpoints. This document explains exactly where the key is stored, where requests are sent, and what contributors should avoid changing without review.

## Public GitHub Pages Demo

The public demo at `https://bobobo2026.github.io/TalkTree/` is a static browser app.

- It does not include a shared API key.
- It does not run a TalkTree backend server.
- It stores user-provided configuration in the user's browser only.
- It sends provider requests directly to the configured `Base URL`.

## Stored Browser Configuration

TalkTree stores settings under the browser-local key:

```text
talktree-config
```

The stored fields include:

- `apiKey`
- `baseUrl`
- `model`
- `transcriptionModel`
- `realtimeModel`
- `lastVerifiedAt`

Users can remove the local key from the settings dialog with **Clear Local Key**.

## Request Destinations

In the public static app, provider requests go to:

```text
{normalizedBaseUrl}/models
{normalizedBaseUrl}/chat/completions
{normalizedBaseUrl}/audio/transcriptions
```

The API key is sent as:

```text
Authorization: Bearer {apiKey}
```

Users should only configure a `Base URL` they trust. A malicious or misconfigured relay can receive the API key and transcript content.

## Local Development Proxy

When running on `localhost` or `127.0.0.1`, TalkTree can route provider requests through local paths:

```text
/api/provider/models
/api/provider/chat/completions
/api/provider/audio/transcriptions
```

In that mode, the configured provider base URL is passed with:

```text
X-Provider-Base-URL
```

This is for local development only. It is not part of the GitHub Pages deployment.

## Contributor Rules

Do not add:

- Shared public API keys in frontend code.
- API keys in screenshots, fixtures, issues, pull requests, or recordings.
- Automatic upload of transcripts or videos to maintainer-controlled servers.
- New server-side demo proxy behavior without rate limits, secret storage, abuse monitoring, and a public privacy note.

Security-sensitive pull requests should explain changes to:

- Local storage behavior.
- Provider request URLs.
- Headers carrying API keys.
- Transcript, SRT, video, or overlay export handling.
- Any future backend/proxy code.

## Threat Model

Current primary risks:

- User configures an untrusted relay and sends it the API key.
- User shares a screenshot or issue containing a secret.
- A future hosted proxy stores provider keys or transcript content without clear controls.
- A dependency or UI change accidentally expands where provider data is sent.

TalkTree's default static deployment intentionally avoids a maintainer-controlled backend to keep this risk small.
