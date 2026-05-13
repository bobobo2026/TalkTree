import type { SpeechSegment } from "./types";

type SpeechRecognitionConstructor = new () => SpeechRecognition;

interface SpeechRecognitionAlternative {
  transcript: string;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  0: SpeechRecognitionAlternative;
}

interface SpeechRecognitionResultList {
  length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

export interface SpeechRecognizerHandlers {
  onInterim: (text: string) => void;
  onSegment: (segment: SpeechSegment) => void;
  onStatus: (message: string) => void;
  onError: (message: string) => void;
}

export class SpeechSegmenter {
  private recognition: SpeechRecognition | null = null;
  private buffer = "";
  private segmentStartedAt = 0;
  private lastFlushAt = 0;
  private isRunning = false;
  private restartTimer: number | null = null;

  constructor(private handlers: SpeechRecognizerHandlers) {}

  static isSupported(): boolean {
    return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  start(): void {
    if (!SpeechSegmenter.isSupported()) {
      this.handlers.onError("当前浏览器不支持实时语音识别。请使用桌面版 Chrome。");
      return;
    }

    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    this.buffer = "";
    this.segmentStartedAt = performance.now();
    this.lastFlushAt = this.segmentStartedAt;
    this.createRecognition();
    this.recognition?.start();
    this.handlers.onStatus("正在听你说话");
  }

  stop(): void {
    this.isRunning = false;
    if (this.restartTimer) {
      window.clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
    this.flush("stop");
    this.recognition?.stop();
    this.recognition = null;
    this.handlers.onStatus("已停止");
  }

  private createRecognition(): void {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      return;
    }

    this.recognition = new Recognition();
    this.recognition.lang = "zh-CN";
    this.recognition.continuous = true;
    this.recognition.interimResults = true;

    this.recognition.onresult = (event) => {
      let interim = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result[0]?.transcript.trim() ?? "";
        if (!transcript) {
          continue;
        }
        if (result.isFinal) {
          this.appendFinalText(transcript);
        } else {
          interim += transcript;
        }
      }
      this.handlers.onInterim(interim);
    };

    this.recognition.onerror = (event) => {
      if (event.error === "network" || event.error === "not-allowed" || event.error === "service-not-allowed") {
        this.isRunning = false;
        this.recognition?.abort();
      }
      this.handlers.onError(`语音识别遇到问题：${event.error}`);
    };

    this.recognition.onend = () => {
      if (!this.isRunning) {
        return;
      }
      this.restartTimer = window.setTimeout(() => {
        this.createRecognition();
        try {
          this.recognition?.start();
        } catch {
          this.handlers.onError("语音识别重启失败，请重新点击开始。");
        }
      }, 350);
    };
  }

  private appendFinalText(text: string): void {
    const now = performance.now();
    if (!this.buffer) {
      this.segmentStartedAt = now;
    }
    this.buffer = `${this.buffer}${text}`.trim();
    this.handlers.onInterim("");

    const elapsed = now - this.lastFlushAt;
    const hasSentenceEnd = /[。！？!?；;]/.test(text);
    const hasEnoughText = this.buffer.length >= 24;
    if ((elapsed > 8000 && hasEnoughText) || elapsed > 15000 || hasSentenceEnd) {
      this.flush("speech");
    }
  }

  private flush(reason: "speech" | "stop"): void {
    const text = this.buffer.trim();
    if (!text) {
      return;
    }

    const now = performance.now();
    this.handlers.onSegment({
      id: crypto.randomUUID(),
      text,
      startTime: this.segmentStartedAt,
      endTime: now
    });
    this.buffer = "";
    this.lastFlushAt = now;

    if (reason === "stop") {
      this.handlers.onInterim("");
    }
  }
}
