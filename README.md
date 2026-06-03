# TalkTree

![CI](https://github.com/bobobo2026/TalkTree/actions/workflows/ci.yml/badge.svg)
![GitHub Pages](https://github.com/bobobo2026/TalkTree/actions/workflows/pages.yml/badge.svg)
![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)

TalkTree is a real-time thought trajectory visualizer. It listens to a growing text stream and renders your expression as a small tree: the trunk grows when the thought continues, and branches appear when the topic shifts, explores a side path, or returns to a previous thread.

TalkTree is designed for creators, vloggers, speakers, ADHD-style divergent thinkers, and anyone who wants to see how their ideas move while they talk or write.

中文：TalkTree 是一个实时表达轨迹可视化工具。你可以把语音输入法、系统听写、豆包输入法或直接打字产生的文本放进文本监听框，TalkTree 会判断表达模式、主题轨迹和话题跳转，并用一棵不断生长和分叉的小树展示出来。

## Project Status

TalkTree is actively maintained as a small open-source project by [bobobo2026](https://github.com/bobobo2026). The current public demo is a static GitHub Pages app with no bundled shared API key.

Maintainer focus:

- Review issues and pull requests for topic-analysis quality, privacy, accessibility, and creator workflows
- Keep the public demo buildable and deployable from `main`
- Document security-sensitive behavior around API keys, transcripts, browser storage, and provider calls
- Maintain a roadmap for local demo quality, OpenAI-compatible analysis, and video overlay export

## Try It

The public demo is available at:

https://bobobo2026.github.io/TalkTree/

You can try TalkTree without an API key. In that case it runs in **Local Demo Mode**: the tree still grows from your text, but the topic judgment is a lightweight local approximation rather than real AI semantic analysis.

For better results, open Settings and configure your own OpenAI-compatible API key.

## What It Does

- Turns live text into a growing animated tree
- Detects whether expression is anchored around a root topic or exploratory across multiple topics
- Shows topic path, current topic, transitions, and recent segments
- Works well with external speech-to-text tools such as system dictation or Chinese input method voice typing
- Can run without a key in local demo mode
- Uses an OpenAI-compatible chat completion API for real semantic analysis when you bring your own key
- Keeps API keys in browser local storage only
- Generates a transparent tree overlay for existing vlog/video footage

## Why This Exists

Most speech tools produce a transcript, but they do not show how a thought moves. TalkTree focuses on the layer after transcription:

```text
text stream -> topic trajectory analysis -> tree events -> animated tree
```

This makes the project useful even when users prefer different speech-to-text tools, languages, or OpenAI-compatible providers.

## 它能做什么

- 把实时文本流变成一棵会生长、分叉的小树
- 判断表达是“锚定表达”还是“探索表达”
- 展示根主题、当前主题、主题轨迹和最近片段
- 可以配合系统听写、豆包输入法、微信输入法等外部语音转文字工具使用
- 支持 OpenAI-compatible 中转站，只需要配置 Base URL 和 API Key
- 没有 Key 也可以用本地演示模式先试效果
- API Key 只保存在浏览器本地，不会提交到仓库
- 可以给已有视频生成透明小树叠加层，用于剪映、Final Cut、Premiere 等剪辑软件

## Maintenance and Contribution

Useful contribution areas:

- Topic transition detection and local demo heuristics
- Accessibility and keyboard navigation
- API-key safety and provider configuration
- SRT/transcript import and overlay export reliability
- Bilingual documentation and examples

See:

- [CONTRIBUTING.md](CONTRIBUTING.md)
- [SECURITY.md](SECURITY.md)
- [ROADMAP.md](ROADMAP.md)
- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)

## Local Development

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:5173/
```

Build:

```bash
npm run build
```

## Repository Health

The repository includes:

- MIT license
- GitHub Pages deployment workflow
- CI build workflow for pushes and pull requests
- Issue templates for bugs and feature requests
- Pull request template with security/privacy checklist
- Security policy for private vulnerability reporting
- Public roadmap and contribution guide

## Model Configuration

Open Settings in the app and configure:

- `Base URL`: an OpenAI-compatible API base URL, for example `https://api.example.com/v1`
- `API Key`: your provider key
- `Chat Model`: optional advanced setting for topic analysis

TalkTree currently uses the chat completions API for semantic analysis. Voice input is hidden in the current public UI because many relay providers do not support audio transcription or Realtime APIs reliably. Use text monitoring with your preferred speech-to-text input method for the best experience.

## Video Overlay Workflow

TalkTree includes a video overlay workspace for finished vlog footage:

1. Import a local video file
2. Paste an SRT subtitle file or transcript
3. Generate a timed thought-tree sequence
4. Preview the transparent tree overlay on top of the video
5. Export `talktree-overlay.webm` or `talktree-events.json`

The exported WebM contains only the tree overlay on a transparent canvas. Put it above the original video in your editing software. If your configured provider supports `/audio/transcriptions`, TalkTree can also try to transcribe the imported video directly, but SRT/transcript input is the most reliable workflow today.

## API Key Safety

TalkTree does **not** include a shared public API key in the frontend. A key embedded in a public static site can be extracted and abused by anyone.

The GitHub Pages version is a static app:

- Your key is stored only in your browser's `localStorage`
- Your key is sent only to the Base URL you configure
- TalkTree has no backend server in static mode
- You can clear the local key from Settings at any time

If a future version offers a no-key real AI demo, it should use a small server-side proxy with rate limits and secret storage, not a key embedded in the client.

## Known Limitations

- Local demo mode uses lightweight heuristics, not real semantic understanding.
- Provider quality varies across OpenAI-compatible APIs.
- Voice input is intentionally not the core dependency; TalkTree expects text streams from system dictation, input methods, pasted transcripts, or provider-backed workflows.
- Transparent video overlay export depends on browser media support.

## SEO Keywords

TalkTree, thought tree, real-time thought visualization, topic drift, branching thoughts, speech analysis, AI writing companion, ADHD thinking tool, divergent thinking, canvas animation, OpenAI-compatible app, BYOK AI app, speech-to-text visualization, topic trajectory, vlog overlay, transparent video overlay, creator tools.

## License

MIT
