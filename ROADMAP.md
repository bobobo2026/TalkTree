# Roadmap

TalkTree is maintained as a small, focused open-source project. The current priority is to make the live text-to-tree workflow dependable before expanding into heavier media or hosted AI features.

## Current Focus

- Improve topic transition detection for mixed Chinese/English transcripts.
- Make the local demo mode more useful without requiring an API key.
- Strengthen API-key safety and provider configuration guidance.
- Improve video overlay export reliability for common editing tools.
- Add more examples for creators using system dictation or external speech-to-text tools.

## Near-Term Milestones

### 0.2.0: Maintainer-Ready Foundation

- Add issue templates, contribution docs, and security policy.
- Add CI build validation for pull requests.
- Document known limitations and troubleshooting paths.
- Publish a stable GitHub Pages demo.

### 0.3.0: Better Analysis Quality

- Improve local topic-drift heuristics.
- Add sample transcripts and expected tree-event outputs.
- Make prompt configuration easier to inspect and tune.

### 0.4.0: Creator Overlay Workflow

- Improve SRT import edge cases.
- Add overlay export presets.
- Document editing workflows for common video tools.

## Not Planned Yet

- A shared public API key in the frontend.
- Uploading private transcripts to a maintainer-controlled server by default.
- Provider-specific lock-in.

These are intentionally deferred because TalkTree's default mode should remain inspectable, private, and easy to run as a static app.
