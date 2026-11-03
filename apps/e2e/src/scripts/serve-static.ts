/**
 * Tiny static server for the Expo web export (`expo export --platform web`), used by the
 * Playwright `mobile-web` project in CI and locally. It mirrors the production Caddyfile:
 * SPA fallback to `index.html` and no API (`/api/*` and `/trpc/*` answer 503 JSON, so the app
 * treats the session as missing and shows the sign-in screen).
 *
 *   node src/scripts/serve-static.ts
 *
 * Env: `E2E_STATIC_DIR` (default `../mobile/dist/web`), `E2E_STATIC_PORT` (default 8081),
 * `E2E_STATIC_HOST` (default 127.0.0.1).
 */
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";

const ROOT = resolve(
  import.meta.dirname,
  "../..",
  process.env.E2E_STATIC_DIR ?? "../mobile/dist/web",
);
const PORT = Number(process.env.E2E_STATIC_PORT ?? "8081");
const HOST = process.env.E2E_STATIC_HOST ?? "127.0.0.1";

const MIME_TYPES: Readonly<Record<string, string>> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".ttf": "font/ttf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

const API_PREFIXES = ["/api/", "/trpc/"];

/** Absolute path inside ROOT for a URL path, or null when it would escape ROOT. */
function toFilePath(urlPath: string): string | null {
  const decoded = decodeURIComponent(urlPath);
  const filePath = normalize(join(ROOT, decoded));
  return filePath === ROOT || filePath.startsWith(ROOT + sep) ? filePath : null;
}

async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

function sendFile(res: ServerResponse, path: string): void {
  const type = MIME_TYPES[extname(path)] ?? "application/octet-stream";
  res.writeHead(200, { "content-type": type, "cache-control": "no-store" });
  createReadStream(path).pipe(res);
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const { pathname } = new URL(req.url ?? "/", "http://localhost");
  if (API_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    sendJson(res, 503, { message: "API not available in the static E2E server" });
    return;
  }
  const filePath = toFilePath(pathname);
  if (filePath === null) {
    sendJson(res, 400, { message: "Bad path" });
    return;
  }
  if (await isFile(filePath)) {
    sendFile(res, filePath);
    return;
  }
  // Hashed assets that do not exist are real 404s; any other path is a client-side route.
  if (extname(pathname) !== "") {
    sendJson(res, 404, { message: "Not found" });
    return;
  }
  sendFile(res, join(ROOT, "index.html"));
}

const server = createServer((req, res) => {
  handle(req, res).catch((error: unknown) => {
    process.stderr.write(`serve-static: ${String(error)}\n`);
    if (!res.headersSent) sendJson(res, 500, { message: "Internal error" });
    else res.destroy();
  });
});

server.listen(PORT, HOST, () => {
  process.stdout.write(`serve-static: ${ROOT} on http://${HOST}:${String(PORT)}\n`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}
