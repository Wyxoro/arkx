import { Router, type IRouter } from "express";
import { getCached, setCached } from "../lib/cache";
import { logger } from "../lib/logger";
import { getStreamSources } from "../lib/consumet";
import { getProxyConfig } from "../lib/proxy";
import axios from "axios";
import http from "http";
import https from "https";

const router: IRouter = Router();

// ── SSRF protection ────────────────────────────────────────────────────────────
// Block proxying requests to private/loopback/link-local addresses.
const PRIVATE_IP_RE = /^(127\.|10\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.0\.0\.0|::1$|fc[0-9a-f]{2}:|fd[0-9a-f]{2}:)/i;

function isBlockedProxyTarget(raw: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return true; // unparseable — block
  }
  if (!["http:", "https:"].includes(parsed.protocol)) return true;
  const host = parsed.hostname.toLowerCase();
  if (host === "localhost") return true;
  if (PRIVATE_IP_RE.test(host)) return true;
  return false;
}

// ── Internal provider label map ────────────────────────────────────────────────
const PROVIDER_LABELS: Record<string, string> = {
  megaplay:   "ArkPulse-1",
  anikoto:    "ArkPulse-1",
  gogoanime:  "ArkPulse-1",
  hianime:    "ArkPulse-1",
  zoro:       "ArkPulse-1",
  animefox:   "ArkPulse-1",
  animepace:  "ArkPulse-1",
  animepahe:  "ArkPulse-1",
};

function providerToLabel(_provider: string): string {
  return PROVIDER_LABELS[_provider] ?? "ArkPulse-1";
}

// ── Extract episode number from any ID format ──────────────────────────────────
function extractEpisodeNumber(raw: string): number {
  if (/^\d+$/.test(raw)) return parseInt(raw, 10);
  const m = raw.match(/-(\d+)$/);
  return m ? parseInt(m[1], 10) : 1;
}

// ── Shared keep-alive HTTP agents ──────────────────────────────────────────────
//
// The old code called axios.create() inside every request handler, producing a
// brand-new HTTP agent per HLS segment. That means a fresh TCP + TLS handshake
// for every segment — ~80-150 ms of overhead each. With 80 simultaneous streams
// firing 6-10 segments/min that's ~600-800 cold connections/min.
//
// A single shared agent with keepAlive=true reuses warm sockets. The TLS
// handshake cost drops to ~0 ms for repeat requests to the same CDN host.
// maxSockets=512 gives headroom: 80 streams × ~2 concurrent segs each = 160
// in-flight at peak, well within 512.
// scheduling="lifo" picks the hottest (most-recently-used) idle socket first,
// keeping TCP window sizes large and TLS session caches warm.
const sharedHttpAgent = new http.Agent({
  keepAlive: true,
  keepAliveMsecs: 30_000,
  maxSockets: 512,
  maxFreeSockets: 128,
  scheduling: "lifo" as "lifo",
});

const sharedHttpsAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 30_000,
  maxSockets: 512,
  maxFreeSockets: 128,
  scheduling: "lifo" as "lifo",
});

// ── Single shared axios client for all proxy requests ─────────────────────────
//
// responseType:"stream" is the other critical change: instead of waiting for
// the entire segment to land in memory (arraybuffer), we start forwarding bytes
// to the browser the instant the upstream opens the response body. Memory per
// active segment drops from ~2 MB to ~0. At 80 streams that's ~160 MB saved.
const proxyClient = axios.create({
  timeout: 20_000,
  responseType: "stream",
  maxRedirects: 10,
  decompress: false, // TS segments are binary; pass through without decompression
  httpAgent: sharedHttpAgent,
  httpsAgent: sharedHttpsAgent,
});

// ── Precomputed static request headers ────────────────────────────────────────
// Only Referer/Origin vary per request; everything else is constant.
const BASE_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  Accept: "*/*",
  "Accept-Language": "en-US,en;q=0.9",
  // identity: don't ask for gzip — TS/fMP4 segments are already compressed media
  "Accept-Encoding": "identity",
  "Sec-Fetch-Dest": "video",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Site": "cross-site",
  "Sec-Ch-Ua": '"Not/A)Brand";v="8", "Chromium";v="126", "Google Chrome";v="126"',
  "Sec-Ch-Ua-Mobile": "?0",
  "Sec-Ch-Ua-Platform": '"Windows"',
};

// ── Route: GET /stream/proxy ───────────────────────────────────────────────────
// Proxies HLS manifests and segments with injected Referer/Origin headers.
// Browsers cannot set Referer on <video> / HLS.js media requests.
//
// For M3U8 manifests: buffer the text, rewrite every segment URL to route back
// through this proxy, then send.  Manifests are small (<50 KB) — buffering is
// fine and required for the rewrite pass.
//
// For binary segments (.ts / fMP4 / .aac): pipe directly from upstream to the
// browser with zero intermediate buffering.  This is the hot path for playback.
router.get("/stream/proxy", async (req, res): Promise<void> => {
  const rawUrl = req.query.url as string;
  if (!rawUrl) {
    res.status(400).json({ error: "Bad request", message: "Missing required parameter." });
    return;
  }

  let targetUrl: string;
  try {
    targetUrl = decodeURIComponent(rawUrl);
    new URL(targetUrl); // validate shape
  } catch {
    res.status(400).json({ error: "Bad request", message: "Invalid request parameter." });
    return;
  }

  if (isBlockedProxyTarget(targetUrl)) {
    res.status(403).json({ error: "Forbidden", message: "Target not allowed." });
    return;
  }

  const rawReferer = req.query.referer as string | undefined;
  const referer = rawReferer ? decodeURIComponent(rawReferer) : undefined;

  // Build per-request headers: static base + dynamic Referer/Origin
  const requestHeaders: Record<string, string> = { ...BASE_HEADERS };
  if (referer) {
    requestHeaders["Referer"] = referer;
    try {
      requestHeaders["Origin"] = new URL(referer).origin;
    } catch { /* ignore malformed referer */ }
  }

  const proxyConfig = getProxyConfig();

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const upstreamRes = await proxyClient.get<any>(targetUrl, {
      headers: requestHeaders,
      ...(proxyConfig ?? {}),
    });

    const contentType = String(
      upstreamRes.headers["content-type"] ?? "application/octet-stream"
    );
    const isM3U8 =
      contentType.includes("mpegurl") ||
      targetUrl.includes(".m3u8") ||
      targetUrl.includes("index.m3u8");

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "*");
    res.setHeader("Cache-Control", "public, max-age=30");
    res.setHeader(
      "Content-Type",
      isM3U8 ? "application/vnd.apple.mpegurl" : contentType
    );

    if (isM3U8) {
      // ── M3U8 path: collect → rewrite → send ─────────────────────────────────
      // Manifests are small text files; collecting all chunks is cheap.
      const chunks: Buffer[] = [];
      await new Promise<void>((resolve, reject) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const stream: NodeJS.ReadableStream = upstreamRes.data as any;
        stream.on("data", (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
        stream.on("end", resolve);
        stream.on("error", reject);
      });

      const text = Buffer.concat(chunks).toString("utf8");

      function proxyUrl(raw: string): string {
        let absUrl: string;
        if (/^https?:\/\//i.test(raw)) {
          absUrl = raw;
        } else if (raw.startsWith("/")) {
          const base = new URL(targetUrl);
          absUrl = `${base.protocol}//${base.host}${raw}`;
        } else {
          try {
            absUrl = new URL(raw, targetUrl).href;
          } catch {
            return raw;
          }
        }
        const params = new URLSearchParams({ url: absUrl });
        if (referer) params.set("referer", referer);
        return `/api/stream/proxy?${params.toString()}`;
      }

      const lines = text.split(/\r?\n/);
      const out: string[] = [];
      for (const line of lines) {
        if (/^#EXT-X-I-FRAME-STREAM-INF/i.test(line)) continue;

        if (/^#EXT-X-STREAM-INF/i.test(line)) {
          out.push(line.replace(/,?\s*CODECS="[^"]*"/gi, ""));
          continue;
        }

        const rewrittenDirective = line.replace(
          /URI="([^"]+)"/gi,
          (_match, uri) => `URI="${proxyUrl(uri)}"`
        );

        if (!rewrittenDirective.startsWith("#") && rewrittenDirective.trim()) {
          out.push(proxyUrl(rewrittenDirective.trim()));
        } else {
          out.push(rewrittenDirective);
        }
      }

      res.send(out.join("\n"));
    } else {
      // ── Binary segment path: pipe directly ──────────────────────────────────
      // Zero-copy: bytes stream from CDN → Node.js → browser without sitting in
      // a Buffer in the heap.  This is the path taken for every .ts / fMP4
      // segment during active playback (~95% of all proxy requests).
      const contentLength = upstreamRes.headers["content-length"];
      if (contentLength) res.setHeader("Content-Length", contentLength);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const upstream: NodeJS.ReadableStream = upstreamRes.data as any;

      // When the browser disconnects (tab close / seek skip), destroy the
      // upstream socket immediately rather than draining the rest of the segment.
      req.on("close", () => upstream.destroy());

      upstream.on("error", () => {
        if (!res.headersSent) res.status(502).end();
        else res.end();
      });

      upstream.pipe(res);
    }
  } catch {
    // No upstream error details to client
    if (!res.headersSent) res.status(502).end();
    else res.end();
  }
});

// ── Route: GET /stream/:animeId/:episodeId ─────────────────────────────────────
router.get("/stream/:animeId/:episodeId", async (req, res): Promise<void> => {
  const animeId = parseInt(String(req.params.animeId), 10);
  if (isNaN(animeId)) {
    res.status(400).json({ error: "Bad request", message: "Invalid request." });
    return;
  }

  const episodeId = String(req.params.episodeId);
  const epNumber = extractEpisodeNumber(episodeId);
  const cacheKey = `stream:v2:${animeId}:${epNumber}`;

  const cached = getCached(cacheKey);
  if (cached) {
    res.json(cached);
    return;
  }

  // Global timeout: worst-case parallel Anikoto path = ~45 s; 55 s covers that
  // plus Hianime fallback if needed.
  const STREAM_TIMEOUT_MS = 55_000;
  let result;
  try {
    result = await Promise.race([
      getStreamSources(episodeId, animeId),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("stream_timeout")), STREAM_TIMEOUT_MS)
      ),
    ]);
  } catch (err) {
    const isTimeout = err instanceof Error && err.message === "stream_timeout";
    if (isTimeout) {
      logger.warn({ animeId, episodeId, epNumber }, "Stream timed out — all providers slow/unavailable");
      res.status(504).json({
        error: "Timeout",
        message: "Stream servers are taking too long. Try switching to ArkPulse-2.",
      });
    } else {
      res.status(503).json({
        error: "Service unavailable",
        message: "Stream servers are temporarily unavailable. Please try again shortly.",
      });
    }
    return;
  }

  if (!result || result.sources.length === 0) {
    res.status(404).json({
      error: "Not found",
      message: "No stream available for this episode. Please try again or select a different server.",
    });
    return;
  }

  const response = {
    sources: result.sources,
    subtitles: result.subtitles.map((s) => ({
      url: s.url,
      lang: s.lang,
      label: s.lang,
    })),
    headers: result.headers,
    provider: providerToLabel(result.provider),
    episodeId,
    intro: result.intro ?? null,
    outro: result.outro ?? null,
  };

  logger.info(
    { animeId, epNumber, sourceCount: result.sources.length },
    "Stream resolved"
  );

  setCached(cacheKey, response, 900);
  res.json(response);
});

export default router;
