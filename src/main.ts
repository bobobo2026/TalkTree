import "./styles.css";
import { AudioSegmenter, type AudioSegment } from "./audioSegmenter";
import { transcribeAudio } from "./audioTranscriber";
import { RealtimeTranscriber } from "./realtimeTranscriber";
import { SpeechSegmenter } from "./speechRecognizer";
import { TopicAnalyzer } from "./topicAnalyzer";
import { treeEventFromAnalysis } from "./treeEngine";
import { TreeCanvas } from "./treeCanvas";
import { fetchAvailableModels, normalizeBaseUrl, testChatConnection } from "./provider";
import type { AnalyzerConfig, SegmentAnalysis, SpeechSegment } from "./types";

const STORAGE_KEY = "talktree-config";

const defaultConfig: AnalyzerConfig = {
  apiKey: "",
  baseUrl: "https://api.openai.com/v1",
  model: "gpt-4o-mini",
  transcriptionModel: "gpt-4o-mini-transcribe",
  realtimeModel: "gpt-realtime"
};

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) {
  throw new Error("App root not found");
}

app.innerHTML = `
  <section class="shell">
    <header class="topbar app-header">
      <div>
        <p class="eyebrow">TalkTree</p>
        <h1>实时表达轨迹</h1>
      </div>
      <div class="header-actions">
        <span class="status-chip" id="statusText">文本监听中</span>
        <span class="status-chip" id="modelBadge">本地演示</span>
        <button class="settings-button" id="settingsButton" type="button" aria-label="模型设置">设置</button>
      </div>
    </header>

    <section class="workspace" aria-label="TalkTree 工作台">
      <aside class="input-column" aria-label="文本输入与实时转写">
        <section class="panel">
          <div class="panel-heading">
            <p class="panel-label">文本监听模式</p>
            <button class="secondary-button" id="flushTextButton" type="button">分析新增文字</button>
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
      <div class="connection-check">
        <button id="detectModelsButton" type="button" class="secondary-button">检测连接</button>
        <span id="modelStatus" class="status-pill">未检测</span>
      </div>
        <p class="settings-note">一般只需要填上面两项。检测连接会先验证聊天模型；如果浏览器语音识别不可用，实时转写还需要中转站支持 /audio/transcriptions。</p>
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
        <p class="settings-note">Chat Model 用来判断主题和分叉；Realtime Model / Transcription Model 用于浏览器内置语音识别不可用时的实时转写。</p>
      </details>
      <p class="settings-note">支持 OpenAI-compatible 中转站。Base URL 可以填根地址或 /v1 地址；误填到 /chat/completions 或 /audio/transcriptions 时会自动修正。Key 只保存在本浏览器。</p>
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
const settingsButton = document.querySelector<HTMLButtonElement>("#settingsButton");
const settingsDialog = document.querySelector<HTMLDialogElement>("#settingsDialog");
const saveSettingsButton = document.querySelector<HTMLButtonElement>("#saveSettingsButton");
const detectModelsButton = document.querySelector<HTMLButtonElement>("#detectModelsButton");
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
const timeline = document.querySelector<HTMLOListElement>("#timeline");

if (
  !canvas ||
  !startButton ||
  !stopButton ||
  !resetButton ||
  !settingsButton ||
  !settingsDialog ||
  !saveSettingsButton ||
  !detectModelsButton ||
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
  !timeline
) {
  throw new Error("UI initialization failed");
}

const ui = {
  timeline,
  statusText,
  modelBadge,
  modeNotice,
  modeHint,
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
  startButton,
  stopButton
};

let config = loadConfig();
let segments: SpeechSegment[] = [];
let analyses: SegmentAnalysis[] = [];
const tree = new TreeCanvas(canvas);
const analyzer = new TopicAnalyzer(() => config);
let usingAudioFallback = false;
let textMonitorBuffer = "";
let textMonitorLastValue = "";
let textMonitorTimer: number | null = null;

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
  ui.interimText.textContent = "等待声音输入";
  ui.expressionModeText.textContent = "仍在判断";
  ui.topicText.textContent = "还没有足够内容形成主题";
  ui.topicMeta.textContent = "开始说话后，这里会显示模型推断出的主线。";
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
  config = {
    apiKey: apiKeyInput.value.trim(),
    baseUrl: normalizeBaseUrl(baseUrlInput.value, defaultConfig.baseUrl),
    model: modelInput.value.trim() || defaultConfig.model,
    transcriptionModel: transcriptionModelInput.value.trim() || defaultConfig.transcriptionModel,
    realtimeModel: realtimeModelInput.value.trim() || defaultConfig.realtimeModel
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

streamTextInput.addEventListener("input", () => {
  handleTextMonitorInput();
});

flushTextButton.addEventListener("click", () => {
  void flushTextMonitor("manual");
});

if (!SpeechSegmenter.isSupported()) {
  setStatus("当前浏览器不支持内置语音识别，开始后会使用录音模式。");
}

async function handleSegment(segment: SpeechSegment): Promise<void> {
  segments.push(segment);
  ui.interimText.textContent = segment.text;
  appendTimelineItem(segment, "分析中", "正在观察这段话和主线的关系");
  setStatus("正在分析刚才这段话");

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
    detail.textContent = `${analysis.reason} · 主线：${analysis.topicState.mainThread}`;
  }
}

function updateTopicPanel(analysis: SegmentAnalysis): void {
  ui.expressionModeText.textContent = expressionModeLabel(analysis.expressionMode);
  const path = analysis.topicState.topicPath.length ? analysis.topicState.topicPath.join(" -> ") : "";
  ui.topicText.textContent = path || analysis.topicState.rootTopic || analysis.topicState.currentTopic || "主线仍在形成";
  const confidence = Math.round(analysis.topicState.confidence * 100);
  const root = analysis.topicState.rootTopic ? `根主题：${analysis.topicState.rootTopic} · ` : "";
  ui.topicMeta.textContent = `${root}当前：${analysis.topicState.currentTopic} · ${transitionLabel(analysis.transition)} · 置信度 ${confidence}%`;
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
  ui.modelBadge.textContent = config.apiKey ? config.model : "本地演示";
  ui.modeNotice.classList.toggle("is-live", Boolean(config.apiKey));
  ui.modeNotice.innerHTML = config.apiKey
    ? "<strong>语义分析模式</strong><span>已连接主题判断模型</span>"
    : "<strong>演示模式</strong><span>未配置 API Key</span>";
  ui.modeHint.textContent = config.apiKey
    ? "当前已配置 API Key。浏览器语音识别可用时会实时显示文字；如果切到录音模式，还需要中转站支持音频转写。"
    : "当前没有 API Key。你仍然可以试动画，但分叉判断只是本地兜底，不代表真实语义分析。";
}

function syncSettingsForm(): void {
  ui.apiKeyInput.value = config.apiKey;
  ui.baseUrlInput.value = config.baseUrl;
  ui.modelInput.value = config.model;
  ui.transcriptionModelInput.value = config.transcriptionModel;
  ui.realtimeModelInput.value = config.realtimeModel;
  resetModelSelects();
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
    return {
      ...parsed,
      baseUrl: normalizeBaseUrl(parsed.baseUrl, defaultConfig.baseUrl)
    };
  } catch {
    return defaultConfig;
  }
}

function formatTime(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}
