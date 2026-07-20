/**
 * Jikan v4 — unofficial MyAnimeList REST API
 * https://docs.api.jikan.moe/
 *
 * Used as the primary episode source because:
 *  - Works from ArkStream's server infrastructure (not geo-blocked)
 *  - Returns structured per-episode data (number, title, air date, filler flag)
 *  - 100 episodes per page, handles pagination automatically
 */

import axios from "axios";
import { logger } from "./logger";

const JIKAN_BASE = "https://api.jikan.moe/v4";

const client = axios.create({
  baseURL: JIKAN_BASE,
  timeout: 12000,
  headers: { Accept: "application/json" },
});

export interface JikanEpisode {
  /** 1-based episode number (same as mal_id on episode list endpoint) */
  number: number;
  title: string | null;
  titleJapanese: string | null;
  aired: string | null;
  filler: boolean;
  recap: boolean;
  /** Only present when fetching individual episode details */
  synopsis: string | null;
}

interface JikanEpisodePage {
  data: JikanEpisode[];
  hasNextPage: boolean;
  lastPage: number;
}

function mapEpisode(raw: Record<string, unknown>): JikanEpisode {
  return {
    number: Number(raw.mal_id ?? 0),
    title: (raw.title as string | null) || null,
    titleJapanese: (raw.title_japanese as string | null) || null,
    aired: (raw.aired as string | null) || null,
    filler: Boolean(raw.filler),
    recap: Boolean(raw.recap),
    synopsis: (raw.synopsis as string | null) || null,
  };
}

async function fetchPage(malId: number, page: number, retries = 2): Promise<JikanEpisodePage> {
  let lastError: unknown;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const { data } = await client.get<{
        data: Record<string, unknown>[];
        pagination: { has_next_page: boolean; last_visible_page: number };
      }>(`/anime/${malId}/episodes`, { params: { page } });

      return {
        data: (data.data ?? []).map(mapEpisode),
        hasNextPage: data.pagination?.has_next_page ?? false,
        lastPage: data.pagination?.last_visible_page ?? page,
      };
    } catch (err) {
      lastError = err;
      if (attempt < retries - 1) {
        // Jikan rate-limits at ~3 req/sec — back off gently
        await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
      }
    }
  }
  throw lastError;
}

/**
 * Fetch all episodes for an anime by its MAL ID.
 * Handles multi-page responses automatically (up to 5 pages = 500 episodes).
 */
export async function getEpisodesByMalId(malId: number): Promise<JikanEpisode[]> {
  const allEpisodes: JikanEpisode[] = [];
  let page = 1;
  const MAX_PAGES = 5;

  while (page <= MAX_PAGES) {
    const result = await fetchPage(malId, page);
    allEpisodes.push(...result.data);

    if (!result.hasNextPage || page >= result.lastPage) break;
    page++;

    // Respect Jikan's 3 req/sec rate limit between page fetches
    if (page <= MAX_PAGES) await new Promise((r) => setTimeout(r, 400));
  }

  logger.info({ malId, totalFetched: allEpisodes.length }, "Jikan episodes fetched");
  return allEpisodes;
}

logger.info("Jikan client initialized");
