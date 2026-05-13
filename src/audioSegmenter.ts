export interface AudioSegment {
  id: string;
  blob: Blob;
  startTime: number;
  endTime: number;
  averageLevel: number;
}

export interface AudioSegmenterHandlers {
  onSegment: (segment: AudioSegment) => void;
  onLevel: (level: number) => void;
  onStatus: (message: string) => void;
  onError: (message: string) => void;
}

export class AudioSegmenter {
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private levelTimer: number | null = null;
  private chunkStartedAt = 0;
  private levels: number[] = [];

  constructor(private handlers: AudioSegmenterHandlers) {}

  async start(): Promise<void> {
    if (this.recorder?.state === "recording") {
      return;
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.setupLevelMeter(this.stream);
      const mimeType = this.pickMimeType();
      this.recorder = new MediaRecorder(this.stream, mimeType ? { mimeType } : undefined);
      this.chunkStartedAt = performance.now();
      this.levels = [];

      this.recorder.ondataavailable = (event) => {
        if (!event.data.size) {
          return;
        }
        const now = performance.now();
        this.handlers.onSegment({
          id: crypto.randomUUID(),
          blob: event.data,
          startTime: this.chunkStartedAt,
          endTime: now,
          averageLevel: this.averageLevel()
        });
        this.chunkStartedAt = now;
        this.levels = [];
      };

      this.recorder.onerror = () => {
        this.handlers.onError("麦克风录音遇到问题，请重新开始。");
      };

      this.recorder.start(4500);
      this.handlers.onStatus("已切到麦克风录音模式");
    } catch {
      this.handlers.onError("无法读取麦克风。请确认浏览器和系统权限都已允许。");
    }
  }

  stop(): void {
    if (this.recorder?.state === "recording") {
      this.recorder.requestData();
      this.recorder.stop();
    }
    this.recorder = null;

    if (this.levelTimer) {
      window.clearInterval(this.levelTimer);
      this.levelTimer = null;
    }

    this.audioContext?.close().catch(() => undefined);
    this.audioContext = null;
    this.analyser = null;

    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.handlers.onLevel(0);
    this.handlers.onStatus("已停止");
  }

  private setupLevelMeter(stream: MediaStream): void {
    this.audioContext = new AudioContext();
    const source = this.audioContext.createMediaStreamSource(stream);
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 1024;
    source.connect(this.analyser);

    const samples = new Uint8Array(this.analyser.fftSize);
    this.levelTimer = window.setInterval(() => {
      if (!this.analyser) {
        return;
      }
      this.analyser.getByteTimeDomainData(samples);
      let sum = 0;
      for (const sample of samples) {
        const centered = sample - 128;
        sum += centered * centered;
      }
      const rms = Math.sqrt(sum / samples.length) / 128;
      const level = Math.min(1, rms * 4.5);
      this.levels.push(level);
      this.handlers.onLevel(level);
    }, 120);
  }

  private averageLevel(): number {
    if (!this.levels.length) {
      return 0;
    }
    return this.levels.reduce((sum, level) => sum + level, 0) / this.levels.length;
  }

  private pickMimeType(): string {
    const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
    return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate)) ?? "";
  }
}
