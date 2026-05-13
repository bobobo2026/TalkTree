# TalkTree

TalkTree is a real-time thought trajectory visualizer. It listens to a growing text stream and renders your expression as a small tree: the trunk grows when the thought continues, and branches appear when the topic shifts, explores a side path, or returns to a previous thread.

TalkTree is designed for creators, vloggers, speakers, ADHD-style divergent thinkers, and anyone who wants to see how their ideas move while they talk or write.

中文：TalkTree 是一个实时表达轨迹可视化工具。你可以把语音输入法、系统听写、豆包输入法或直接打字产生的文本放进文本监听框，TalkTree 会判断表达模式、主题轨迹和话题跳转，并用一棵不断生长和分叉的小树展示出来。

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

## 它能做什么

- 把实时文本流变成一棵会生长、分叉的小树
- 判断表达是“锚定表达”还是“探索表达”
- 展示根主题、当前主题、主题轨迹和最近片段
- 可以配合系统听写、豆包输入法、微信输入法等外部语音转文字工具使用
- 支持 OpenAI-compatible 中转站，只需要配置 Base URL 和 API Key
- 没有 Key 也可以用本地演示模式先试效果
- API Key 只保存在浏览器本地，不会提交到仓库

## Why Text Stream First?

Speech-to-text is already available on most phones and computers through input methods and system dictation. TalkTree treats speech recognition as an input source, not the core product. The core product is:

```text
text stream -> topic trajectory analysis -> tree events -> animated tree
```

This makes TalkTree easier to use with many existing speech tools and avoids depending on a specific transcription provider.

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

## Model Configuration

Open Settings in the app and configure:

- `Base URL`: an OpenAI-compatible API base URL, for example `https://api.example.com/v1`
- `API Key`: your provider key
- `Chat Model`: optional advanced setting for topic analysis

TalkTree currently uses the chat completions API for semantic analysis. Voice input is hidden in the current public UI because many relay providers do not support audio transcription or Realtime APIs reliably. Use text monitoring with your preferred speech-to-text input method for the best experience.

## API Key Safety

TalkTree does **not** include a shared public API key in the frontend. A key embedded in a public static site can be extracted and abused by anyone.

The GitHub Pages version is a static app:

- Your key is stored only in your browser's `localStorage`
- Your key is sent only to the Base URL you configure
- TalkTree has no backend server in static mode
- You can clear the local key from Settings at any time

If a future version offers a no-key real AI demo, it should use a small server-side proxy with rate limits and secret storage, not a key embedded in the client.

## SEO Keywords

TalkTree, thought tree, real-time thought visualization, topic drift, branching thoughts, speech analysis, AI writing companion, ADHD thinking tool, divergent thinking, canvas animation, OpenAI-compatible app, BYOK AI app, speech-to-text visualization, topic trajectory.

## License

MIT
