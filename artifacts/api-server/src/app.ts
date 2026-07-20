import path from "node:path";
import { fileURLToPath } from "node:url";
import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { rateLimit } from "express-rate-limit";
import router from "./routes";
import { logger } from "./lib/logger";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProd = process.env.NODE_ENV === "production";

const app: Express = express();

// Trust exactly one proxy hop (the platform reverse-proxy). Required for accurate
// req.ip — without this, req.ip would always be 127.0.0.1 and per-IP rate
// limiting would be useless.
app.set("trust proxy", 1);

// ── Disable Express fingerprinting ───────────────────────────────────────────
app.disable("x-powered-by");
app.disable("etag");

// ── Security headers — applied to every response ──────────────────────────────
// These are set before any route handler so they cannot be accidentally omitted.
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.removeHeader("X-Powered-By");
  res.removeHeader("X-Runtime");
  res.removeHeader("X-Version");
  res.removeHeader("X-Request-Id");
  res.setHeader("Server", "ArkStream");                              // mask Node/Express
  res.setHeader("X-Content-Type-Options",  "nosniff");               // no MIME-sniff
  res.setHeader("X-Frame-Options",         "DENY");                  // clickjacking
  res.setHeader("X-XSS-Protection",        "0");                     // disable legacy XSS auditor (exploitable in IE/old Chrome)
  res.setHeader("X-DNS-Prefetch-Control",  "off");                   // no prefetch leakage
  res.setHeader("X-Download-Options",      "noopen");                // IE attachment hijack
  res.setHeader("Referrer-Policy",         "no-referrer");           // no leakage upstream
  res.setHeader("Permissions-Policy",      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), bluetooth=(), interest-cohort=()");
  // In production the same server also delivers the React SPA — use a permissive
  // but scoped CSP.  In dev/API-only mode lock it all the way down.
  const csp = isProd
    ? "default-src 'none'; " +
      "script-src 'self'; " +
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
      "font-src 'self' https://fonts.gstatic.com data:; " +
      "img-src 'self' data: https: blob:; " +
      "connect-src 'self' https://graphql.anilist.co https://api.jikan.moe; " +
      "media-src 'self' blob: https:; " +
      "frame-ancestors 'none'; " +
      "base-uri 'self'; " +
      "form-action 'none'"
    : "default-src 'none'; frame-ancestors 'none'";
  res.setHeader("Content-Security-Policy", csp);
  res.setHeader("Strict-Transport-Security","max-age=63072000; includeSubDomains; preload"); // 2-year HSTS
  res.setHeader("Cross-Origin-Opener-Policy",   "same-origin");
  res.setHeader("Cross-Origin-Resource-Policy",  "cross-origin");    // streams need cross-origin fetch
  res.setHeader("Cross-Origin-Embedder-Policy",  "unsafe-none");
  res.setHeader("Cache-Control", "no-store");                        // default; overridden per-route
  res.setHeader("Pragma", "no-cache");
  next();
});

// ── CORS ──────────────────────────────────────────────────────────────────────
// Only allow requests from ArkStream preview/dev domains and localhost.
// No wildcard — prevents CSRF-style abuse from third-party sites.
const ALLOWED_ORIGINS_RE =
  /^https?:\/\/(?:localhost(?::\d+)?|127\.0\.0\.1(?::\d+)?|.*\.replit\.dev|.*\.repl\.co|(?:www\.)?arkstream\.org)$/;

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || ALLOWED_ORIGINS_RE.test(origin)) {
        cb(null, true);
      } else {
        cb(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Accept", "Range"],
    exposedHeaders: ["Content-Range", "Accept-Ranges", "Content-Length"],
  })
);

// ── URL length guard — block excessively long URLs (parser exhaustion / log flood)
const MAX_URL_LENGTH = 4096;
app.use((req: Request, res: Response, next: NextFunction) => {
  if ((req.url?.length ?? 0) > MAX_URL_LENGTH) {
    res.status(414).json({ error: "URI Too Long", message: "Request URL exceeds the maximum allowed length." });
    return;
  }
  next();
});

// ── Method guard — this API is GET-only ──────────────────────────────────────
// Reject any non-GET/OPTIONS before further processing.
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.method !== "GET" && req.method !== "OPTIONS") {
    res.status(405).set("Allow", "GET, OPTIONS").json({ error: "Method not allowed" });
    return;
  }
  next();
});

// ── Request timeout — 30 s hard limit (slow-loris / runaway upstream guard) ──
const REQUEST_TIMEOUT_MS = 30_000;
app.use((req: Request, res: Response, next: NextFunction) => {
  const timer = setTimeout(() => {
    if (!res.headersSent) {
      res.status(503).json({ error: "Timeout", message: "Request timed out." });
    }
  }, REQUEST_TIMEOUT_MS);
  // Clear the timer when the response finishes so we don't leak timers
  res.on("finish", () => clearTimeout(timer));
  res.on("close",  () => clearTimeout(timer));
  next();
});

// ── Structured request logging — strip query strings to avoid token leakage ─
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id:     req.id,
          method: req.method,
          url:    req.url?.split("?")[0],  // no query strings in logs
        };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

// ── Rate limiting — differentiated per endpoint class ─────────────────────────
//
// Architecture: three scoped limiters, with explicit skip conditions so that
// the general apiLimiter does NOT apply to /stream/* routes.
//
// Inside app.use("/api/stream/proxy", fn):  req.path = "/"
// Inside app.use("/api/stream",       fn):  req.path = "/proxy", "/:id/:epId", …
// Inside app.use("/api",              fn):  req.path = "/stream/…", "/healthz", …
//
// Capacity targets:
//   100 streams × ~12 segs/min = 1 200 req/min proxy peak → 12 000 headroom
//   500 browsing users × 300 req/min = 150 000 — global limiter covers this

// HLS proxy:  each active stream fetches 6-12 segments per minute.
//   100 streams × 12 = 1 200/min; 12 000 gives 10× headroom.
const proxyLimiter = rateLimit({
  windowMs: 60_000,
  max:      12_000,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { error: "Too many requests", message: "Proxy rate limit exceeded." },
});

// Stream resolution:  one-shot expensive upstream call.
//   60/min = one new episode per second; generous for a single user.
const streamLimiter = rateLimit({
  windowMs: 60_000,
  max:      60,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { error: "Too many requests", message: "Stream rate limit exceeded. Please wait." },
  // Skip /proxy — it has its own limiter and must not be double-throttled.
  // Inside app.use("/api/stream", fn) req.path is "/proxy" or "/:id/:epId".
  skip: (req) => req.path === "/proxy" || req.path.startsWith("/proxy?"),
});

// General API:  search, listings, anime detail.
//   300/min is ample for heavy browsing.  Skip /stream/* (has dedicated limits).
const apiLimiter = rateLimit({
  windowMs: 60_000,
  max:      300,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { error: "Too many requests", message: "Rate limit exceeded. Try again shortly." },
  // Inside app.use("/api", fn), req.path starts after "/api".
  skip: (req) => req.path === "/healthz" || req.path.startsWith("/stream"),
});

// ── Concurrent HLS stream guard — max 2 active streams per IP ─────────────────
//
// A "stream" is identified by the CDN hostname + the first few path segments of
// the m3u8 manifest URL.  Only manifest requests are gated (not .ts segments).
// Streams expire after 45 s of inactivity — well beyond the 2–10 s HLS refresh
// cycle, so legitimate streams always refresh in time.
//
// Same manifest URL from multiple tabs = same streamKey = counted once (correct).
// Different anime in parallel = different host/path = distinct streams (limited).

type StreamMap = Map<string, number>; // streamKey → last-activity timestamp
const activeStreamMap = new Map<string, StreamMap>(); // ip → streams
const STREAM_TTL_MS  = 45_000;
// HLS.js fetches master manifest + quality-level manifests in parallel (all .m3u8).
// Even with the 2-segment key fix, allow up to 6 slots so multi-quality streaming
// and brief overlap during episode switches never hit the guard.
const MAX_STREAMS    = 8;

// Periodic full cleanup — prevents unbounded memory growth over long uptime.
setInterval(() => {
  const cutoff = Date.now() - STREAM_TTL_MS;
  for (const [ip, streams] of activeStreamMap) {
    for (const [k, ts] of streams) { if (ts < cutoff) streams.delete(k); }
    if (streams.size === 0) activeStreamMap.delete(ip);
  }
}, 60_000).unref(); // .unref() — do not keep process alive just for cleanup

function buildStreamKey(rawUrl: string): string | null {
  try {
    const u = new URL(rawUrl);
    // Use hostname + first 2 path segments only.
    // HLS.js fetches a master manifest AND separate quality-level manifests — both
    // are .m3u8 files but at different sub-paths under the same base directory.
    // Using only 2 segments keeps all manifests for the same episode under one key,
    // so a single active stream never burns more than 1 slot in the concurrent guard.
    const segs = u.pathname.split("/").slice(0, 3).join("/");
    return `${u.hostname}${segs}`;
  } catch {
    return null;
  }
}

function concurrentStreamGuard(req: Request, res: Response, next: NextFunction): void {
  const rawUrl = req.query.url as string | undefined;
  if (!rawUrl) return next(); // malformed — let route handler reject it

  // Gate only on m3u8 manifest requests; .ts segments pass through freely.
  const lower = rawUrl.toLowerCase().split("?")[0];
  const isManifest =
    lower.endsWith(".m3u8") ||
    lower.includes("/manifest") ||
    lower.includes("/playlist") ||
    lower.includes("index.m3u");
  if (!isManifest) return next();

  let decoded: string;
  try { decoded = decodeURIComponent(rawUrl); }
  catch { return next(); }

  const key = buildStreamKey(decoded);
  if (!key) return next();

  const ip = ((req.ip ?? req.socket?.remoteAddress ?? "0.0.0.0") as string)
    .replace(/^::ffff:/, "");

  if (!activeStreamMap.has(ip)) activeStreamMap.set(ip, new Map());
  const ipStreams = activeStreamMap.get(ip)!;

  // Prune expired entries for this IP
  const now = Date.now();
  for (const [k, ts] of ipStreams) {
    if (now - ts > STREAM_TTL_MS) ipStreams.delete(k);
  }

  if (ipStreams.has(key)) {
    ipStreams.set(key, now); // refresh TTL for existing stream
    return next();
  }

  if (ipStreams.size >= MAX_STREAMS) {
    res.status(429).json({
      error:       "Concurrent stream limit reached",
      message:     `You can watch at most ${MAX_STREAMS} streams at once. Please close another video first.`,
      retryAfter:  Math.ceil(STREAM_TTL_MS / 1000),
    });
    return;
  }

  ipStreams.set(key, now); // register new stream
  next();
}

// ── Body parsers — tight limits (API is GET-only; bodies are ignored anyway) ─
app.use(express.json({ limit: "4kb" }));
app.use(express.urlencoded({ extended: false, limit: "4kb" }));

// ── Apply limiters in order (most specific → most general) ───────────────────
app.use("/api/stream/proxy", concurrentStreamGuard, proxyLimiter);
app.use("/api/stream",       streamLimiter);
app.use("/api",              apiLimiter);

app.use("/api", router);

// ── Production: serve the Vite-built React SPA ───────────────────────────────
// In production the dist folder sits two levels above this compiled file:
//   dist/index.mjs  →  ../../artifacts/arkstream/dist/public
if (isProd) {
  const clientDir = path.resolve(__dirname, "../../artifacts/arkstream/dist/public");

  // Static assets — Vite outputs content-hashed filenames, so they can be
  // cached for a year.  index.html itself must never be cached.
  app.use(
    express.static(clientDir, {
      index: false, // SPA fallback below handles index.html
      setHeaders(res, filePath) {
        if (filePath.endsWith("index.html")) {
          res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        } else {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        }
      },
    }),
  );

  // SPA fallback — all unmatched routes get index.html so React Router can take over.
  app.get("*", (_req: Request, res: Response) => {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.sendFile(path.join(clientDir, "index.html"));
  });
} else {
  // Development / API-only mode — 404 for anything not under /api
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: "Not found", message: "The requested resource does not exist." });
  });
}

// ── Global error handler — never expose internals to clients ─────────────────
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err }, "Unhandled request error");
  if (res.headersSent) return;
  res.status(500).json({ error: "Internal error", message: "Something went wrong. Please try again." });
});

export default app;
