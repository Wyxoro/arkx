import { Router, type IRouter } from "express";
import {
  GetTrendingAnimeQueryParams,
  GetSeasonalAnimeQueryParams,
  GetPopularAnimeQueryParams,
  SearchAnimeQueryParams,
  GetAnimeByIdParams,
  GetAnimeEpisodesParams,
} from "@workspace/api-zod";
import { getCached, setCached } from "../lib/cache";
import { logger } from "../lib/logger";
import {
  getTrendingAnime,
  getSeasonalAnime,
  getPopularAnime,
  searchAnime,
  getAnimeDetail,
} from "../lib/anilist";
import { getEpisodesByMalId } from "../lib/jikan";
import { getEpisodes as getProviderEpisodes } from "../lib/consumet";

const router: IRouter = Router();

// ── Listing routes ────────────────────────────────────────────────────────────

router.get("/anime/trending", async (req, res): Promise<void> => {
  const parsed = GetTrendingAnimeQueryParams.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: "Bad request", message: parsed.error.message }); return; }
  const { page = 1, perPage = 20 } = parsed.data;
  const cacheKey = `trending:${page}:${perPage}`;
  const cached = getCached(cacheKey);
  if (cached) { res.json(cached); return; }
  const result = await getTrendingAnime(page, perPage);
  setCached(cacheKey, result, 900); // 15 min — trending changes frequently
  res.json(result);
});

router.get("/anime/seasonal", async (req, res): Promise<void> => {
  const parsed = GetSeasonalAnimeQueryParams.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: "Bad request", message: parsed.error.message }); return; }
  const { page = 1, perPage = 20 } = parsed.data;
  const cacheKey = `seasonal:${page}:${perPage}`;
  const cached = getCached(cacheKey);
  if (cached) { res.json(cached); return; }
  const result = await getSeasonalAnime(page, perPage);
  setCached(cacheKey, result, 900); // 15 min — seasonal updates as new eps air
  res.json(result);
});

router.get("/anime/popular", async (req, res): Promise<void> => {
  const parsed = GetPopularAnimeQueryParams.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: "Bad request", message: parsed.error.message }); return; }
  const { page = 1, perPage = 20 } = parsed.data;
  const cacheKey = `popular:${page}:${perPage}`;
  const cached = getCached(cacheKey);
  if (cached) { res.json(cached); return; }
  const result = await getPopularAnime(page, perPage);
  setCached(cacheKey, result, 1800); // 30 min — popular list changes slower
  res.json(result);
});

router.get("/anime/search", async (req, res): Promise<void> => {
  const parsed = SearchAnimeQueryParams.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: "Bad request", message: parsed.error.message }); return; }
  const { q, page = 1, perPage = 20 } = parsed.data;
  const cacheKey = `search:${q}:${page}:${perPage}`;
  const cached = getCached(cacheKey);
  if (cached) { res.json(cached); return; }
  const result = await searchAnime(q, page, perPage);
  setCached(cacheKey, result, 600);
  res.json(result);
});

router.get("/anime/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const parsed = GetAnimeByIdParams.safeParse({ id: rawId });
  if (!parsed.success) { res.status(400).json({ error: "Bad request", message: parsed.error.message }); return; }
  const { id } = parsed.data;
  const cacheKey = `anime:${id}`;
  const cached = getCached(cacheKey);
  if (cached) { res.json(cached); return; }
  const result = await getAnimeDetail(id);
  if (!result) { res.status(404).json({ error: "Not found", message: `Anime ${id} not found` }); return; }
  setCached(cacheKey, result);
  res.json(result);
});

// ── Episodes route ────────────────────────────────────────────────────────────
router.get("/anime/:id/episodes", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const parsed = GetAnimeEpisodesParams.safeParse({ id: rawId });
  if (!parsed.success) { res.status(400).json({ error: "Bad request", message: parsed.error.message }); return; }
  const { id } = parsed.data;

  // v2 — bumped to invalidate pre-normalization episode IDs (old MegaPlay native IDs
  // couldn't be parsed by extractEpisodeNumber, causing all episodes to stream as ep 1)
  const cacheKey = `episodes:v2:${id}`;
  const cached = getCached(cacheKey);
  if (cached) { res.json(cached); return; }

  const animeDetail = await getAnimeDetail(id).catch(() => null);
  const idMal = (animeDetail as Record<string, unknown> | null)?.idMal as number | null | undefined;
  const totalEpisodeCount = animeDetail?.episodes ?? null;
  const streamingEps = ((animeDetail as Record<string, unknown> | null)
    ?.streamingEpisodes as { title: string | null; thumbnail: string | null }[] | undefined) ?? [];

  const thumbnailByEpNumber = new Map<number, string>();
  for (const se of streamingEps) {
    if (!se.thumbnail || !se.title) continue;
    const match = se.title.match(/Episode\s+(\d+)/i);
    if (match) thumbnailByEpNumber.set(Number(match[1]), se.thumbnail);
  }

  const titleByEpNumber = new Map<number, string>();
  for (const se of streamingEps) {
    if (!se.title) continue;
    const match = se.title.match(/Episode\s+(\d+)\s*[-–]\s*(.+)/i);
    if (match) titleByEpNumber.set(Number(match[1]), match[2].trim());
  }

  interface NormalisedEpisode {
    id: string;
    number: number;
    title: string | null;
    image: string | null;
    airDate: string | null;
    description: string | null;
  }

  let episodes: NormalisedEpisode[] = [];

  // ── 1. Jikan (primary) ──────────────────────────────────────────────────────
  if (idMal) {
    try {
      const jikanEps = await getEpisodesByMalId(idMal);
      if (jikanEps.length > 0) {
        episodes = jikanEps.map((ep) => ({
          id: `jikan-${id}-${ep.number}`,
          number: ep.number,
          title: ep.title || titleByEpNumber.get(ep.number) || null,
          image: thumbnailByEpNumber.get(ep.number) ?? null,
          airDate: ep.aired ?? null,
          description: ep.synopsis ?? null,
        }));
      }
    } catch (err) {
      logger.warn({ malId: idMal, err: String(err) }, 'Jikan fetch failed');
    }
  }

  // ── 2. AniList streamingEpisodes as standalone fallback ────────────────────
  if (episodes.length === 0 && streamingEps.length > 0) {
    const ascending = [...streamingEps].reverse();
    episodes = ascending
      .map((se, idx) => {
        const numMatch = se.title?.match(/Episode\s+(\d+)/i);
        const epNum = numMatch ? Number(numMatch[1]) : idx + 1;
        const titleMatch = se.title?.match(/Episode\s+\d+\s*[-–]\s*(.+)/i);
        return {
          id: `se-${id}-${epNum}`,
          number: epNum,
          title: titleMatch ? titleMatch[1].trim() : null,
          image: se.thumbnail ?? null,
          airDate: null,
          description: null,
        };
      })
      .sort((a, b) => a.number - b.number);
  }

  // ── 3. Consumet streaming providers ────────────────────────────────────────
  if (episodes.length === 0) {
    try {
      const providerEps = await getProviderEpisodes(id);
      if (providerEps.length > 0) {
        episodes = providerEps.map((ep) => ({
          id: ep.id,
          number: ep.number,
          title: ep.title || titleByEpNumber.get(ep.number) || null,
          image: ep.image || thumbnailByEpNumber.get(ep.number) || null,
          airDate: ep.airDate ?? null,
          description: ep.description ?? null,
        }));
      }
    } catch { /* silent — move to synthetic */ }
  }

  // ── 4. Synthetic fallback ──────────────────────────────────────────────────
  if (episodes.length === 0 && totalEpisodeCount && totalEpisodeCount > 0) {
    episodes = Array.from({ length: totalEpisodeCount }, (_, i) => ({
      id: `synthetic-${id}-${i + 1}`,
      number: i + 1,
      title: titleByEpNumber.get(i + 1) ?? null,
      image: thumbnailByEpNumber.get(i + 1) ?? null,
      airDate: null,
      description: null,
    }));
  }

  const result = {
    data: episodes,
    pageInfo: {
      total: episodes.length,
      currentPage: 1,
      lastPage: 1,
      hasNextPage: false,
      perPage: episodes.length,
    },
    animeId: id,
    totalEpisodes: episodes.length || totalEpisodeCount || null,
  };

  // 1 hour for found episodes (new eps air weekly; clients also refetch every hour)
  // 5 min retry when empty so a transient Jikan failure doesn't lock out the user
  setCached(cacheKey, result, episodes.length > 0 ? 3600 : 300);
  res.json(result);
});

export default router;
