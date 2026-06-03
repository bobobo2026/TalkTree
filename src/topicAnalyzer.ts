import type { AnalyzerConfig, InferredTopicState, SegmentAnalysis, SpeechSegment } from "./types";
import { endpoint, providerRequestHeaders } from "./provider";

const FALLBACK_TOPIC: InferredTopicState = {
  mainThread: "正在形成主线",
  expressionMode: "forming",
  rootTopic: "",
  currentTopic: "正在形成主线",
  topicPath: [],
  recentSubtopics: [],
  confidence: 0.2
};

const SYSTEM_PROMPT = `你是一个实时表达轨迹分析器。你只观察说话内容如何形成主题轨迹，不评价用户好坏，也不做心理或医学诊断。

先判断表达模式：
- forming: 内容还不足，无法判断表达模式
- anchored: 用户明确说出“今天讲 X / 我想讨论 X / 这次分享 X”等根主题
- exploratory: 用户没有明确根主题，表达是在 A -> B -> C 之间探索和跳转

再判断最新片段和主题轨迹的关系：
- continue: 延续当前主题或根主题
- branch: 锚定表达里进入偏离根主题的新子议题，或探索表达里出现明显新分支
- return: 回到根主题或之前的主题
- shift: 探索表达里从一个主题跳到另一个主题
- uncertain: 信息不足

不要把所有内容强行概括成一个万能大主题。锚定表达强调“根主题 vs 当前片段”；探索表达强调“话题路径和跳转点”。

必须只返回 JSON，不要 Markdown。`;

const ENGLISH_STOPWORDS = new Set([
  "and",
  "are",
  "but",
  "can",
  "for",
  "from",
  "have",
  "how",
  "into",
  "let",
  "like",
  "more",
  "not",
  "our",
  "that",
  "the",
  "then",
  "this",
  "today",
  "want",
  "what",
  "when",
  "with"
]);

const CJK_FILLERS = /[，。！？；：、,.!?;:()[\]{}"'“”‘’\s]/g;

interface RawModelResponse {
  mode?: string;
  expressionMode?: string;
  transition?: string;
  rootTopic?: string;
  currentTopic?: string;
  topicPath?: unknown;
  branchLabel?: string;
  driftLevel?: number;
  reason?: string;
  topicState?: Partial<InferredTopicState>;
}

export class TopicAnalyzer {
  private topicState: InferredTopicState = FALLBACK_TOPIC;
  private firstSegmentTime: number | null = null;

  constructor(private getConfig: () => AnalyzerConfig) {}

  reset(): void {
    this.topicState = FALLBACK_TOPIC;
    this.firstSegmentTime = null;
  }

  async analyze(segment: SpeechSegment, history: SpeechSegment[]): Promise<SegmentAnalysis> {
    if (this.firstSegmentTime === null) {
      this.firstSegmentTime = segment.startTime;
    }

    const config = this.getConfig();
    if (!config.apiKey.trim()) {
      return this.localFallback(segment, history);
    }

    try {
      const analysis = await this.callModel(config, segment, history);
      this.topicState = analysis.topicState;
      return analysis;
    } catch (error) {
      console.warn(error);
      return {
        mode: "uncertain",
        expressionMode: this.topicState.expressionMode,
        transition: "uncertain",
        branchLabel: "分析暂不可用",
        driftLevel: 0.2,
        reason: "模型请求失败，动画暂时保持轻微生长。",
        topicState: this.topicState
      };
    }
  }

  private async callModel(
    config: AnalyzerConfig,
    segment: SpeechSegment,
    history: SpeechSegment[]
  ): Promise<SegmentAnalysis> {
    const elapsedSeconds = this.firstSegmentTime === null ? 0 : (segment.endTime - this.firstSegmentTime) / 1000;
    const recentHistory = history
      .slice(-8)
      .map((item, index) => `${index + 1}. ${item.text}`)
      .join("\n");

    const body = {
      model: config.model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: JSON.stringify(
            {
              elapsedSeconds,
              currentTopicState: this.topicState,
              recentHistory,
              latestSegment: segment.text,
              outputSchema: {
                expressionMode: "forming | anchored | exploratory",
                rootTopic: "锚定表达的根主题；探索表达可为空",
                currentTopic: "当前片段正在讲的具体主题",
                topicPath: ["最近 3-5 个主题路径，短中文短语"],
                transition: "continue | branch | return | shift | uncertain",
                mode: "establishing | trunk | branch | return | uncertain，用于兼容旧 UI，可由 transition 映射",
                branchLabel: "短标签，中文，最多 8 个字",
                driftLevel: "0 到 1，0 表示贴近主线，1 表示明显分叉",
                reason: "中性解释，最多 28 个中文字符",
                topicState: {
                  mainThread: "当前推断出的隐含主线",
                  expressionMode: "forming | anchored | exploratory",
                  rootTopic: "根主题，没有则空字符串",
                  currentTopic: "当前主题",
                  topicPath: ["主题路径"],
                  recentSubtopics: ["最近出现的子话题"],
                  confidence: "0 到 1"
                }
              },
              rule:
                elapsedSeconds < 25
                  ? "仍处于模式建立期：如果用户明确说出本次要讲什么，可以 anchored；否则 forming/exploratory。不要过早强判偏题。"
                  : "如果有明确根主题，按 anchored 判断；如果没有根主题，按 exploratory 追踪跳转路径。"
            },
            null,
            2
          )
        }
      ]
    };

    const response = await fetch(endpoint(config.baseUrl, "chat/completions"), {
      method: "POST",
      headers: providerRequestHeaders(config.baseUrl, config.apiKey, "application/json"),
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`Model request failed: ${response.status}`);
    }

    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      throw new Error("Model returned no content");
    }

    const parsed = this.parseModelJson(content);
    return this.normalizeAnalysis(parsed);
  }

  private parseModelJson(content: string): RawModelResponse {
    try {
      return JSON.parse(content) as RawModelResponse;
    } catch {
      const match = content.match(/\{[\s\S]*\}/);
      if (!match) {
        throw new Error("Model JSON parse failed");
      }
      return JSON.parse(match[0]) as RawModelResponse;
    }
  }

  private normalizeAnalysis(raw: RawModelResponse): SegmentAnalysis {
    const expressionMode = this.normalizeExpressionMode(raw.expressionMode ?? raw.topicState?.expressionMode);
    const transition = this.normalizeTransition(raw.transition);
    const mode = this.modeFromTransition(raw.mode, transition, expressionMode);
    const rootTopic = String(raw.rootTopic || raw.topicState?.rootTopic || this.topicState.rootTopic || "").trim();
    const currentTopic = String(
      raw.currentTopic || raw.topicState?.currentTopic || raw.topicState?.mainThread || this.topicState.currentTopic
    ).trim();
    const topicPath = this.normalizeTopicPath(raw.topicPath ?? raw.topicState?.topicPath, currentTopic);
    const topicState = {
      mainThread: raw.topicState?.mainThread?.trim() || rootTopic || currentTopic || this.topicState.mainThread,
      expressionMode,
      rootTopic,
      currentTopic: currentTopic || rootTopic || "正在形成主线",
      topicPath,
      recentSubtopics: Array.isArray(raw.topicState?.recentSubtopics)
        ? raw.topicState.recentSubtopics.map(String).slice(0, 5)
        : topicPath,
      confidence: this.clamp(Number(raw.topicState?.confidence ?? this.topicState.confidence), 0, 1)
    };

    return {
      mode,
      expressionMode,
      transition,
      branchLabel: String(raw.branchLabel || (transition === "shift" ? "话题跳转" : mode === "branch" ? "新分支" : "主线")).slice(0, 12),
      driftLevel: this.clamp(Number(raw.driftLevel ?? 0.3), 0, 1),
      reason: String(raw.reason || "继续观察表达轨迹").slice(0, 40),
      topicState
    };
  }

  private localFallback(segment: SpeechSegment, history: SpeechSegment[]): SegmentAnalysis {
    const elapsedSeconds = this.firstSegmentTime === null ? 0 : (segment.endTime - this.firstSegmentTime) / 1000;
    const anchorTopic = this.detectAnchorTopic(segment.text);
    const currentTopic = this.extractTopicLabel(segment.text);
    const previousSegments = history.slice(-3);
    const previousTokens = this.tokensForTexts(previousSegments.map((item) => item.text));
    const currentTokens = this.tokenize(segment.text);
    const previousOverlap = this.tokenOverlap(currentTokens, previousTokens);
    const existingRootTopic = this.topicState.rootTopic || anchorTopic;
    const rootOverlap = existingRootTopic ? this.tokenOverlap(currentTokens, this.tokenize(existingRootTopic)) : 0;
    const previousTopicMatch = this.findPreviousTopicMatch(currentTokens);
    const establishing = elapsedSeconds < 18 || history.length < 2;

    let expressionMode: SegmentAnalysis["expressionMode"] = this.topicState.expressionMode;
    let mode: SegmentAnalysis["mode"] = "establishing";
    let transition: SegmentAnalysis["transition"] = "uncertain";
    let driftLevel = 0.28;
    let reason = "本地演示判断，配置模型后更准确";

    if (anchorTopic || this.topicState.expressionMode === "anchored") {
      expressionMode = "anchored";
      if (anchorTopic) {
        mode = "establishing";
        transition = "continue";
        driftLevel = 0.12;
        reason = "识别到明确根主题";
      } else if (rootOverlap >= 0.22) {
        mode = previousTopicMatch ? "return" : "trunk";
        transition = previousTopicMatch ? "return" : "continue";
        driftLevel = 0.18;
        reason = previousTopicMatch ? "回到已出现主题" : "贴近根主题";
      } else if (previousOverlap >= 0.2) {
        mode = "trunk";
        transition = "continue";
        driftLevel = 0.24;
        reason = "延续上一片段";
      } else if (establishing) {
        mode = "establishing";
        transition = "uncertain";
        driftLevel = 0.34;
        reason = "仍在建立主线";
      } else {
        mode = "branch";
        transition = "branch";
        driftLevel = 0.72;
        reason = "偏离根主题形成分支";
      }
    } else {
      expressionMode = establishing ? "forming" : "exploratory";
      if (establishing) {
        mode = "establishing";
        transition = "uncertain";
        driftLevel = 0.3;
        reason = "仍在建立主线";
      } else if (previousTopicMatch) {
        mode = "return";
        transition = "return";
        driftLevel = 0.2;
        reason = "回到已出现主题";
      } else if (previousOverlap >= 0.18) {
        mode = "trunk";
        transition = "continue";
        driftLevel = 0.18;
        reason = "延续上一片段";
      } else if (previousOverlap >= 0.1) {
        mode = "uncertain";
        transition = "uncertain";
        driftLevel = 0.42;
        reason = "有轻微话题漂移";
      } else {
        mode = "branch";
        transition = "shift";
        driftLevel = 0.76;
        reason = "出现明显话题跳转";
      }
    }

    const rootTopic = anchorTopic || this.topicState.rootTopic;
    const nextPath = this.nextLocalTopicPath(currentTopic, transition, rootTopic);
    const topicState = {
      mainThread: rootTopic || nextPath[0] || currentTopic || "正在形成主线",
      expressionMode,
      rootTopic,
      currentTopic,
      topicPath: nextPath,
      recentSubtopics: nextPath.filter((topic) => topic !== rootTopic).slice(-5),
      confidence: this.localConfidence(mode, transition, previousOverlap, rootOverlap, Boolean(anchorTopic))
    };
    this.topicState = topicState;

    return {
      mode,
      expressionMode,
      transition,
      branchLabel: mode === "branch" || transition === "shift" ? currentTopic || "新分支" : previousTopicMatch || rootTopic || "主线",
      driftLevel,
      reason,
      topicState
    };
  }

  private detectAnchorTopic(text: string): string {
    const patterns = [
      /(?:今天|这次|本次|接下来|我想|我们来|主要)(?:聊|讲|讨论|分享|说说|分析)(?:一下)?(.{2,28})/,
      /(?:主题|主线|核心|重点)(?:是|就是|围绕)(.{2,28})/,
      /(?:today|this time|i want to|we will|let'?s)\s+(?:talk about|discuss|share|analyze)\s+(.{2,48})/i,
      /(?:topic|main thread|focus)\s+(?:is|will be|around)\s+(.{2,48})/i
    ];
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match?.[1]) {
        return this.extractTopicLabel(match[1]);
      }
    }
    return "";
  }

  private extractTopicLabel(text: string): string {
    const compactCjk = text.replace(CJK_FILLERS, "");
    const cjkChars = compactCjk.match(/[\u4e00-\u9fff]/g)?.length ?? 0;
    const latinChars = text.match(/[a-zA-Z]/g)?.length ?? 0;
    if (cjkChars >= latinChars && compactCjk) {
      return compactCjk.slice(0, 12);
    }

    const english = text
      .toLowerCase()
      .match(/[a-z][a-z0-9-]{2,}/g)
      ?.filter((word) => !ENGLISH_STOPWORDS.has(word))
      .slice(0, 3)
      .join(" ");
    if (english) {
      return english.slice(0, 28);
    }

    if (compactCjk) {
      return compactCjk.slice(0, 12);
    }

    return text.trim().slice(0, 12) || "当前片段";
  }

  private tokenize(text: string): Set<string> {
    const tokens = new Set<string>();
    text
      .toLowerCase()
      .match(/[a-z][a-z0-9-]{2,}/g)
      ?.forEach((word) => {
        if (!ENGLISH_STOPWORDS.has(word)) {
          tokens.add(word);
        }
      });

    text.match(/[\u4e00-\u9fff]{2,}/g)?.forEach((chunk) => {
      const compact = chunk.replace(CJK_FILLERS, "");
      if (compact.length <= 4) {
        tokens.add(compact);
        return;
      }
      for (let index = 0; index < compact.length - 1; index += 1) {
        tokens.add(compact.slice(index, index + 2));
      }
    });

    return tokens;
  }

  private tokensForTexts(texts: string[]): Set<string> {
    const tokens = new Set<string>();
    texts.forEach((text) => {
      this.tokenize(text).forEach((token) => tokens.add(token));
    });
    return tokens;
  }

  private tokenOverlap(a: Set<string>, b: Set<string>): number {
    if (!a.size || !b.size) {
      return 0;
    }
    let shared = 0;
    a.forEach((token) => {
      if (b.has(token)) {
        shared += 1;
      }
    });
    return shared / Math.max(a.size, b.size);
  }

  private findPreviousTopicMatch(currentTokens: Set<string>): string {
    const candidates = this.topicState.topicPath.slice(0, -1).reverse();
    return candidates.find((topic) => this.tokenOverlap(currentTokens, this.tokenize(topic)) >= 0.2) ?? "";
  }

  private nextLocalTopicPath(currentTopic: string, transition: SegmentAnalysis["transition"], rootTopic: string): string[] {
    const path = this.topicState.topicPath.length ? [...this.topicState.topicPath] : rootTopic ? [rootTopic] : [];
    if (!currentTopic) {
      return path.slice(-5);
    }
    if (transition === "return") {
      const existingIndex = path.findIndex((topic) => topic === currentTopic);
      if (existingIndex >= 0) {
        return [...path.slice(0, existingIndex + 1), currentTopic].slice(-5);
      }
    }
    if (path.at(-1) !== currentTopic) {
      path.push(currentTopic);
    }
    return path.filter(Boolean).slice(-5);
  }

  private localConfidence(
    mode: SegmentAnalysis["mode"],
    transition: SegmentAnalysis["transition"],
    previousOverlap: number,
    rootOverlap: number,
    hasAnchor: boolean
  ): number {
    if (hasAnchor) {
      return 0.58;
    }
    if (mode === "establishing") {
      return 0.28;
    }
    if (transition === "continue" || transition === "return") {
      return this.clamp(0.36 + Math.max(previousOverlap, rootOverlap), 0.35, 0.72);
    }
    if (transition === "branch" || transition === "shift") {
      return this.clamp(0.64 - previousOverlap, 0.42, 0.68);
    }
    return 0.34;
  }

  private clamp(value: number, min: number, max: number): number {
    if (!Number.isFinite(value)) {
      return min;
    }
    return Math.min(max, Math.max(min, value));
  }

  private normalizeExpressionMode(value: unknown): SegmentAnalysis["expressionMode"] {
    return value === "anchored" || value === "exploratory" || value === "forming" ? value : "forming";
  }

  private normalizeTransition(value: unknown): SegmentAnalysis["transition"] {
    return value === "continue" || value === "branch" || value === "return" || value === "shift" || value === "uncertain"
      ? value
      : "uncertain";
  }

  private modeFromTransition(rawMode: unknown, transition: SegmentAnalysis["transition"], expressionMode: SegmentAnalysis["expressionMode"]): SegmentAnalysis["mode"] {
    if (rawMode === "establishing" || rawMode === "trunk" || rawMode === "branch" || rawMode === "return" || rawMode === "uncertain") {
      return rawMode;
    }
    if (expressionMode === "forming") {
      return "establishing";
    }
    if (transition === "branch" || transition === "shift") {
      return "branch";
    }
    if (transition === "return") {
      return "return";
    }
    if (transition === "continue") {
      return "trunk";
    }
    return "uncertain";
  }

  private normalizeTopicPath(value: unknown, currentTopic: string): string[] {
    const path = Array.isArray(value) ? value.map(String).map((item) => item.trim()).filter(Boolean) : this.topicState.topicPath;
    const nextPath = currentTopic && !path.includes(currentTopic) ? [...path, currentTopic] : path;
    return nextPath.slice(-5);
  }
}
