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
    const previous = history.at(-1)?.text ?? "";
    const overlap = this.characterOverlap(segment.text, previous);
    const establishing = elapsedSeconds < 25 || history.length < 2;
    const mode = establishing ? "establishing" : overlap < 0.08 ? "branch" : overlap < 0.18 ? "uncertain" : "trunk";
    const expressionMode: SegmentAnalysis["expressionMode"] = establishing ? "forming" : "exploratory";
    const transition: SegmentAnalysis["transition"] = mode === "branch" ? "shift" : mode === "uncertain" ? "uncertain" : "continue";
    const currentTopic = segment.text.slice(0, 12) || "当前片段";
    const driftLevel = mode === "branch" ? 0.75 : mode === "uncertain" ? 0.42 : 0.16;
    const topicState = {
      mainThread: history.slice(0, 3).map((item) => item.text).join(" ").slice(0, 42) || "正在形成主线",
      expressionMode,
      rootTopic: "",
      currentTopic,
      topicPath: [...this.topicState.topicPath, currentTopic].filter(Boolean).slice(-5),
      recentSubtopics: [segment.text.slice(0, 10)].filter(Boolean),
      confidence: establishing ? 0.25 : 0.35
    };
    this.topicState = topicState;

    return {
      mode,
      expressionMode,
      transition,
      branchLabel: mode === "branch" ? segment.text.slice(0, 6) || "新分支" : "主线",
      driftLevel,
      reason: "本地演示判断，配置模型后更准确",
      topicState
    };
  }

  private characterOverlap(a: string, b: string): number {
    if (!a || !b) {
      return 0;
    }
    const charsA = new Set([...a].filter((char) => /[\u4e00-\u9fa5a-zA-Z0-9]/.test(char)));
    const charsB = new Set([...b].filter((char) => /[\u4e00-\u9fa5a-zA-Z0-9]/.test(char)));
    if (!charsA.size || !charsB.size) {
      return 0;
    }
    let shared = 0;
    charsA.forEach((char) => {
      if (charsB.has(char)) {
        shared += 1;
      }
    });
    return shared / Math.max(charsA.size, charsB.size);
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
