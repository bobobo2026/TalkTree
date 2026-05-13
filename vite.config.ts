import { defineConfig, type Plugin } from "vite";

type ProviderPath = "models" | "chat/completions" | "audio/transcriptions" | "realtime/calls";

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? "/TalkTree/" : "/",
  plugins: [providerProxy()]
});

function providerProxy(): Plugin {
  return {
    name: "talktree-provider-proxy",
    configureServer(server) {
      server.middlewares.use("/api/provider", async (req, res) => {
        try {
          const path = req.url?.replace(/^\/+/, "") as ProviderPath;
          if (!["models", "chat/completions", "audio/transcriptions", "realtime/calls"].includes(path)) {
            sendJson(res, 404, { error: "Unknown provider endpoint" });
            return;
          }

          const baseUrl = normalizeBaseUrl(String(req.headers["x-provider-base-url"] ?? ""));
          const auth = req.headers.authorization;
          if (!baseUrl || !auth) {
            sendJson(res, 400, { error: "Missing provider base URL or authorization" });
            return;
          }

          const target = `${baseUrl}/${path}`;
          const body = req.method === "GET" || req.method === "HEAD" ? undefined : await readRequestBody(req);
          const headers: Record<string, string> = {
            Authorization: auth
          };
          const contentType = req.headers["content-type"];
          if (contentType) {
            headers["Content-Type"] = String(contentType);
          }

          const upstream = await fetch(target, {
            method: req.method,
            headers,
            body
          });
          const buffer = Buffer.from(await upstream.arrayBuffer());
          res.statusCode = upstream.status;
          res.setHeader("Access-Control-Allow-Origin", "*");
          res.setHeader("Content-Type", upstream.headers.get("content-type") ?? "application/json");
          res.end(buffer);
        } catch (error) {
          sendJson(res, 502, {
            error: error instanceof Error ? error.message : "Provider proxy failed"
          });
        }
      });
    }
  };
}

function normalizeBaseUrl(input: string): string {
  const withoutTrailingSlash = input.trim().replace(/\/+$/, "");
  if (!withoutTrailingSlash) {
    return "";
  }
  const stripped = withoutTrailingSlash
    .replace(/\/chat\/completions$/i, "")
    .replace(/\/audio\/transcriptions$/i, "")
    .replace(/\/models$/i, "");
  return /\/v\d+$/i.test(stripped) ? stripped : `${stripped}/v1`;
}

function readRequestBody(req: Parameters<Parameters<Plugin["configureServer"]>[0]["middlewares"]["use"]>[1]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function sendJson(res: Parameters<Parameters<Plugin["configureServer"]>[0]["middlewares"]["use"]>[1], status: number, payload: unknown): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}
