import "./styles.css";
import { AudioSegmenter, type AudioSegment } from "./audioSegmenter";
import { transcribeAudio } from "./audioTranscriber";
import { RealtimeTranscriber } from "./realtimeTranscriber";
import { SpeechSegmenter } from "./speechRecognizer";
import { TopicAnalyzer } from "./topicAnalyzer";
import { treeEventFromAnalysis } from "./treeEngine";
import { TreeCanvas } from "./treeCanvas";
import { fetchAvailableModels, normalizeBaseUrl, testChatConnection } from "./provider";
import type { AnalyzerConfig, SegmentAnalysis, SpeechSegment, TreeEvent } from "./types";

const STORAGE_KEY = "talktree-config";
const LANGUAGE_KEY = "talktree-language";
type AppLanguage = "zh" | "en";

const textTranslations: Record<string, string> = {
  实时表达轨迹: "Real-time Thought Tree",
  文本监听中: "Text monitoring",
  本地演示: "Local demo",
  实时模式: "Live",
  视频叠加: "Video overlay",
  "配置 AI Key": "Configure AI Key",
  文本监听模式: "Text Monitor",
  分析新增文字: "Analyze New Text",
  本地演示模式: "Local Demo Mode",
  "未配置 Key 时不会连接任何模型。你可以先体验小树生长；配置自己的 Key 后会启用真实语义分析。":
    "No model is contacted without a key. You can try the tree first; add your own key to enable real semantic analysis.",
  "监听规则：新增文字遇到停顿、标点，或积累到一小段后自动分析。":
    "Monitoring rule: new text is analyzed after pauses, punctuation, or a short accumulated segment.",
  "实时转写 / 当前片段": "Live Transcript / Current Segment",
  等待文字输入: "Waiting for text input",
  "当前没有 API Key。你仍然可以试动画，但分叉判断只是本地兜底，不代表真实语义分析。":
    "No API key is configured. The animation still works, but branch decisions are local approximations.",
  重置全部: "Reset All",
  语音输入: "Voice Input",
  开始: "Start",
  停止: "Stop",
  "文本监听默认开启。这里仅控制麦克风、Realtime 或音频转写。":
    "Text monitoring is always on. This only controls microphone, Realtime, or audio transcription.",
  演示模式: "Demo Mode",
  "未配置 API Key": "No API Key",
  表达模式: "Expression Mode",
  仍在判断: "Still judging",
  主题轨迹: "Topic Path",
  还没有足够内容形成主题: "Not enough content to form a topic yet",
  "开始说话后，这里会显示模型推断出的主线。": "After you start, the inferred main thread appears here.",
  最近片段: "Recent Segments",
  "最多 5 条": "Latest 5",
  "1. 导入视频": "1. Import Video",
  "选择 vlog / 视频文件": "Choose vlog / video file",
  "视频只在本机浏览器里预览，不会上传到 TalkTree。": "The video is previewed locally and is not uploaded to TalkTree.",
  "2. 字幕 / 文字稿": "2. Subtitles / Transcript",
  尝试从视频转写: "Try Video Transcription",
  "有 API Key 且中转站支持 /audio/transcriptions 时，可以尝试直接转写视频文件。":
    "If your key and relay support /audio/transcriptions, TalkTree can try to transcribe the video.",
  "3. 生成叠加层": "3. Generate Overlay",
  生成小树时间轴: "Generate Tree Timeline",
  重置预览: "Reset Preview",
  "准备好视频和文字稿后生成。无 Key 时使用本地演示判断。":
    "Generate after adding video and transcript. Without a key, local demo judgment is used.",
  导出透明WebM叠加层: "Export Transparent WebM Overlay",
  "导出透明 WebM 叠加层": "Export Transparent WebM Overlay",
  "导出 events.json": "Export events.json",
  "WebM 是小树透明层，可放进剪辑软件叠到原视频上。":
    "The WebM is a transparent tree layer that can be placed above the original video in editing software.",
  "已识别 {count} 个片段。": "{count} segments detected.",
  视频分析结果: "Video Analysis",
  等待生成: "Waiting",
  还没有小树时间轴: "No tree timeline yet",
  "生成后，播放视频即可按时间看到小树生长。": "After generation, play the video to see the tree grow in sync.",
  "分叉点 / 片段": "Branch Points / Segments",
  "0 条": "0 items",
  模型设置: "Model Settings",
  "OpenAI-compatible / 中转站": "OpenAI-compatible / Relay",
  "你的 Key 是本地安全配置": "Your Key Is Stored Locally",
  "TalkTree 的静态版没有自己的服务器。Key 只保存在当前浏览器，只会发送到你填写的 Base URL。":
    "The static TalkTree app has no backend server. Your key stays in this browser and is only sent to your configured Base URL.",
  "Provider 安全检查": "Provider Safety Checklist",
  "只使用你信任的 Base URL；TalkTree 会把 Key 作为 Authorization Bearer header 发送到该地址。":
    "Use only a Base URL you trust; TalkTree sends your key to that URL as an Authorization Bearer header.",
  "公开 GitHub Pages 版本不会代理或保存请求；localhost 开发模式可能使用本地 /api/provider 代理。":
    "The public GitHub Pages build does not proxy or store requests; localhost development can use a local /api/provider proxy.",
  "不要在 issue、PR、截图或录屏中公开 API Key、私有文字稿或视频素材。":
    "Do not expose API keys, private transcripts, or video files in issues, pull requests, screenshots, or recordings.",
  "查看完整安全说明": "Read Full Security Notes",
  "清除本地 Key": "Clear Local Key",
  检测连接: "Test Connection",
  未检测: "Not tested",
  "一般只需要填上面两项。使用你自己的模型，主题判断会比本地演示更稳定、更准确。":
    "Usually only the two fields above are needed. Your own model gives more stable and accurate topic judgment.",
  "高级设置：模型名称": "Advanced: Model Names",
  "或手动输入模型名": "Or enter model name manually",
  "或手动输入转写模型名": "Or enter transcription model manually",
  "Chat Model 用来判断主题和分叉；Realtime Model / Transcription Model 暂时只保留给后续语音入口。":
    "Chat Model judges topics and branches. Realtime / Transcription models are kept for future voice input.",
  "支持 OpenAI-compatible 中转站。Base URL 可以填根地址或 /v1 地址；误填到 /chat/completions 或 /audio/transcriptions 时会自动修正。":
    "OpenAI-compatible relays are supported. Base URL can be a root or /v1 URL; common endpoint mistakes are corrected automatically.",
  取消: "Cancel",
  保存: "Save",
  "视频叠加工作台": "Video Overlay Studio",
  "AI 模式已启用": "AI mode enabled",
  "本地演示模式，未连接 AI": "Local demo mode, AI not connected",
  设置: "Settings",
  "AI 语义分析模式": "AI Semantic Analysis",
  已连接主题判断模型: "Topic model connected",
  "未连接 AI，结果只是近似演示": "AI not connected; results are approximate",
  "本地演示模式不会发送模型请求。你可以先试动画；配置 Key 后会启用真实语义分析。":
    "Local demo mode sends no model requests. Try the animation first; configure a key for real semantic analysis.",
  AI_MODE_KEY_HINT: "AI mode enabled. Your key stays in this browser; requests are only sent to {baseUrl}."
};

const placeholderTranslations: Record<string, string> = {
  "可以用豆包输入法、系统听写或任意语音输入法，把转写文字直接输入到这里。新增文字会自动进入主题判断。":
    "Use any dictation/input method or type directly here. New text is automatically analyzed.",
  "推荐粘贴 SRT 字幕，或直接粘贴整段文字稿。没有时间码时会按视频长度自动均分。":
    "Paste SRT subtitles or a transcript. Without timestamps, segments are distributed across the video duration.",
  "sk-... / 中转站 Key": "sk-... / relay key",
  "https://api.example.com/v1": "https://api.example.com/v1"
};

let currentLanguage: AppLanguage = loadLanguage();
const originalTextNodes = new WeakMap<Text, string>();
const originalPlaceholders = new WeakMap<HTMLInputElement | HTMLTextAreaElement, string>();

const defaultConfig: AnalyzerConfig = {
  providerMode: "local-demo",
  apiKey: "",
  baseUrl: "https://api.openai.com/v1",
  model: "gpt-4o-mini",
  transcriptionModel: "gpt-4o-mini-transcribe",
  realtimeModel: "gpt-realtime",
  lastVerifiedAt: ""
};

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) {
  throw new Error("App root not found");
}
const appRoot = app;

appRoot.innerHTML = `
  <section class="shell">
    <header class="topbar app-header">
      <div>
        <p class="eyebrow">TalkTree</p>
        <h1>实时表达轨迹</h1>
      </div>
      <div class="header-actions">
        <span class="status-chip" id="statusText">文本监听中</span>
        <span class="status-chip" id="modelBadge">本地演示</span>
        <div class="mode-switch" aria-label="工作模式">
          <button class="mode-tab is-active" id="liveModeButton" type="button">实时模式</button>
          <button class="mode-tab" id="videoModeButton" type="button">视频叠加</button>
        </div>
        <button class="language-button" id="languageButton" type="button" aria-label="Switch language">EN</button>
        <button class="settings-button key-cta" id="settingsButton" type="button" aria-label="模型设置">配置 AI Key</button>
      </div>
    </header>

    <section class="workspace" id="liveWorkspace" aria-label="TalkTree 工作台">
      <aside class="input-column" aria-label="文本输入与实时转写">
        <section class="panel">
          <div class="panel-heading">
            <p class="panel-label">文本监听模式</p>
            <button class="secondary-button" id="flushTextButton" type="button">分析新增文字</button>
          </div>
          <div class="demo-callout" id="demoCallout">
            <strong>本地演示模式</strong>
            <span>未配置 Key 时不会连接任何模型。你可以先体验小树生长；配置自己的 Key 后会启用真实语义分析。</span>
          </div>
          <section class="text-monitor">
            <textarea id="streamTextInput" rows="4" placeholder="可以用豆包输入法、系统听写或任意语音输入法，把转写文字直接输入到这里。新增文字会自动进入主题判断。"></textarea>
            <p class="hint" id="textMonitorHint">监听规则：新增文字遇到停顿、标点，或积累到一小段后自动分析。</p>
          </section>
        </section>

        <section class="panel compact-panel">
          <p class="panel-label">实时转写 / 当前片段</p>
          <p class="interim" id="interimText">等待文字输入</p>
          <p class="hint" id="modeHint">当前没有 API Key。你仍然可以试动画，但分叉判断只是本地兜底，不代表真实语义分析。</p>
        </section>

        <section class="panel reset-panel" aria-label="重置">
          <button class="ghost-button" id="resetButton" type="button">重置全部</button>
        </section>

        <details class="panel voice-panel" hidden>
          <summary>语音输入</summary>
          <div class="controls" aria-label="录音控制">
            <button class="primary-button" id="startButton" type="button">开始</button>
            <button class="secondary-button" id="stopButton" type="button" disabled>停止</button>
          </div>
          <p class="hint">文本监听默认开启。这里仅控制麦克风、Realtime 或音频转写。</p>
        </details>
      </aside>

      <main class="tree-column" aria-label="小树动画">
        <div class="mode-notice" id="modeNotice">
          <strong>演示模式</strong>
          <span>未配置 API Key</span>
        </div>
        <section class="stage">
          <canvas id="treeCanvas"></canvas>
        </section>
      </main>

      <aside class="analysis-column" aria-label="主题与历史">
        <section class="panel topic-card">
          <p class="panel-label">表达模式</p>
          <p class="mode-text" id="expressionModeText">仍在判断</p>
          <p class="panel-label topic-label">主题轨迹</p>
          <p class="topic-text" id="topicText">还没有足够内容形成主题</p>
          <p class="topic-meta" id="topicMeta">开始说话后，这里会显示模型推断出的主线。</p>
        </section>

        <section class="panel history-panel">
          <div class="panel-heading">
            <p class="panel-label">最近片段</p>
            <span class="history-count">最多 5 条</span>
          </div>
          <ol class="timeline" id="timeline"></ol>
        </section>
      </aside>
    </section>

    <section class="video-studio" id="videoStudio" hidden aria-label="视频叠加工作台">
      <aside class="studio-column">
        <section class="panel studio-panel">
          <p class="panel-label">1. 导入视频</p>
          <label class="file-drop">
            <span>选择 vlog / 视频文件</span>
            <input id="videoFileInput" type="file" accept="video/*" />
          </label>
          <p class="hint">视频只在本机浏览器里预览，不会上传到 TalkTree。</p>
        </section>

        <section class="panel studio-panel">
          <div class="panel-heading">
            <p class="panel-label">2. 字幕 / 文字稿</p>
            <button class="secondary-button" id="transcribeVideoButton" type="button">尝试从视频转写</button>
          </div>
          <textarea id="videoTranscriptInput" class="studio-textarea" placeholder="推荐粘贴 SRT 字幕，或直接粘贴整段文字稿。没有时间码时会按视频长度自动均分。"></textarea>
          <p class="hint" id="videoTranscriptHint">有 API Key 且中转站支持 /audio/transcriptions 时，可以尝试直接转写视频文件。</p>
        </section>

        <section class="panel studio-panel">
          <p class="panel-label">3. 生成叠加层</p>
          <div class="studio-actions">
            <button class="primary-button" id="prepareOverlayButton" type="button">生成小树时间轴</button>
            <button class="ghost-button" id="resetOverlayButton" type="button">重置预览</button>
          </div>
          <p class="hint" id="overlayStatus">准备好视频和文字稿后生成。无 Key 时使用本地演示判断。</p>
        </section>
      </aside>

      <main class="video-preview-column">
        <div class="video-frame" id="videoFrame">
          <video id="sourceVideo" controls playsinline></video>
          <canvas id="overlayCanvas" aria-label="透明小树叠加层"></canvas>
          <div class="overlay-topic" id="overlayTopic" hidden>
            <strong>主题轨迹</strong>
            <span></span>
          </div>
        </div>
        <div class="export-bar">
          <button class="secondary-button" id="exportOverlayButton" type="button">导出透明 WebM 叠加层</button>
          <button class="ghost-button" id="exportEventsButton" type="button">导出 events.json</button>
          <span class="hint inline-hint">WebM 是小树透明层，可放进剪辑软件叠到原视频上。</span>
        </div>
      </main>

      <aside class="studio-column">
        <section class="panel topic-card">
          <p class="panel-label">视频分析结果</p>
          <p class="mode-text" id="overlayModeText">等待生成</p>
          <p class="topic-text" id="overlayTopicText">还没有小树时间轴</p>
          <p class="topic-meta" id="overlayMeta">生成后，播放视频即可按时间看到小树生长。</p>
        </section>
        <section class="panel history-panel">
          <div class="panel-heading">
            <p class="panel-label">分叉点 / 片段</p>
            <span class="history-count" id="overlayCueCount">0 条</span>
          </div>
          <ol class="timeline" id="overlayTimeline"></ol>
        </section>
      </aside>
    </section>
  </section>

  <dialog class="settings-dialog" id="settingsDialog">
    <form method="dialog" class="settings-form">
      <div>
        <p class="eyebrow">模型设置</p>
        <h2>OpenAI-compatible / 中转站</h2>
      </div>
      <label>
        <span>API Key</span>
        <input id="apiKeyInput" type="password" autocomplete="off" placeholder="sk-... / 中转站 Key" />
      </label>
      <label>
        <span>Base URL</span>
        <input id="baseUrlInput" type="url" placeholder="https://api.example.com/v1" />
      </label>
      <section class="security-card" aria-label="Key 安全说明">
        <div>
          <strong>你的 Key 是本地安全配置</strong>
          <p>TalkTree 的静态版没有自己的服务器。Key 只保存在当前浏览器，只会发送到你填写的 Base URL。</p>
        </div>
        <button id="clearKeyButton" type="button" class="ghost-button">清除本地 Key</button>
      </section>
      <section class="provider-safety-card" aria-label="Provider 安全检查">
        <strong>Provider 安全检查</strong>
        <ul>
          <li>只使用你信任的 Base URL；TalkTree 会把 Key 作为 Authorization Bearer header 发送到该地址。</li>
          <li>公开 GitHub Pages 版本不会代理或保存请求；localhost 开发模式可能使用本地 /api/provider 代理。</li>
          <li>不要在 issue、PR、截图或录屏中公开 API Key、私有文字稿或视频素材。</li>
        </ul>
        <a href="https://github.com/bobobo2026/TalkTree/blob/main/docs/provider-security.md" target="_blank" rel="noreferrer">查看完整安全说明</a>
      </section>
      <div class="connection-check">
        <button id="detectModelsButton" type="button" class="secondary-button">检测连接</button>
        <span id="modelStatus" class="status-pill">未检测</span>
      </div>
      <p class="settings-note">一般只需要填上面两项。使用你自己的模型，主题判断会比本地演示更稳定、更准确。</p>
      <details class="advanced-settings">
        <summary>高级设置：模型名称</summary>
        <label>
          <span>Chat Model</span>
          <select id="modelSelect"></select>
          <input id="modelInput" type="text" placeholder="或手动输入模型名" />
        </label>
        <label>
          <span>Transcription Model</span>
          <select id="transcriptionModelSelect"></select>
          <input id="transcriptionModelInput" type="text" placeholder="或手动输入转写模型名" />
        </label>
        <label>
          <span>Realtime Model</span>
          <input id="realtimeModelInput" type="text" />
        </label>
        <p class="settings-note">Chat Model 用来判断主题和分叉；Realtime Model / Transcription Model 暂时只保留给后续语音入口。</p>
      </details>
      <p class="settings-note">支持 OpenAI-compatible 中转站。Base URL 可以填根地址或 /v1 地址；误填到 /chat/completions 或 /audio/transcriptions 时会自动修正。</p>
      <menu>
        <button value="cancel" class="ghost-button">取消</button>
        <button id="saveSettingsButton" value="default" class="primary-button">保存</button>
      </menu>
    </form>
  </dialog>
`;

const canvas = document.querySelector<HTMLCanvasElement>("#treeCanvas");
const startButton = document.querySelector<HTMLButtonElement>("#startButton");
const stopButton = document.querySelector<HTMLButtonElement>("#stopButton");
const resetButton = document.querySelector<HTMLButtonElement>("#resetButton");
const liveModeButton = document.querySelector<HTMLButtonElement>("#liveModeButton");
const videoModeButton = document.querySelector<HTMLButtonElement>("#videoModeButton");
const liveWorkspace = document.querySelector<HTMLElement>("#liveWorkspace");
const videoStudio = document.querySelector<HTMLElement>("#videoStudio");
const languageButton = document.querySelector<HTMLButtonElement>("#languageButton");
const settingsButton = document.querySelector<HTMLButtonElement>("#settingsButton");
const settingsDialog = document.querySelector<HTMLDialogElement>("#settingsDialog");
const saveSettingsButton = document.querySelector<HTMLButtonElement>("#saveSettingsButton");
const detectModelsButton = document.querySelector<HTMLButtonElement>("#detectModelsButton");
const clearKeyButton = document.querySelector<HTMLButtonElement>("#clearKeyButton");
const apiKeyInput = document.querySelector<HTMLInputElement>("#apiKeyInput");
const baseUrlInput = document.querySelector<HTMLInputElement>("#baseUrlInput");
const modelInput = document.querySelector<HTMLInputElement>("#modelInput");
const transcriptionModelInput = document.querySelector<HTMLInputElement>("#transcriptionModelInput");
const realtimeModelInput = document.querySelector<HTMLInputElement>("#realtimeModelInput");
const modelSelect = document.querySelector<HTMLSelectElement>("#modelSelect");
const transcriptionModelSelect = document.querySelector<HTMLSelectElement>("#transcriptionModelSelect");
const modelStatus = document.querySelector<HTMLSpanElement>("#modelStatus");
const statusText = document.querySelector<HTMLSpanElement>("#statusText");
const modelBadge = document.querySelector<HTMLSpanElement>("#modelBadge");
const modeNotice = document.querySelector<HTMLDivElement>("#modeNotice");
const modeHint = document.querySelector<HTMLParagraphElement>("#modeHint");
const interimText = document.querySelector<HTMLParagraphElement>("#interimText");
const expressionModeText = document.querySelector<HTMLParagraphElement>("#expressionModeText");
const topicText = document.querySelector<HTMLParagraphElement>("#topicText");
const topicMeta = document.querySelector<HTMLParagraphElement>("#topicMeta");
const streamTextInput = document.querySelector<HTMLTextAreaElement>("#streamTextInput");
const flushTextButton = document.querySelector<HTMLButtonElement>("#flushTextButton");
const textMonitorHint = document.querySelector<HTMLParagraphElement>("#textMonitorHint");
const demoCallout = document.querySelector<HTMLDivElement>("#demoCallout");
const timeline = document.querySelector<HTMLOListElement>("#timeline");
const videoFileInput = document.querySelector<HTMLInputElement>("#videoFileInput");
const sourceVideo = document.querySelector<HTMLVideoElement>("#sourceVideo");
const overlayCanvas = document.querySelector<HTMLCanvasElement>("#overlayCanvas");
const videoTranscriptInput = document.querySelector<HTMLTextAreaElement>("#videoTranscriptInput");
const videoTranscriptHint = document.querySelector<HTMLParagraphElement>("#videoTranscriptHint");
const transcribeVideoButton = document.querySelector<HTMLButtonElement>("#transcribeVideoButton");
const prepareOverlayButton = document.querySelector<HTMLButtonElement>("#prepareOverlayButton");
const resetOverlayButton = document.querySelector<HTMLButtonElement>("#resetOverlayButton");
const exportOverlayButton = document.querySelector<HTMLButtonElement>("#exportOverlayButton");
const exportEventsButton = document.querySelector<HTMLButtonElement>("#exportEventsButton");
const overlayStatus = document.querySelector<HTMLParagraphElement>("#overlayStatus");
const overlayModeText = document.querySelector<HTMLParagraphElement>("#overlayModeText");
const overlayTopicText = document.querySelector<HTMLParagraphElement>("#overlayTopicText");
const overlayMeta = document.querySelector<HTMLParagraphElement>("#overlayMeta");
const overlayTimeline = document.querySelector<HTMLOListElement>("#overlayTimeline");
const overlayCueCount = document.querySelector<HTMLSpanElement>("#overlayCueCount");
const overlayTopic = document.querySelector<HTMLDivElement>("#overlayTopic");

if (
  !canvas ||
  !liveModeButton ||
  !videoModeButton ||
  !liveWorkspace ||
  !videoStudio ||
  !languageButton ||
  !startButton ||
  !stopButton ||
  !resetButton ||
  !settingsButton ||
  !settingsDialog ||
  !saveSettingsButton ||
  !detectModelsButton ||
  !clearKeyButton ||
  !apiKeyInput ||
  !baseUrlInput ||
  !modelInput ||
  !transcriptionModelInput ||
  !realtimeModelInput ||
  !modelSelect ||
  !transcriptionModelSelect ||
  !modelStatus ||
  !statusText ||
  !modelBadge ||
  !modeNotice ||
  !modeHint ||
  !interimText ||
  !expressionModeText ||
  !topicText ||
  !topicMeta ||
  !streamTextInput ||
  !flushTextButton ||
  !textMonitorHint ||
  !demoCallout ||
  !timeline ||
  !videoFileInput ||
  !sourceVideo ||
  !overlayCanvas ||
  !videoTranscriptInput ||
  !videoTranscriptHint ||
  !transcribeVideoButton ||
  !prepareOverlayButton ||
  !resetOverlayButton ||
  !exportOverlayButton ||
  !exportEventsButton ||
  !overlayStatus ||
  !overlayModeText ||
  !overlayTopicText ||
  !overlayMeta ||
  !overlayTimeline ||
  !overlayCueCount ||
  !overlayTopic
) {
  throw new Error("UI initialization failed");
}

const ui = {
  timeline,
  liveModeButton,
  videoModeButton,
  liveWorkspace,
  videoStudio,
  languageButton,
  statusText,
  modelBadge,
  modeNotice,
  modeHint,
  settingsButton,
  apiKeyInput,
  baseUrlInput,
  modelInput,
  transcriptionModelInput,
  realtimeModelInput,
  modelSelect,
  transcriptionModelSelect,
  modelStatus,
  interimText,
  expressionModeText,
  topicText,
  topicMeta,
  streamTextInput,
  flushTextButton,
  textMonitorHint,
  settingsDialog,
  clearKeyButton,
  startButton,
  stopButton,
  demoCallout,
  videoFileInput,
  sourceVideo,
  overlayCanvas,
  videoTranscriptInput,
  videoTranscriptHint,
  transcribeVideoButton,
  prepareOverlayButton,
  resetOverlayButton,
  exportOverlayButton,
  exportEventsButton,
  overlayStatus,
  overlayModeText,
  overlayTopicText,
  overlayMeta,
  overlayTimeline,
  overlayCueCount,
  overlayTopic
};

let config = loadConfig();
let segments: SpeechSegment[] = [];
let analyses: SegmentAnalysis[] = [];
const tree = new TreeCanvas(canvas);
const overlayTree = new TreeCanvas(overlayCanvas, { transparent: true, showGround: false, showLabel: true });
const analyzer = new TopicAnalyzer(() => config);
const overlayAnalyzer = new TopicAnalyzer(() => config);
let usingAudioFallback = false;
let textMonitorBuffer = "";
let textMonitorLastValue = "";
let textMonitorTimer: number | null = null;
let overlayVideoUrl = "";
let overlayCues: OverlayCue[] = [];
let overlayAppliedIndex = 0;
let overlayReplayFrame = 0;
let overlayRecorder: MediaRecorder | null = null;
let overlayRecordedChunks: Blob[] = [];

interface OverlayCue {
  id: string;
  start: number;
  end: number;
  segment: SpeechSegment;
  analysis: SegmentAnalysis;
  event: TreeEvent;
}

const recognizer = new SpeechSegmenter({
  onInterim: (text) => {
    ui.interimText.textContent = text || "正在等待下一句";
  },
  onSegment: (segment) => {
    void handleSegment(segment);
  },
  onStatus: setStatus,
  onError: (message) => {
    setStatus(message);
    if (message.includes("network") || message.includes("service-not-allowed")) {
      void startRealtimeFallback("浏览器语音识别服务不可用，正在尝试 Realtime 转写");
      return;
    }
    startButton.disabled = false;
    stopButton.disabled = true;
  }
});

const audioSegmenter = new AudioSegmenter({
  onSegment: (segment) => {
    void handleAudioSegment(segment);
  },
  onLevel: (level) => {
    if (usingAudioFallback && level > 0.08) {
      ui.interimText.textContent = config.apiKey
        ? "录音中，片段结束后显示转写文字"
        : "录音中；当前没有可用文字转写";
    }
  },
  onStatus: setStatus,
  onError: (message) => {
    setStatus(message);
    startButton.disabled = false;
    stopButton.disabled = true;
  }
});

const realtimeTranscriber = new RealtimeTranscriber(() => config, {
  onInterim: (text) => {
    ui.interimText.textContent = text || "Realtime 正在听";
  },
  onSegment: (segment) => {
    void handleSegment(segment);
  },
  onStatus: setStatus,
  onError: (message) => {
    setStatus(message);
    void startAudioFallback("Realtime 不可用，已退回分段录音转写");
  }
});

syncSettingsForm();
syncModelBadge();
applyLanguage();

modelSelect.addEventListener("change", () => {
  if (ui.modelSelect.value) {
    ui.modelInput.value = ui.modelSelect.value;
  }
});

transcriptionModelSelect.addEventListener("change", () => {
  if (ui.transcriptionModelSelect.value) {
    ui.transcriptionModelInput.value = ui.transcriptionModelSelect.value;
  }
});

liveModeButton.addEventListener("click", () => {
  switchWorkspaceMode("live");
});

videoModeButton.addEventListener("click", () => {
  switchWorkspaceMode("video");
});

languageButton.addEventListener("click", () => {
  currentLanguage = currentLanguage === "zh" ? "en" : "zh";
  localStorage.setItem(LANGUAGE_KEY, currentLanguage);
  applyLanguage();
});

startButton.addEventListener("click", () => {
  if (!config.apiKey) {
    setStatus("演示模式：可以运行，但不会做真实语义判断");
  }
  recognizer.start();
  startButton.disabled = true;
  stopButton.disabled = false;
});

stopButton.addEventListener("click", () => {
  recognizer.stop();
  realtimeTranscriber.stop();
  audioSegmenter.stop();
  usingAudioFallback = false;
  startButton.disabled = false;
  stopButton.disabled = true;
});

resetButton.addEventListener("click", () => {
  segments = [];
  analyses = [];
  textMonitorBuffer = "";
  textMonitorLastValue = "";
  if (textMonitorTimer) {
    window.clearTimeout(textMonitorTimer);
    textMonitorTimer = null;
  }
  ui.timeline.innerHTML = "";
  ui.interimText.textContent = "等待文字输入";
  ui.expressionModeText.textContent = "仍在判断";
  ui.topicText.textContent = "还没有足够内容形成主题";
  ui.topicMeta.textContent = config.apiKey
    ? "开始输入后，这里会显示模型推断出的主线。"
    : "本地演示模式会给出近似主题，配置 Key 后启用真实语义判断。";
  ui.streamTextInput.value = "";
  ui.textMonitorHint.textContent = "监听规则：新增文字遇到停顿、标点，或积累到一小段后自动分析。";
  tree.reset();
  setStatus("已重置，可以重新开始");
});

settingsButton.addEventListener("click", () => {
  syncSettingsForm();
  settingsDialog.showModal();
});

saveSettingsButton.addEventListener("click", (event) => {
  event.preventDefault();
  const previousStatus = ui.modelStatus.textContent ?? "";
  const hasKey = apiKeyInput.value.trim().length > 0;
  config = {
    providerMode: hasKey ? "byok" : "local-demo",
    apiKey: apiKeyInput.value.trim(),
    baseUrl: normalizeBaseUrl(baseUrlInput.value, defaultConfig.baseUrl),
    model: modelInput.value.trim() || defaultConfig.model,
    transcriptionModel: transcriptionModelInput.value.trim() || defaultConfig.transcriptionModel,
    realtimeModel: realtimeModelInput.value.trim() || defaultConfig.realtimeModel,
    lastVerifiedAt: hasKey && previousStatus.includes("连接可用") ? new Date().toISOString() : config.lastVerifiedAt
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  syncModelBadge();
  settingsDialog.close();
  if (!config.apiKey) {
    setConnectionStatus("neutral", "未配置 Key");
    setStatus("未配置模型，使用本地演示判断");
    return;
  }

  if (!previousStatus.includes("连接可用")) {
    void detectModels({ closeAfter: false, source: "save" });
    setStatus("配置已保存，正在检测 Key 是否可用");
    return;
  }

  setStatus("连接可用，开始后会实时判断");
});

detectModelsButton.addEventListener("click", () => {
  void detectModels({ closeAfter: false, source: "manual" });
});

clearKeyButton.addEventListener("click", () => {
  ui.apiKeyInput.value = "";
  config = {
    ...config,
    providerMode: "local-demo",
    apiKey: "",
    lastVerifiedAt: ""
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  setConnectionStatus("neutral", "已清除本地 Key");
  syncModelBadge();
  setStatus("已回到本地演示模式");
});

streamTextInput.addEventListener("input", () => {
  handleTextMonitorInput();
});

flushTextButton.addEventListener("click", () => {
  void flushTextMonitor("manual");
});

videoFileInput.addEventListener("change", () => {
  handleVideoFileSelected();
});

transcribeVideoButton.addEventListener("click", () => {
  void transcribeVideoFile();
});

prepareOverlayButton.addEventListener("click", () => {
  void prepareVideoOverlay();
});

resetOverlayButton.addEventListener("click", () => {
  resetOverlayPreview();
});

exportEventsButton.addEventListener("click", () => {
  exportOverlayEvents();
});

exportOverlayButton.addEventListener("click", () => {
  void exportTransparentOverlay();
});

sourceVideo.addEventListener("play", () => {
  startOverlayReplay();
});

sourceVideo.addEventListener("seeked", () => {
  syncOverlayToTime();
});

sourceVideo.addEventListener("ended", () => {
  stopOverlayReplay();
});

if (!SpeechSegmenter.isSupported()) {
  setStatus("当前浏览器不支持内置语音识别，开始后会使用录音模式。");
}

function translate(value: string): string {
  return currentLanguage === "en" ? textTranslations[value] || value : value;
}

function applyLanguage(): void {
  document.documentElement.lang = currentLanguage === "en" ? "en" : "zh-CN";
  ui.languageButton.textContent = currentLanguage === "en" ? "中文" : "EN";
  translateTextNodes();
  translatePlaceholders();
  syncModelBadge();
}

function translateTextNodes(): void {
  const walker = document.createTreeWalker(appRoot, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode() as Text | null;
  while (node) {
    const original = originalTextNodes.get(node) ?? node.nodeValue ?? "";
    if (!originalTextNodes.has(node)) {
      originalTextNodes.set(node, original);
    }
    const match = original.match(/^(\s*)(.*?)(\s*)$/s);
    if (match) {
      node.nodeValue = `${match[1]}${translate(match[2])}${match[3]}`;
    }
    node = walker.nextNode() as Text | null;
  }
}

function translatePlaceholders(): void {
  const controls = appRoot.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input[placeholder], textarea[placeholder]");
  controls.forEach((control) => {
    const original = originalPlaceholders.get(control) ?? control.placeholder;
    if (!originalPlaceholders.has(control)) {
      originalPlaceholders.set(control, original);
    }
    control.placeholder = currentLanguage === "en" ? placeholderTranslations[original] || original : original;
  });
}

function switchWorkspaceMode(mode: "live" | "video"): void {
  const videoMode = mode === "video";
  ui.liveWorkspace.hidden = videoMode;
  ui.videoStudio.hidden = !videoMode;
  ui.liveModeButton.classList.toggle("is-active", !videoMode);
  ui.videoModeButton.classList.toggle("is-active", videoMode);
  setStatus(
    videoMode
      ? translate("视频叠加工作台")
      : config.apiKey
        ? translate("AI 模式已启用")
        : translate("本地演示模式，未连接 AI")
  );
  if (videoMode) {
    window.setTimeout(() => overlayTree.refresh(), 0);
  }
}

function handleVideoFileSelected(): void {
  const file = ui.videoFileInput.files?.[0];
  if (!file) {
    return;
  }
  if (overlayVideoUrl) {
    URL.revokeObjectURL(overlayVideoUrl);
  }
  overlayVideoUrl = URL.createObjectURL(file);
  ui.sourceVideo.src = overlayVideoUrl;
  ui.overlayStatus.textContent = "视频已载入。请粘贴字幕/文字稿，或尝试从视频转写。";
  resetOverlayPreview();
}

async function transcribeVideoFile(): Promise<void> {
  const file = ui.videoFileInput.files?.[0];
  if (!file) {
    ui.videoTranscriptHint.textContent = "请先选择视频文件。";
    return;
  }
  if (!config.apiKey) {
    ui.videoTranscriptHint.textContent = "当前是本地演示模式，不能从视频自动转写。请粘贴字幕或配置 Key。";
    return;
  }

  ui.transcribeVideoButton.disabled = true;
  ui.videoTranscriptHint.textContent = "正在把视频交给你配置的转写接口；大文件可能需要一会儿。";
  try {
    const text = await transcribeAudio(config, file);
    ui.videoTranscriptInput.value = text;
    ui.videoTranscriptHint.textContent = text
      ? "转写完成。可以生成小树时间轴。"
      : "转写结果为空，请改用字幕或文字稿。";
  } catch (error) {
    console.warn(error);
    ui.videoTranscriptHint.textContent = "转写失败：中转站可能不支持视频/音频转写，请粘贴字幕或文字稿。";
  } finally {
    ui.transcribeVideoButton.disabled = false;
  }
}

async function prepareVideoOverlay(): Promise<void> {
  const transcript = ui.videoTranscriptInput.value.trim();
  if (!ui.sourceVideo.src) {
    ui.overlayStatus.textContent = "请先导入视频。";
    return;
  }
  if (!transcript) {
    ui.overlayStatus.textContent = "请先粘贴字幕/文字稿，或尝试转写视频。";
    return;
  }

  const duration = getVideoDuration();
  const parsedSegments = parseTranscriptToSegments(transcript, duration);
  if (!parsedSegments.length) {
    ui.overlayStatus.textContent = "没有识别到可分析的文字片段。";
    return;
  }

  ui.prepareOverlayButton.disabled = true;
  ui.overlayStatus.textContent = `已识别 ${parsedSegments.length} 个片段。正在生成小树事件...`;
  overlayAnalyzer.reset();
  overlayCues = [];
  const history: SpeechSegment[] = [];

  try {
    for (const segment of parsedSegments) {
      const analysis = await overlayAnalyzer.analyze(segment, history);
      const event = treeEventFromAnalysis(analysis);
      overlayCues.push({
        id: segment.id,
        start: segment.startTime / 1000,
        end: segment.endTime / 1000,
        segment,
        analysis,
        event
      });
      history.push(segment);
      ui.overlayStatus.textContent = `正在生成小树事件 ${overlayCues.length}/${parsedSegments.length}`;
    }
    renderOverlayTimeline();
    resetOverlayPreview();
    ui.overlayStatus.textContent = config.apiKey
      ? "小树时间轴已生成。播放视频即可预览真实 AI 分析叠加。"
      : "小树时间轴已生成。本地演示判断可用，配置 Key 后会更准确。";
  } catch (error) {
    console.warn(error);
    ui.overlayStatus.textContent = "生成失败：请检查模型配置，或先使用本地演示模式。";
  } finally {
    ui.prepareOverlayButton.disabled = false;
  }
}

function parseTranscriptToSegments(text: string, duration: number): SpeechSegment[] {
  const srtSegments = normalizeTimedSegments(parseSrtSegments(text), duration);
  if (srtSegments.length) {
    return srtSegments;
  }

  const parts = text
    .split(/(?<=[。！？!?；;])|\n+/)
    .map((part) => part.trim())
    .filter(Boolean);
  const safeParts = parts.length ? parts : [text.trim()].filter(Boolean);
  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : Math.max(20, safeParts.length * 8);
  const step = safeDuration / Math.max(1, safeParts.length);
  return safeParts.map((part, index) => ({
    id: crypto.randomUUID(),
    text: part,
    startTime: index * step * 1000,
    endTime: Math.max((index + 1) * step * 1000, index * step * 1000 + 1000)
  }));
}

function parseSrtSegments(text: string): SpeechSegment[] {
  const normalized = stripSubtitleMetadata(text)
    .replace(/\r/g, "")
    .replace(/^\uFEFF/, "");
  const blocks = normalized.includes("\n\n") ? normalized.split(/\n{2,}/) : splitLooseTimedBlocks(normalized);
  const segments: SpeechSegment[] = [];
  blocks.forEach((block) => {
    const lines = block
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    const timeLineIndex = lines.findIndex((line) => line.includes("-->"));
    if (timeLineIndex < 0) {
      return;
    }
    const [startRaw, endRaw] = lines[timeLineIndex].split("-->").map((part) => part.trim());
    const start = parseSrtTime(startRaw);
    const end = parseSrtTime(endRaw);
    const content = lines.slice(timeLineIndex + 1).join(" ").trim();
    if (!content || !Number.isFinite(start) || !Number.isFinite(end)) {
      return;
    }
    segments.push({
      id: crypto.randomUUID(),
      text: content,
      startTime: start * 1000,
      endTime: Math.max(end * 1000, start * 1000 + 1000)
    });
  });
  return segments;
}

function stripSubtitleMetadata(text: string): string {
  const lines = text.replace(/\r/g, "").replace(/^\uFEFF/, "").split("\n");
  const kept: string[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const trimmed = lines[index].trim();
    if (/^WEBVTT\b/i.test(trimmed) || /^STYLE\b/i.test(trimmed) || /^REGION\b/i.test(trimmed)) {
      continue;
    }
    if (/^NOTE\b/i.test(trimmed)) {
      while (index + 1 < lines.length && lines[index + 1].trim()) {
        index += 1;
      }
      continue;
    }
    kept.push(lines[index]);
  }
  return kept.join("\n");
}

function splitLooseTimedBlocks(text: string): string[] {
  const lines = text.split("\n");
  const blocks: string[] = [];
  let current: string[] = [];
  lines.forEach((line) => {
    if (line.includes("-->") && current.some((item) => item.includes("-->"))) {
      blocks.push(current.join("\n"));
      current = [];
    }
    if (line.trim()) {
      current.push(line);
    }
  });
  if (current.length) {
    blocks.push(current.join("\n"));
  }
  return blocks;
}

function parseSrtTime(value: string): number {
  const cleanValue = value.trim().split(/\s+/)[0];
  const match = cleanValue.match(/(?:(\d+):)?(\d{1,2}):(\d{2})(?:[,.](\d{1,3}))?/);
  if (!match) {
    return Number.NaN;
  }
  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  const milliseconds = Number((match[4] ?? "0").padEnd(3, "0"));
  return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
}

function normalizeTimedSegments(segments: SpeechSegment[], duration: number): SpeechSegment[] {
  const safeDurationMs = Number.isFinite(duration) && duration > 0 ? duration * 1000 : 0;
  const sorted = segments
    .filter((segment) => segment.text.trim() && Number.isFinite(segment.startTime) && Number.isFinite(segment.endTime))
    .map((segment) => {
      const startTime = Math.max(0, safeDurationMs ? Math.min(segment.startTime, safeDurationMs) : segment.startTime);
      const clampedEndTime = safeDurationMs ? Math.min(segment.endTime, safeDurationMs) : segment.endTime;
      const endTime = safeDurationMs
        ? Math.min(safeDurationMs, Math.max(startTime + 500, clampedEndTime))
        : Math.max(startTime + 500, clampedEndTime);
      return {
        ...segment,
        startTime,
        endTime
      };
    })
    .sort((a, b) => a.startTime - b.startTime);

  return sorted
    .map((segment, index) => {
      const nextStart = sorted[index + 1]?.startTime;
      const endTime = typeof nextStart === "number" && segment.endTime > nextStart
        ? Math.max(segment.startTime + 500, nextStart - 50)
        : segment.endTime;
      return { ...segment, endTime };
    })
    .filter((segment, index, list) => {
      const previous = list[index - 1];
      return !previous || previous.startTime !== segment.startTime || previous.text !== segment.text;
    });
}

function renderOverlayTimeline(): void {
  ui.overlayTimeline.innerHTML = "";
  ui.overlayCueCount.textContent = `${overlayCues.length} 条`;
  overlayCues
    .slice()
    .reverse()
    .forEach((cue) => {
      const item = document.createElement("li");
      item.innerHTML = `
        <div class="timeline-head">
          <span></span>
          <time>${formatVideoTime(cue.start)}</time>
        </div>
        <p class="timeline-text"></p>
        <p class="timeline-detail"></p>
      `;
      const label = item.querySelector<HTMLSpanElement>(".timeline-head span");
      const text = item.querySelector<HTMLParagraphElement>(".timeline-text");
      const detail = item.querySelector<HTMLParagraphElement>(".timeline-detail");
      if (label) {
        label.textContent = labelFromAnalysis(cue.analysis);
      }
      if (text) {
        text.textContent = cue.segment.text;
      }
      if (detail) {
        detail.textContent = `${cue.analysis.reason} · ${cue.analysis.branchLabel}`;
      }
      ui.overlayTimeline.append(item);
    });

  const lastAnalysis = overlayCues.at(-1)?.analysis;
  if (lastAnalysis) {
    ui.overlayModeText.textContent = expressionModeLabel(lastAnalysis.expressionMode);
    ui.overlayTopicText.textContent = lastAnalysis.topicState.topicPath.join(" -> ") || lastAnalysis.topicState.currentTopic;
    ui.overlayMeta.textContent = `${config.apiKey ? "AI 判断" : "本地演示判断"} · 共 ${overlayCues.length} 个片段`;
  }
}

function resetOverlayPreview(): void {
  stopOverlayReplay();
  overlayTree.reset();
  overlayAppliedIndex = 0;
  ui.overlayTopic.hidden = true;
  ui.overlayModeText.textContent = overlayCues.length ? "等待播放" : "等待生成";
  if (!overlayCues.length) {
    ui.overlayTopicText.textContent = "还没有小树时间轴";
    ui.overlayMeta.textContent = "生成后，播放视频即可按时间看到小树生长。";
  }
}

function startOverlayReplay(): void {
  if (!overlayCues.length) {
    return;
  }
  stopOverlayReplay();
  overlayReplayFrame = requestAnimationFrame(replayOverlayFrame);
}

function stopOverlayReplay(): void {
  if (overlayReplayFrame) {
    cancelAnimationFrame(overlayReplayFrame);
    overlayReplayFrame = 0;
  }
}

function replayOverlayFrame(): void {
  applyOverlayEventsUntil(ui.sourceVideo.currentTime);
  overlayReplayFrame = requestAnimationFrame(replayOverlayFrame);
}

function syncOverlayToTime(): void {
  if (!overlayCues.length) {
    return;
  }
  overlayTree.reset();
  overlayAppliedIndex = 0;
  applyOverlayEventsUntil(ui.sourceVideo.currentTime);
}

function applyOverlayEventsUntil(time: number): void {
  while (overlayAppliedIndex < overlayCues.length && overlayCues[overlayAppliedIndex].start <= time) {
    const cue = overlayCues[overlayAppliedIndex];
    overlayTree.applyEvent(cue.event);
    updateOverlayTopic(cue);
    overlayAppliedIndex += 1;
  }
}

function updateOverlayTopic(cue: OverlayCue): void {
  const path = cue.analysis.topicState.topicPath.join(" -> ") || cue.analysis.topicState.currentTopic;
  const label = cue.analysis.mode === "branch" ? `分叉：${cue.analysis.branchLabel}` : transitionLabel(cue.analysis.transition);
  ui.overlayTopic.hidden = false;
  const text = ui.overlayTopic.querySelector<HTMLSpanElement>("span");
  if (text) {
    text.textContent = `${label} · ${path}`;
  }
  ui.overlayModeText.textContent = expressionModeLabel(cue.analysis.expressionMode);
  ui.overlayTopicText.textContent = path;
  ui.overlayMeta.textContent = `${formatVideoTime(cue.start)} · ${cue.analysis.reason}`;
}

async function exportTransparentOverlay(): Promise<void> {
  if (!overlayCues.length) {
    ui.overlayStatus.textContent = "请先生成小树时间轴。";
    return;
  }
  if (!ui.sourceVideo.src) {
    ui.overlayStatus.textContent = "请先导入视频。";
    return;
  }
  if (!("MediaRecorder" in window)) {
    ui.overlayStatus.textContent = "当前浏览器不支持导出 WebM，请换 Chrome 桌面端。";
    return;
  }

  ui.exportOverlayButton.disabled = true;
  ui.overlayStatus.textContent = "正在实时录制透明叠加层，录制时长等于视频时长。";
  overlayRecordedChunks = [];
  resetOverlayPreview();
  ui.sourceVideo.currentTime = 0;

  const stream = ui.overlayCanvas.captureStream(30);
  const mimeType = pickRecorderMimeType();
  overlayRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  overlayRecorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      overlayRecordedChunks.push(event.data);
    }
  };
  overlayRecorder.onstop = () => {
    const blob = new Blob(overlayRecordedChunks, { type: mimeType || "video/webm" });
    downloadBlob(blob, "talktree-overlay.webm");
    ui.exportOverlayButton.disabled = false;
    ui.overlayStatus.textContent = "透明 WebM 已导出。把它叠到原视频上方即可。";
  };

  const stopWhenEnded = () => {
    stopOverlayReplay();
    overlayRecorder?.stop();
    ui.sourceVideo.removeEventListener("ended", stopWhenEnded);
  };
  try {
    overlayRecorder.start(250);
    await ui.sourceVideo.play();
    startOverlayReplay();
    ui.sourceVideo.addEventListener("ended", stopWhenEnded);
  } catch (error) {
    console.warn(error);
    stopOverlayReplay();
    ui.sourceVideo.removeEventListener("ended", stopWhenEnded);
    if (overlayRecorder.state !== "inactive") {
      overlayRecorder.stop();
    }
    ui.exportOverlayButton.disabled = false;
    ui.overlayStatus.textContent = "导出失败：浏览器没有允许播放或录制，请手动播放一次后重试。";
  }
}

function exportOverlayEvents(): void {
  if (!overlayCues.length) {
    ui.overlayStatus.textContent = "请先生成小树时间轴。";
    return;
  }
  const payload = {
    version: 1,
    generatedAt: new Date().toISOString(),
    source: config.apiKey ? "ai" : "local-demo",
    duration: getVideoDuration(),
    cues: overlayCues.map((cue) => ({
      start: cue.start,
      end: cue.end,
      text: cue.segment.text,
      event: cue.event,
      analysis: cue.analysis
    }))
  };
  downloadBlob(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }), "talktree-events.json");
  ui.overlayStatus.textContent = "events.json 已导出。";
}

function pickRecorderMimeType(): string {
  const candidates = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate)) ?? "";
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function getVideoDuration(): number {
  return Number.isFinite(ui.sourceVideo.duration) && ui.sourceVideo.duration > 0 ? ui.sourceVideo.duration : 0;
}

function formatVideoTime(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  return `${minutes}:${String(safeSeconds % 60).padStart(2, "0")}`;
}

async function handleSegment(segment: SpeechSegment): Promise<void> {
  segments.push(segment);
  ui.interimText.textContent = segment.text;
  appendTimelineItem(segment, config.apiKey ? "分析中" : "演示分析中", "正在观察这段话和主线的关系");
  setStatus(config.apiKey ? "正在分析刚才这段话" : "本地演示判断中");

  const analysis = await analyzer.analyze(segment, segments.slice(0, -1));
  analyses.push(analysis);
  tree.applyEvent(treeEventFromAnalysis(analysis));
  updateTimelineItem(segment.id, analysis);
  updateTopicPanel(analysis);
  setStatus(statusFromAnalysis(analysis));
}

function handleTextMonitorInput(): void {
  const currentValue = ui.streamTextInput.value;
  if (currentValue.length < textMonitorLastValue.length) {
    textMonitorBuffer = "";
    textMonitorLastValue = currentValue;
    ui.textMonitorHint.textContent = "文本被修改，已从当前位置继续监听新增内容。";
    return;
  }

  const delta = currentValue.slice(textMonitorLastValue.length);
  textMonitorLastValue = currentValue;
  if (!delta.trim()) {
    scheduleTextMonitorFlush(1800);
    return;
  }

  textMonitorBuffer += delta;
  ui.interimText.textContent = textMonitorBuffer.trim() || "正在监听文本输入";
  const shouldFlush = /[。！？!?；;\n]$/.test(delta.trim()) || textMonitorBuffer.trim().length >= 36;
  if (shouldFlush) {
    void flushTextMonitor("auto");
    return;
  }
  scheduleTextMonitorFlush(2200);
}

function scheduleTextMonitorFlush(delay: number): void {
  if (textMonitorTimer) {
    window.clearTimeout(textMonitorTimer);
  }
  textMonitorTimer = window.setTimeout(() => {
    void flushTextMonitor("pause");
  }, delay);
}

async function flushTextMonitor(reason: "auto" | "pause" | "manual"): Promise<void> {
  if (textMonitorTimer) {
    window.clearTimeout(textMonitorTimer);
    textMonitorTimer = null;
  }
  const text = textMonitorBuffer.trim();
  if (!text) {
    ui.textMonitorHint.textContent = reason === "manual" ? "没有新增文字可分析。" : "正在等待新增文字。";
    return;
  }

  textMonitorBuffer = "";
  ui.textMonitorHint.textContent = "已把新增文字送入主题判断。";
  const now = performance.now();
  await handleSegment({
    id: crypto.randomUUID(),
    text,
    startTime: now,
    endTime: now
  });
}

async function handleAudioSegment(audioSegment: AudioSegment): Promise<void> {
  const hasVoice = audioSegment.averageLevel > 0.025;
  if (!hasVoice) {
    setStatus("录音模式运行中，等待更清晰的声音");
    return;
  }

  setStatus(config.apiKey ? "正在转写录音片段" : "录音模式运行中，但没有文字转写");
  let text = "";
  if (!config.apiKey) {
    ui.interimText.textContent = "未配置 API Key，无法把录音转成文字。";
    return;
  }

  try {
    text = await transcribeAudio(config, audioSegment.blob);
  } catch (error) {
    console.warn(error);
    ui.interimText.textContent = "录音已收到，但中转站没有完成音频转写。";
    setStatus("音频转写失败：请确认中转站支持 /audio/transcriptions");
    return;
  }

  if (!text) {
    ui.interimText.textContent = "录音已收到，但转写结果为空。";
    setStatus("音频转写返回空结果");
    return;
  }

  const segment: SpeechSegment = {
    id: audioSegment.id,
    text,
    startTime: audioSegment.startTime,
    endTime: audioSegment.endTime
  };
  await handleSegment(segment);
}

async function startAudioFallback(message: string): Promise<void> {
  recognizer.stop();
  realtimeTranscriber.stop();
  usingAudioFallback = true;
  setStatus(message);
  ui.interimText.textContent = config.apiKey
    ? "录音片段结束后会显示转写文字"
    : "录音模式已启动，但未配置 API Key 时无法生成文字转写";
  await audioSegmenter.start();
  ui.startButton.disabled = true;
  ui.stopButton.disabled = false;
}

async function startRealtimeFallback(message: string): Promise<void> {
  recognizer.stop();
  audioSegmenter.stop();
  usingAudioFallback = false;
  setStatus(message);
  ui.interimText.textContent = "正在连接 Realtime 转写";
  await realtimeTranscriber.start();
  ui.startButton.disabled = true;
  ui.stopButton.disabled = false;
}

function appendTimelineItem(segment: SpeechSegment, label: string, detail: string): void {
  const item = document.createElement("li");
  item.dataset.segmentId = segment.id;
  item.innerHTML = `
    <div class="timeline-head">
      <span>${label}</span>
      <time>${formatTime(segment.endTime)}</time>
    </div>
    <p class="timeline-text"></p>
    <p class="timeline-detail">${detail}</p>
  `;
  const text = item.querySelector<HTMLParagraphElement>(".timeline-text");
  if (text) {
    text.textContent = segment.text;
  }
  ui.timeline.prepend(item);
  while (ui.timeline.children.length > 5) {
    ui.timeline.lastElementChild?.remove();
  }
}

function updateTimelineItem(segmentId: string, analysis: SegmentAnalysis): void {
  const item = ui.timeline.querySelector<HTMLLIElement>(`[data-segment-id="${segmentId}"]`);
  if (!item) {
    return;
  }
  const head = item.querySelector<HTMLSpanElement>(".timeline-head span");
  const detail = item.querySelector<HTMLParagraphElement>(".timeline-detail");
  if (head) {
    head.textContent = labelFromAnalysis(analysis);
  }
  if (detail) {
    detail.textContent = `${config.apiKey ? "" : "演示结果 · "}${analysis.reason} · 主线：${analysis.topicState.mainThread}`;
  }
}

function updateTopicPanel(analysis: SegmentAnalysis): void {
  ui.expressionModeText.textContent = expressionModeLabel(analysis.expressionMode);
  const path = analysis.topicState.topicPath.length ? analysis.topicState.topicPath.join(" -> ") : "";
  ui.topicText.textContent = path || analysis.topicState.rootTopic || analysis.topicState.currentTopic || "主线仍在形成";
  const confidence = Math.round(analysis.topicState.confidence * 100);
  const root = analysis.topicState.rootTopic ? `根主题：${analysis.topicState.rootTopic} · ` : "";
  const source = config.apiKey ? "AI 判断" : "本地演示判断，不代表真实语义分析";
  ui.topicMeta.textContent = `${source} · ${root}当前：${analysis.topicState.currentTopic} · ${transitionLabel(analysis.transition)} · 置信度 ${confidence}%`;
}

function expressionModeLabel(mode: SegmentAnalysis["expressionMode"]): string {
  if (mode === "anchored") {
    return "锚定表达";
  }
  if (mode === "exploratory") {
    return "探索表达";
  }
  return "仍在判断";
}

function transitionLabel(transition: SegmentAnalysis["transition"]): string {
  const labels: Record<SegmentAnalysis["transition"], string> = {
    continue: "延续",
    branch: "分支",
    return: "回归",
    shift: "跳转",
    uncertain: "观察中"
  };
  return labels[transition];
}

function labelFromAnalysis(analysis: SegmentAnalysis): string {
  const labels: Record<SegmentAnalysis["mode"], string> = {
    establishing: "形成主线",
    trunk: "延续主线",
    branch: `分支：${analysis.branchLabel}`,
    return: "回到主线",
    uncertain: "继续观察"
  };
  return labels[analysis.mode];
}

function statusFromAnalysis(analysis: SegmentAnalysis): string {
  if (analysis.mode === "branch") {
    return `出现分支：${analysis.branchLabel}`;
  }
  if (analysis.mode === "return") {
    return "表达回到主线";
  }
  if (analysis.mode === "establishing") {
    return "正在形成主线";
  }
  if (analysis.mode === "uncertain") {
    return "这段先继续观察";
  }
  return "主干继续生长";
}

function setStatus(message: string): void {
  ui.statusText.textContent = message;
}

function syncModelBadge(): void {
  const isByok = Boolean(config.apiKey);
  ui.modelBadge.textContent = isByok ? config.model : translate("本地演示");
  ui.statusText.textContent = isByok ? translate("AI 模式已启用") : translate("本地演示模式，未连接 AI");
  ui.settingsButton.textContent = isByok ? translate("设置") : translate("配置 AI Key");
  ui.settingsButton.classList.toggle("key-cta", !isByok);
  ui.demoCallout.hidden = isByok;
  ui.modeNotice.classList.toggle("is-live", Boolean(config.apiKey));
  ui.modeNotice.innerHTML = config.apiKey
    ? `<strong>${translate("AI 语义分析模式")}</strong><span>${translate("已连接主题判断模型")}</span>`
    : `<strong>${translate("本地演示模式")}</strong><span>${translate("未连接 AI，结果只是近似演示")}</span>`;
  ui.modeHint.textContent = config.apiKey
    ? translate("AI_MODE_KEY_HINT").replace("{baseUrl}", config.baseUrl)
    : translate("本地演示模式不会发送模型请求。你可以先试动画；配置 Key 后会启用真实语义分析。");
}

function syncSettingsForm(): void {
  ui.apiKeyInput.value = config.apiKey;
  ui.baseUrlInput.value = config.baseUrl;
  ui.modelInput.value = config.model;
  ui.transcriptionModelInput.value = config.transcriptionModel;
  ui.realtimeModelInput.value = config.realtimeModel;
  resetModelSelects();
  setConnectionStatus(
    config.apiKey ? "success" : "neutral",
    config.apiKey
      ? config.lastVerifiedAt
        ? `AI 模式已启用，上次检测 ${formatVerifiedTime(config.lastVerifiedAt)}`
        : "已保存 Key，建议检测连接"
      : "未配置 Key，本地演示"
  );
}

async function detectModels(options: { closeAfter: boolean; source: "manual" | "save" }): Promise<void> {
  const apiKey = ui.apiKeyInput.value.trim();
  const baseUrl = normalizeBaseUrl(ui.baseUrlInput.value, defaultConfig.baseUrl);
  if (!apiKey) {
    setConnectionStatus("error", "请先填写 Key");
    return;
  }

  setConnectionStatus("pending", "检测中");
  const model = ui.modelInput.value.trim() || defaultConfig.model;
  try {
    const models = await fetchAvailableModels(baseUrl, apiKey);
    renderModelOptions(models);
    const chatModels = models.filter(isLikelyChatModel);
    const transcriptionModels = models.filter(isLikelyTranscriptionModel);
    if (chatModels.length && !chatModels.includes(ui.modelInput.value.trim())) {
      ui.modelInput.value = pickPreferredModel(chatModels, ["gpt-4o-mini", "gpt-4.1-mini", "gpt-5-mini"]);
    }
    if (transcriptionModels.length && !transcriptionModels.includes(ui.transcriptionModelInput.value.trim())) {
      ui.transcriptionModelInput.value = pickPreferredModel(transcriptionModels, [
        "gpt-4o-mini-transcribe",
        "gpt-4o-transcribe",
        "whisper-1"
      ]);
    }
    markCurrentConfigVerified(apiKey, baseUrl);
    setConnectionStatus("success", `连接可用，检测到 ${models.length} 个模型`);
    if (options.source === "save") {
      setStatus("Key 检测通过，可以开始实时判断");
    }
    if (options.closeAfter) {
      ui.settingsDialog.close();
    }
  } catch (modelsError) {
    console.warn(modelsError);
    try {
      await testChatConnection(baseUrl, apiKey, model);
      markCurrentConfigVerified(apiKey, baseUrl);
      setConnectionStatus("success", `聊天接口可用：${model}；音频转写需另行支持`);
      if (options.source === "save") {
        setStatus("Key 可用；如果没有实时文字，请检查音频转写接口");
      }
      if (options.closeAfter) {
        ui.settingsDialog.close();
      }
    } catch (chatError) {
      console.warn(chatError);
      setConnectionStatus("error", getConnectionErrorMessage(chatError));
      if (options.source === "save") {
        setStatus("配置已保存，但连接检测失败");
      }
    }
  }
}

function setConnectionStatus(kind: "neutral" | "pending" | "success" | "error", message: string): void {
  ui.modelStatus.textContent = message;
  ui.modelStatus.dataset.state = kind;
}

function markCurrentConfigVerified(apiKey: string, baseUrl: string): void {
  if (config.apiKey !== apiKey || normalizeBaseUrl(config.baseUrl, defaultConfig.baseUrl) !== baseUrl) {
    return;
  }
  config = {
    ...config,
    providerMode: "byok",
    lastVerifiedAt: new Date().toISOString()
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  syncModelBadge();
}

function renderModelOptions(models: string[]): void {
  renderSelectOptions(ui.modelSelect, models.filter(isLikelyChatModel), ui.modelInput.value.trim());
  renderSelectOptions(
    ui.transcriptionModelSelect,
    models.filter(isLikelyTranscriptionModel),
    ui.transcriptionModelInput.value.trim()
  );
}

function resetModelSelects(): void {
  renderSelectOptions(ui.modelSelect, [], ui.modelInput.value.trim());
  renderSelectOptions(ui.transcriptionModelSelect, [], ui.transcriptionModelInput.value.trim());
}

function renderSelectOptions(select: HTMLSelectElement, models: string[], currentValue: string): void {
  select.innerHTML = "";
  select.append(new Option(models.length ? "选择检测到的模型" : "检测后显示模型列表", ""));
  const uniqueModels = Array.from(new Set(models));
  uniqueModels.forEach((model) => {
    select.append(new Option(model, model));
  });
  select.value = uniqueModels.includes(currentValue) ? currentValue : "";
}

function getConnectionErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/401|403/.test(message)) {
    return "连接失败：Key 无效或没有权限";
  }
  if (/404/.test(message)) {
    return "连接失败：Base URL 可能不对";
  }
  if (/model|模型/i.test(message)) {
    return "连接失败：模型名可能不被中转站支持";
  }
  if (/Failed to fetch|NetworkError|Load failed/i.test(message)) {
    return "连接失败：可能是浏览器跨域 CORS 被拦截";
  }
  return "连接失败：请检查 Key / Base URL / 模型名";
}

function isLikelyChatModel(model: string): boolean {
  return !/(transcribe|whisper|tts|speech|embedding|moderation|image|dall|realtime)/i.test(model);
}

function isLikelyTranscriptionModel(model: string): boolean {
  return /(transcribe|whisper)/i.test(model);
}

function pickPreferredModel(models: string[], preferred: string[]): string {
  return preferred.find((model) => models.includes(model)) ?? models[0] ?? "";
}

function loadConfig(): AnalyzerConfig {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return defaultConfig;
  }
  try {
    const parsed = { ...defaultConfig, ...JSON.parse(raw) } as AnalyzerConfig;
    const apiKey = parsed.apiKey?.trim() ?? "";
    return {
      ...parsed,
      providerMode: apiKey ? "byok" : "local-demo",
      apiKey,
      baseUrl: normalizeBaseUrl(parsed.baseUrl, defaultConfig.baseUrl),
      lastVerifiedAt: parsed.lastVerifiedAt || ""
    };
  } catch {
    return defaultConfig;
  }
}

function loadLanguage(): AppLanguage {
  return localStorage.getItem(LANGUAGE_KEY) === "en" ? "en" : "zh";
}

function formatVerifiedTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "刚才";
  }
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatTime(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}
