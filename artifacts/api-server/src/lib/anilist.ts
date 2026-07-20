import axios from "axios";
import { logger } from "./logger";

const ANILIST_URL = "https://graphql.anilist.co";

const ANIME_FIELDS = `
  id
  title { romaji english native }
  coverImage { extraLarge large }
  bannerImage
  genres
  averageScore
  episodes
  status
  season
  seasonYear
  format
  studios(isMain: true) { nodes { name } }
`;

const ANIME_DETAIL_FIELDS = `
  id
  idMal
  title { romaji english native }
  coverImage { extraLarge large }
  bannerImage
  genres
  averageScore
  episodes
  status
  season
  seasonYear
  format
  studios(isMain: true) { nodes { name } }
  description(asHtml: false)
  duration
  startDate { year month day }
  endDate { year month day }
  popularity
  favourites
  countryOfOrigin
  trailer { id site }
  tags { name }
  streamingEpisodes { title thumbnail url site }
  relations {
    edges {
      relationType
      node {
        id
        title { romaji english native }
        coverImage { extraLarge large }
        format
      }
    }
  }
  characters(sort: ROLE, perPage: 12) {
    edges {
      role
      node {
        id
        name { full }
        image { large }
      }
    }
  }
`;

async function query<T>(gql: string, variables: Record<string, unknown> = {}): Promise<T> {
  const response = await axios.post<{ data: T; errors?: { message: string }[] }>(
    ANILIST_URL,
    { query: gql, variables },
    {
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      timeout: 10000,
    }
  );

  if (response.data.errors?.length) {
    const msg = response.data.errors.map((e) => e.message).join(", ");
    throw new Error(`AniList error: ${msg}`);
  }

  return response.data.data;
}

function mapAnimeItem(media: Record<string, unknown>) {
  const m = media as Record<string, unknown>;
  const coverImage = m.coverImage as Record<string, string> | null;
  const title = m.title as Record<string, string | null>;
  const studios = m.studios as { nodes: { name: string }[] } | null;

  return {
    id: m.id as number,
    title: {
      romaji: title?.romaji ?? null,
      english: title?.english ?? null,
      native: title?.native ?? null,
    },
    coverImage: coverImage?.extraLarge ?? coverImage?.large ?? null,
    bannerImage: (m.bannerImage as string | null) ?? null,
    genres: (m.genres as string[]) ?? [],
    averageScore: (m.averageScore as number | null) ?? null,
    episodes: (m.episodes as number | null) ?? null,
    status: (m.status as string | null) ?? null,
    season: (m.season as string | null) ?? null,
    seasonYear: (m.seasonYear as number | null) ?? null,
    format: (m.format as string | null) ?? null,
    studios: studios?.nodes?.map((n) => n.name) ?? [],
  };
}

function mapPageInfo(pageInfo: Record<string, unknown>) {
  return {
    total: (pageInfo.total as number) ?? 0,
    currentPage: (pageInfo.currentPage as number) ?? 1,
    lastPage: (pageInfo.lastPage as number) ?? 1,
    hasNextPage: (pageInfo.hasNextPage as boolean) ?? false,
    perPage: (pageInfo.perPage as number) ?? 20,
  };
}

export async function getTrendingAnime(page: number, perPage: number) {
  const gql = `
    query ($page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        pageInfo { total currentPage lastPage hasNextPage perPage }
        media(sort: TRENDING_DESC, type: ANIME, isAdult: false) { ${ANIME_FIELDS} }
      }
    }
  `;
  const data = await query<{ Page: Record<string, unknown> }>(gql, { page, perPage });
  const page_ = data.Page;
  return {
    data: ((page_.media as unknown[]) ?? []).map((m) => mapAnimeItem(m as Record<string, unknown>)),
    pageInfo: mapPageInfo(page_.pageInfo as Record<string, unknown>),
  };
}

export async function getSeasonalAnime(page: number, perPage: number) {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  const seasons = ["WINTER", "SPRING", "SUMMER", "FALL"];
  const season = seasons[Math.floor(month / 3)];

  const gql = `
    query ($page: Int, $perPage: Int, $season: MediaSeason, $year: Int) {
      Page(page: $page, perPage: $perPage) {
        pageInfo { total currentPage lastPage hasNextPage perPage }
        media(sort: POPULARITY_DESC, type: ANIME, season: $season, seasonYear: $year, isAdult: false) { ${ANIME_FIELDS} }
      }
    }
  `;
  const data = await query<{ Page: Record<string, unknown> }>(gql, { page, perPage, season, year });
  const page_ = data.Page;
  return {
    data: ((page_.media as unknown[]) ?? []).map((m) => mapAnimeItem(m as Record<string, unknown>)),
    pageInfo: mapPageInfo(page_.pageInfo as Record<string, unknown>),
  };
}

export async function getPopularAnime(page: number, perPage: number) {
  const gql = `
    query ($page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        pageInfo { total currentPage lastPage hasNextPage perPage }
        media(sort: POPULARITY_DESC, type: ANIME, isAdult: false) { ${ANIME_FIELDS} }
      }
    }
  `;
  const data = await query<{ Page: Record<string, unknown> }>(gql, { page, perPage });
  const page_ = data.Page;
  return {
    data: ((page_.media as unknown[]) ?? []).map((m) => mapAnimeItem(m as Record<string, unknown>)),
    pageInfo: mapPageInfo(page_.pageInfo as Record<string, unknown>),
  };
}

export async function searchAnime(q: string, page: number, perPage: number) {
  const gql = `
    query ($search: String, $page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        pageInfo { total currentPage lastPage hasNextPage perPage }
        media(search: $search, type: ANIME, isAdult: false, sort: SEARCH_MATCH) { ${ANIME_FIELDS} }
      }
    }
  `;
  const data = await query<{ Page: Record<string, unknown> }>(gql, { search: q, page, perPage });
  const page_ = data.Page;
  return {
    data: ((page_.media as unknown[]) ?? []).map((m) => mapAnimeItem(m as Record<string, unknown>)),
    pageInfo: mapPageInfo(page_.pageInfo as Record<string, unknown>),
  };
}

export async function getAnimeDetail(id: number) {
  const gql = `
    query ($id: Int) {
      Media(id: $id, type: ANIME) { ${ANIME_DETAIL_FIELDS} }
    }
  `;
  const data = await query<{ Media: Record<string, unknown> | null }>(gql, { id });
  if (!data.Media) return null;

  const m = data.Media;
  const base = mapAnimeItem(m);
  const startDate = m.startDate as Record<string, number | null> | null;
  const endDate = m.endDate as Record<string, number | null> | null;
  const trailer = m.trailer as Record<string, string> | null;
  const tags = m.tags as { name: string }[] | null;
  const relations = m.relations as { edges: { relationType: string; node: Record<string, unknown> }[] } | null;
  const characters = m.characters as { edges: { role: string; node: Record<string, unknown> }[] } | null;

  const formatDate = (d: Record<string, number | null> | null): string | null => {
    if (!d || !d.year) return null;
    return `${d.year}-${String(d.month ?? 1).padStart(2, "0")}-${String(d.day ?? 1).padStart(2, "0")}`;
  };

  const trailerUrl = trailer
    ? trailer.site === "youtube"
      ? `https://youtube.com/watch?v=${trailer.id}`
      : null
    : null;

  const streamingEpisodesRaw = m.streamingEpisodes as
    | { title: string | null; thumbnail: string | null; url: string | null; site: string | null }[]
    | null;

  return {
    ...base,
    idMal: (m.idMal as number | null) ?? null,
    description: ((m.description as string | null) ?? null),
    duration: (m.duration as number | null) ?? null,
    startDate: formatDate(startDate),
    endDate: formatDate(endDate),
    popularity: (m.popularity as number | null) ?? null,
    favourites: (m.favourites as number | null) ?? null,
    countryOfOrigin: (m.countryOfOrigin as string | null) ?? null,
    trailer: trailerUrl,
    tags: tags?.map((t) => t.name) ?? [],
    streamingEpisodes: (streamingEpisodesRaw ?? []).map((se) => ({
      title: se.title ?? null,
      thumbnail: se.thumbnail ?? null,
      url: se.url ?? null,
      site: se.site ?? null,
    })),
    relations: (relations?.edges ?? []).map((e) => {
      const n = e.node;
      const ni = mapAnimeItem(n);
      return {
        id: ni.id,
        title: ni.title,
        coverImage: ni.coverImage,
        relationType: e.relationType,
        format: ni.format,
      };
    }),
    characters: (characters?.edges ?? []).map((e) => {
      const n = e.node as Record<string, unknown>;
      const name = n.name as Record<string, string> | null;
      const image = n.image as Record<string, string> | null;
      return {
        id: n.id as number,
        name: name?.full ?? "Unknown",
        image: image?.large ?? null,
        role: e.role,
      };
    }),
  };
}

logger.info("AniList client initialized");
