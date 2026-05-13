import type { AnalyzerConfig } from "./types";
import { endpoint, providerRequestHeaders } from "./provider";

export async function transcribeAudio(config: AnalyzerConfig, blob: Blob): Promise<string> {
  if (!config.apiKey.trim()) {
    return "";
  }

  const form = new FormData();
  form.append("model", config.transcriptionModel);
  form.append("language", "zh");
  form.append("file", blob, `speech-${Date.now()}.webm`);

  const response = await fetch(endpoint(config.baseUrl, "audio/transcriptions"), {
    method: "POST",
    headers: providerRequestHeaders(config.baseUrl, config.apiKey),
    body: form
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Transcription failed: ${response.status}${detail ? ` ${detail.slice(0, 180)}` : ""}`);
  }

  const payload = await response.json();
  return typeof payload.text === "string" ? payload.text.trim() : "";
}
