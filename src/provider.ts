export function normalizeBaseUrl(input: string, fallback: string): string {
  const trimmed = input.trim() || fallback;
  const withoutTrailingSlash = trimmed.replace(/\/+$/, "");
  const stripped = withoutTrailingSlash
    .replace(/\/chat\/completions$/i, "")
    .replace(/\/audio\/transcriptions$/i, "")
    .replace(/\/models$/i, "");
  return /\/v\d+$/i.test(stripped) ? stripped : `${stripped}/v1`;
}

export function endpoint(
  baseUrl: string,
  path: "chat/completions" | "audio/transcriptions" | "models" | "realtime/calls"
): string {
  if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    return `/api/provider/${path}`;
  }
  return `${normalizeBaseUrl(baseUrl, "https://api.openai.com/v1")}/${path}`;
}

export function providerRequestHeaders(baseUrl: string, apiKey: string, contentType?: string): HeadersInit {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`
  };
  if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    headers["X-Provider-Base-URL"] = normalizeBaseUrl(baseUrl, "https://api.openai.com/v1");
  }
  if (contentType) {
    headers["Content-Type"] = contentType;
  }
  return headers;
}

export async function fetchAvailableModels(baseUrl: string, apiKey: string): Promise<string[]> {
  const response = await fetch(endpoint(baseUrl, "models"), {
    method: "GET",
    headers: providerRequestHeaders(baseUrl, apiKey)
  });

  if (!response.ok) {
    throw new Error(`Models request failed: ${response.status}`);
  }

  const payload = await response.json();
  const models = Array.isArray(payload?.data) ? payload.data : [];
  return models
    .map((model: { id?: unknown }) => model.id)
    .filter((id: unknown): id is string => typeof id === "string" && id.length > 0)
    .sort((a: string, b: string) => a.localeCompare(b));
}

export async function testChatConnection(baseUrl: string, apiKey: string, model: string): Promise<void> {
  const response = await fetch(endpoint(baseUrl, "chat/completions"), {
    method: "POST",
    headers: providerRequestHeaders(baseUrl, apiKey, "application/json"),
    body: JSON.stringify({
      model,
      temperature: 0,
      max_tokens: 8,
      messages: [
        {
          role: "user",
          content: "Return OK."
        }
      ]
    })
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Chat request failed: ${response.status}${detail ? ` ${detail.slice(0, 160)}` : ""}`);
  }
}
