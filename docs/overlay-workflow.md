# Video Overlay Workflow

TalkTree can generate a transparent thought-tree overlay from a local video and transcript.

## Input Formats

Recommended input order:

1. A local video file.
2. An SRT or WebVTT subtitle file pasted into the transcript box.
3. Plain transcript text if no timing file is available.

Supported timed subtitle patterns:

- Standard SRT blocks with numeric cue IDs.
- WebVTT files with a `WEBVTT` header.
- Time lines with comma or dot milliseconds.
- Time lines with optional cue settings after the end time.
- SRT-like input where blank lines between cues are missing.

Examples:

```text
1
00:00:01,000 --> 00:00:04,500
Today I want to discuss creator workflows.

2
00:00:04.500 --> 00:00:08.000 position:50%
First, script planning. Then overlay export.
```

## Plain Transcript Fallback

If no timed cues are found, TalkTree splits text by punctuation and line breaks, then distributes segments across the video duration. This keeps the workflow usable when a creator only has a rough transcript.

## Timeline Normalization

Timed cues are normalized before analysis:

- Sorted by start time.
- Clamped to the video duration when available.
- Given at least 500 ms of display time.
- Trimmed when overlapping the next cue.
- Duplicate cue starts with identical text are removed.

## Exported Files

`talktree-events.json` includes:

- `version`
- `generatedAt`
- `source`: `ai` or `local-demo`
- `duration`
- `cues`

`talktree-overlay.webm` contains the transparent tree layer for editing software. Put it above the original video track.

## Limitations

- Browser WebM transparency support varies.
- Very dense subtitle files may create too many tree events.
- Local demo mode is useful for preview but not semantic-grade analysis.
- Provider-backed analysis depends on the configured model and relay quality.
