/**
 * Streaming provider client — four-tier fallback chain:
 *
 *  1. MegaPlay     (anime-sdk) — indexes by AniList ID directly, no mapping step
 *  2. Anikoto      (anime-sdk) — anikototv.to, megaplay.buzz subtitles; via MappingClient
 *  3. Gogoanime    (anime-sdk) — anineko.to; via MappingClient
 *  4. Hianime      (dksanime-api) — search-based, needs anime title
 *
 * Note: kuramanime-api is a standalone HTTP server (not a library), so it is
 * not included in this in-process pipeline.
 */

import {
  AnikotoProvider,
  GogoanimeProvider,
  MegaPlayProvider,
  MappingClient,
  HttpClient,
  FetchTransport,
  CurlFallbackTransport,
  buildUrn,
  type IMediaMetadata,
  type IVideoPayload,
  type ISubtitleTrack,
  type Urn,
} from "anime-sdk";

import { logger } from "./logger";
import { getCached, setCached } from "./cache";
import { getAnimeDetail } from "./anilist";

// ── Shared HTTP client ─────────────────────────────────────────────────────────
// Use curl-fallback transport so requests survive TLS quirks / anti-bot
// challenges that the built-in `fetch` can't handle.
const http = new HttpClient({
  transport: new CurlFallbackTransport(),
  timeoutMs: 18000,
});

// ── Provider instances (singletons) ──────────────────────────────────────────
const megaplay = new MegaPlayProvider(http);
const anikoto = new AnikotoProvider(http);
const gogoanime = new GogoanimeProvider(http);
const mappingClient = new MappingClient(http);

// ── Exported types (kept compatible with existing route consumers) ────────────
export interface ConsumetEpisode {
  id: string;
  number: number;
  title: string | null;
  image: string | null;
  airDate: string | null;
  description: string | null;
}

export interface ConsumetSource {
  url: string;
  quality: string;
  isM3U8: boolean;
}

export interface ConsumetSubtitle {
  url: string;
  lang: string;
}

export interface ConsumetStreamResult {
  sources: ConsumetSource[];
  subtitles: ConsumetSubtitle[];
  headers: Record<string, string> | null;
  intro?: { start: number; end: number } | null;
  outro?: { start: number; end: number } | null;
  provider: string;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/** Extract the 1-based episode number from any ID format we use. */
function extractEpNumber(episodeId: string): number {
  if (/^\d+$/.test(episodeId)) return parseInt(episodeId, 10);
  const m = episodeId.match(/-(\d+)$/);
  return m ? parseInt(m[1], 10) : 1;
}

/** Map anime-sdk IVideoPayload[] → ConsumetStreamResult. */
function fromSdkPayloads(
  payloads: IVideoPayload[],
  provider: string
): ConsumetStreamResult | null {
  if (!payloads.length) return null;

  // Prefer 'sub' if multiple language streams, otherwise take all
  const subPayloads = payloads.filter((p) => !p.language || p.language === "sub");
  const chosen = subPayloads.length ? subPayloads : payloads;

  const sources: ConsumetSource[] = chosen.map((p) => ({
    url: p.sourceUrl,
    quality: p.quality,
    isM3U8: p.isHLS,
  }));

  // Collect subtitles from all payloads (deduplicated by url)
  const seenUrls = new Set<string>();
  const subtitles: ConsumetSubtitle[] = [];
  for (const p of chosen) {
    for (const sub of p.subtitles ?? []) {
      if (!seenUrls.has(sub.url)) {
        seenUrls.add(sub.url);
        subtitles.push({ url: sub.url, lang: sub.lang });
      }
    }
  }

  // Merge headers from the first payload that has them
  const headers = chosen.find((p) => p.headers)?.headers ?? null;

  return { sources, subtitles, headers, provider };
}

/** Build a minimal IMediaMetadata for MappingClient (only AniList ID needed). */
function buildMinimalMeta(anilistId: number, idMal?: number | null): IMediaMetadata {
  return {
    id: `anilist:${anilistId}` as Urn,
    providerId: "anilist",
    catalogType: "anime",
    title: {},
    mappings: {
      anilist: anilistId,
      ...(idMal ? { mal: idMal } : {}),
    },
  };
}

// ── Provider strategies ────────────────────────────────────────────────────────

/**
 * Tier 1: MegaPlay — provider uses AniList ID directly, no external mapping call.
 */
async function tryMegaPlay(anilistId: number, epNumber: number): Promise<ConsumetStreamResult | null> {
  const mediaUrn = buildUrn("megaplay", String(anilistId));
  const units = await megaplay.fetchContentUnits(mediaUrn, { signal: AbortSignal.timeout(15000) });
  const unit = units.find((u) => u.number === epNumber);
  if (!unit) {
    logger.debug({ anilistId, epNumber, count: units.length }, "MegaPlay: no matching unit");
    return null;
  }
  const stream = await megaplay.resolveStream(unit.id, "sub", { signal: AbortSignal.timeout(15000) });
  if (stream.type !== "video") return null;
  return fromSdkPayloads(stream.streams, "megaplay");
}

/**
 * Tier 2 & 3: Anikoto / Gogoanime — need MappingClient to resolve AniList → provider ID.
 * Results are cached per (provider, anilistId) to avoid repeated MALSync calls.
 */
async function tryMappedProvider(
  provider: AnikotoProvider | GogoanimeProvider,
  providerId: string,
  anilistId: number,
  idMal: number | null | undefined,
  epNumber: number
): Promise<ConsumetStreamResult | null> {
  const mappingCacheKey = `sdk-mapping:${providerId}:${anilistId}`;
  let rawId = getCached<string>(mappingCacheKey);

  if (!rawId) {
    const meta = buildMinimalMeta(anilistId, idMal);
    const resolution = await mappingClient.resolveProviderMediaId(meta, provider, {
      signal: AbortSignal.timeout(12000),
    });
    if (!resolution?.rawId) {
      logger.debug({ anilistId, provider: providerId }, "MappingClient: no resolution");
      return null;
    }
    rawId = resolution.rawId;
    // Cache mapping for 6 hours
    setCached(mappingCacheKey, rawId, 21600);
  }

  const mediaUrn = buildUrn(providerId, rawId);
  const units = await provider.fetchContentUnits(mediaUrn, { signal: AbortSignal.timeout(15000) });
  const unit = units.find((u) => u.number === epNumber);
  if (!unit) {
    logger.debug({ anilistId, epNumber, providerId, rawId }, "Mapped provider: no matching unit");
    return null;
  }
  const stream = await provider.resolveStream(unit.id, "sub", { signal: AbortSignal.timeout(18000) });
  if (stream.type !== "video") return null;
  return fromSdkPayloads(stream.streams, providerId);
}

/**
 * Tier 4: Hianime via dksanime-api — search-based fallback.
 * Dynamic import so the CJS module is loaded lazily.
 */
async function tryHianime(
  animeTitleRomaji: string | null | undefined,
  epNumber: number
): Promise<ConsumetStreamResult | null> {
  if (!animeTitleRomaji) return null;

  // Dynamic import of CJS module
  const { ANIME } = await import("dksanime-api");
  const hianime = new ANIME.Hianime();

  const results = await (hianime as {
    search: (q: string) => Promise<{ results: { id: string; title: string }[] }>;
  }).search(animeTitleRomaji);

  if (!results?.results?.length) return null;
  const match = results.results[0];

  const info = await (hianime as {
    fetchAnimeInfo: (id: string) => Promise<{ episodes: { id: string; number: number }[] }>;
  }).fetchAnimeInfo(match.id);

  const ep = info?.episodes?.find((e) => e.number === epNumber) ?? info?.episodes?.[epNumber - 1];
  if (!ep) return null;

  const sources = await (hianime as {
    fetchEpisodeSources: (id: string) => Promise<{
      sources: { url: string; quality?: string; isM3U8?: boolean }[];
      subtitles?: { url: string; lang: string }[];
      headers?: Record<string, string>;
    }>;
  }).fetchEpisodeSources(ep.id);

  if (!sources?.sources?.length) return null;

  return {
    sources: sources.sources.map((s) => ({
      url: s.url,
      quality: s.quality ?? "default",
      isM3U8: s.isM3U8 ?? s.url.includes(".m3u8"),
    })),
    subtitles: (sources.subtitles ?? []).map((s) => ({ url: s.url, lang: s.lang })),
    headers: sources.headers ?? null,
    provider: "hianime",
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Resolve streaming sources.
 *
 * Strategy (chosen because MegaPlay only hosts recent episodes for long-running
 * anime like One Piece, while Anikoto has the full catalogue but needs a MALSync
 * mapping round-trip that takes ~10-40s):
 *
 *  Stage 1 — MegaPlay + Anikoto run IN PARALLEL via Promise.any.
 *            First non-null result wins; the loser is discarded.
 *            Anime detail (idMal) is pre-fetched concurrently so Anikoto's
 *            mapping step starts as soon as the detail arrives rather than
 *            waiting for MegaPlay to finish.
 *
 *  Stage 2 — Hianime (search-based, slow/unreliable) tried only if both fail.
 *
 * Returns null when all providers fail.
 */
export async function getStreamSources(
  episodeId: string,
  anilistId: number
): Promise<ConsumetStreamResult | null> {
  const epNumber = extractEpNumber(episodeId);

  // Pre-fetch idMal + title concurrently with Stage 1 providers.
  let idMal: number | null = null;
  let titleRomaji: string | null = null;
  const detailReady = (async () => {
    try {
      const detail = await getAnimeDetail(anilistId);
      idMal = (detail as Record<string, unknown> | null)?.idMal as number | null ?? null;
      titleRomaji = (detail?.title as Record<string, string> | null)?.romaji ?? null;
    } catch { /* non-fatal */ }
  })();

  /** Wraps a provider fn: swallows errors, converts null/empty → rejection (for Promise.any). */
  async function run(
    name: string,
    fn: () => Promise<ConsumetStreamResult | null>
  ): Promise<ConsumetStreamResult> {
    let result: ConsumetStreamResult | null = null;
    try {
      result = await fn();
    } catch (err) {
      logger.warn({ episodeId, anilistId, provider: name, err: String(err) }, "Provider stream failed");
    }
    if (!result || result.sources.length === 0) {
      throw new Error(`${name}: no sources`);
    }
    logger.info({ episodeId, anilistId, epNumber, provider: name }, "Stream resolved");
    return result;
  }

  // ── Stage 1: MegaPlay + Anikoto + Gogoanime in parallel ────────────────────
  // All three start simultaneously; first non-null result wins.
  const stage1 = await Promise.any([
    run("megaplay", () => tryMegaPlay(anilistId, epNumber)),
    run("anikoto", async () => {
      await detailReady; // wait for idMal before mapping (typically <1s — AniList is cached)
      return tryMappedProvider(anikoto, "anikoto", anilistId, idMal, epNumber);
    }),
    run("gogoanime", async () => {
      await detailReady;
      return tryMappedProvider(gogoanime, "gogoanime", anilistId, idMal, epNumber);
    }),
  ]).catch(() => null); // AggregateError when all fail → null

  if (stage1) return stage1;

  // ── Stage 2: Hianime (slow/unreliable, last resort) ─────────────────────────
  await detailReady;
  if (titleRomaji) {
    try {
      const result = await tryHianime(titleRomaji, epNumber);
      if (result && result.sources.length > 0) {
        logger.info({ episodeId, anilistId, epNumber, provider: "hianime" }, "Stream resolved");
        return result;
      }
    } catch (err) {
      logger.warn({ episodeId, anilistId, provider: "hianime", err: String(err) }, "Provider stream failed");
    }
  }

  logger.warn({ episodeId, anilistId, epNumber }, "All stream providers failed");
  return null;
}

/**
 * Fetch episode list — used as tertiary fallback in the episodes route.
 * Tries MegaPlay (AniList ID direct) then Anikoto via MappingClient.
 */
export async function getEpisodes(anilistId: number): Promise<ConsumetEpisode[]> {
  // Tier 1: MegaPlay
  try {
    const mediaUrn = buildUrn("megaplay", String(anilistId));
    const units = await megaplay.fetchContentUnits(mediaUrn, { signal: AbortSignal.timeout(15000) });
    if (units.length > 0) {
      logger.info({ anilistId, count: units.length, provider: "megaplay" }, "Episodes via MegaPlay");
      // Normalize IDs to `megaplay-{anilistId}-{epNumber}` so extractEpisodeNumber
      // in the stream route always extracts the correct number (provider-native IDs
      // may not end in a parseable number pattern).
      return units.map((u) => ({
        id: `megaplay-${anilistId}-${u.number}`,
        number: u.number,
        title: u.title ?? null,
        image: null,
        airDate: null,
        description: null,
      }));
    }
  } catch (err) {
    logger.warn({ anilistId, err: String(err), provider: "megaplay" }, "MegaPlay episode fetch failed");
  }

  // Tier 2: Anikoto via MappingClient
  try {
    const meta = buildMinimalMeta(anilistId);
    const resolution = await mappingClient.resolveProviderMediaId(meta, anikoto, {
      signal: AbortSignal.timeout(12000),
    });
    if (resolution?.rawId) {
      const mediaUrn = buildUrn("anikoto", resolution.rawId);
      const units = await anikoto.fetchContentUnits(mediaUrn, { signal: AbortSignal.timeout(15000) });
      if (units.length > 0) {
        logger.info({ anilistId, count: units.length, provider: "anikoto" }, "Episodes via Anikoto");
        // Same normalization — always `anikoto-{anilistId}-{epNumber}`
        return units.map((u) => ({
          id: `anikoto-${anilistId}-${u.number}`,
          number: u.number,
          title: u.title ?? null,
          image: null,
          airDate: null,
          description: null,
        }));
      }
    }
  } catch (err) {
    logger.warn({ anilistId, err: String(err), provider: "anikoto" }, "Anikoto episode fetch failed");
  }

  return [];
}

logger.info("Streaming client initialised (anime-sdk + dksanime-api)");
