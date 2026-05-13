import type { AnalyzerConfig, SpeechSegment } from "./types";
import { endpoint, providerRequestHeaders } from "./provider";

export interface RealtimeTranscriberHandlers {
  onInterim: (text: string) => void;
  onSegment: (segment: SpeechSegment) => void;
  onStatus: (message: string) => void;
  onError: (message: string) => void;
}

type RealtimeEvent = {
  type?: string;
  delta?: string;
  transcript?: string;
};

export class RealtimeTranscriber {
  private peer: RTCPeerConnection | null = null;
  private stream: MediaStream | null = null;
  private currentText = "";
  private segmentStartedAt = 0;

  constructor(
    private getConfig: () => AnalyzerConfig,
    private handlers: RealtimeTranscriberHandlers
  ) {}

  async start(): Promise<void> {
    const config = this.getConfig();
    if (!config.apiKey.trim()) {
      this.handlers.onError("未配置 API Key，无法使用实时转写。");
      return;
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.peer = new RTCPeerConnection();
      this.stream.getTracks().forEach((track) => this.peer?.addTrack(track, this.stream as MediaStream));

      const channel = this.peer.createDataChannel("oai-events");
      channel.onmessage = (event) => this.handleRealtimeEvent(event.data);
      channel.onerror = () => this.handlers.onError("Realtime 数据通道遇到问题。");

      const offer = await this.peer.createOffer();
      await this.peer.setLocalDescription(offer);

      const session = {
        type: "transcription",
        model: config.realtimeModel,
        audio: {
          input: {
            transcription: {
              model: config.transcriptionModel,
              language: "zh"
            },
            turn_detection: {
              type: "server_vad",
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 650
            }
          }
        }
      };

      const form = new FormData();
      form.set("sdp", offer.sdp ?? "");
      form.set("session", JSON.stringify(session));

      const response = await fetch(endpoint(config.baseUrl, "realtime/calls"), {
        method: "POST",
        headers: providerRequestHeaders(config.baseUrl, config.apiKey),
        body: form
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new Error(`Realtime failed: ${response.status}${detail ? ` ${detail.slice(0, 160)}` : ""}`);
      }

      const answer = await response.text();
      await this.peer.setRemoteDescription({ type: "answer", sdp: answer });
      this.segmentStartedAt = performance.now();
      this.handlers.onStatus("Realtime 转写已连接");
    } catch (error) {
      this.stop();
      console.warn(error);
      this.handlers.onError("Realtime 转写不可用，可能是中转站未代理 /realtime/calls。");
    }
  }

  stop(): void {
    this.peer?.close();
    this.peer = null;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.currentText = "";
  }

  private handleRealtimeEvent(raw: string): void {
    let event: RealtimeEvent;
    try {
      event = JSON.parse(raw) as RealtimeEvent;
    } catch {
      return;
    }

    if (event.type === "conversation.item.input_audio_transcription.delta" && event.delta) {
      this.currentText += event.delta;
      this.handlers.onInterim(this.currentText);
      return;
    }

    if (event.type === "conversation.item.input_audio_transcription.completed") {
      const text = (event.transcript || this.currentText).trim();
      this.currentText = "";
      if (!text) {
        return;
      }
      const now = performance.now();
      this.handlers.onSegment({
        id: crypto.randomUUID(),
        text,
        startTime: this.segmentStartedAt || now,
        endTime: now
      });
      this.segmentStartedAt = now;
    }
  }
}
