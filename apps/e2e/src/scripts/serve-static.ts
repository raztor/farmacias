/**
 * Tiny static server for the Expo web export (`expo export --platform web`), used by the
 * Playwright `mobile-web-*` projects (started by `e2e-stack.ts`). It mirrors the production
 * Caddyfile (`apps/mobile/Caddyfile`): SPA fallback to `index.html`, and `/api/auth/*` +
 * `/trpc/*` proxied to the API so the session cookie is first-party (the export is built with an
 * empty `EXPO_PUBLIC_API_URL` = same origin). Without `E2E_API_UPSTREAM` those paths answer
 * 503 JSON and the app shows the sign-in screen.
 *
 *   node src/scripts/serve-static.ts
 *
 * Env: `E2E_STATIC_DIR` (default `../mobile/dist/web`), `E2E_STATIC_PORT` (default 8081),
 * `E2E_STATIC_HOST` (default 127.0.0.1), `E2E_API_UPSTREAM` (e.g. http://127.0.0.1:4000).
 */
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import {
  createServer,
  request as httpRequest,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";

const ROOT = resolve(
  import.meta.dirname,
  "../..",
  process.env.E2E_STATIC_DIR ?? "../mobile/dist/web",
);
const PORT = Number(process.env.E2E_STATIC_PORT ?? "8081");
const HOST = process.env.E2E_STATIC_HOST ?? "127.0.0.1";
const API_UPSTREAM =
  process.env.E2E_API_UPSTREAM === undefined || process.env.E2E_API_UPSTREAM === ""
    ? null
    : new URL(process.env.E2E_API_UPSTREAM);

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

const API_PREFIXES = ["/api/auth/", "/trpc/"];

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

/**
 * Reverse proxy to the API, like Caddy's `reverse_proxy`: keeps the original Host and adds
 * X-Forwarded-For/-Proto/-Host (the API trusts one proxy hop).
 */
function proxyToApi(upstream: URL, req: IncomingMessage, res: ServerResponse): void {
  const forwardedFor = [req.headers["x-forwarded-for"], req.socket.remoteAddress]
    .filter((value) => typeof value === "string" && value !== "")
    .join(", ");
  const proxied = httpRequest(
    {
      protocol: upstream.protocol,
      hostname: upstream.hostname,
      port: upstream.port,
      method: req.method,
      path: req.url,
      headers: {
        ...req.headers,
        "x-forwarded-for": forwardedFor,
        "x-forwarded-proto": "http",
        "x-forwarded-host": req.headers.host ?? "",
      },
    },
    (upstreamRes) => {
      res.writeHead(upstreamRes.statusCode ?? 502, upstreamRes.headers);
      upstreamRes.pipe(res);
    },
  );
  proxied.on("error", (error) => {
    process.stderr.write(`serve-static: proxy error ${String(error)}\n`);
    if (!res.headersSent) sendJson(res, 502, { message: "API unreachable" });
    else res.destroy();
  });
  req.pipe(proxied);
}

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const { pathname } = new URL(req.url ?? "/", "http://localhost");
  if (API_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    if (API_UPSTREAM === null) {
      sendJson(res, 503, { message: "API not available in the static E2E server" });
    } else {
      proxyToApi(API_UPSTREAM, req, res);
    }
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
