import { useEffect } from 'react';
import { Link } from 'wouter';
import {
  useGetTrendingAnime,
  useGetSeasonalAnime,
  useGetPopularAnime,
} from '@workspace/api-client-react';
import { AnimeCard } from '@/components/anime-card';
import { Footer } from '@/components/footer';
import { ArkLogo } from '@/components/ark-logo';
import type { AnimeItem } from '@workspace/api-client-react';
import { markAppReady } from '@/lib/preload-state';
import { NoticesBell } from '@/components/notices-bell';

// ── Design tokens ──────────────────────────────────────────────────────────────
const BG           = '#111111';
const RED          = '#E5292A';
const RED_DIM      = 'rgba(229,41,42,0.10)';
const BORDER       = 'rgba(255,255,255,0.07)';
const SURFACE      = 'rgba(255,255,255,0.03)';
const TEXT_PRIMARY = '#F0F0F0';
const TEXT_SEC     = '#888';

// ── Icons ──────────────────────────────────────────────────────────────────────

function SearchIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
    </svg>
  );
}

function PlayIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7z"/>
    </svg>
  );
}

function InfoIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="8" x2="12" y2="8"/>
      <line x1="12" y1="12" x2="12" y2="16"/>
    </svg>
  );
}

function StarIcon({ size = 11 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" style={{ color: '#FDE68A' }}>
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
    </svg>
  );
}

function TrendingIcon() {
  return (
    <div style={{
      width: 24, height: 24, borderRadius: 6,
      background: RED_DIM, border: '1px solid rgba(229,41,42,0.18)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={RED} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
        <polyline points="17 6 23 6 23 12"/>
      </svg>
    </div>
  );
}

function SeasonIcon() {
  return (
    <div style={{
      width: 24, height: 24, borderRadius: 6,
      background: RED_DIM, border: '1px solid rgba(229,41,42,0.18)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={RED} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
      </svg>
    </div>
  );
}

function PopularIcon() {
  return (
    <div style={{
      width: 24, height: 24, borderRadius: 6,
      background: RED_DIM, border: '1px solid rgba(229,41,42,0.18)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={RED} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
    </div>
  );
}

// ── Navbar ─────────────────────────────────────────────────────────────────────

function NavBar() {
  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 32px', height: 60,
      background: 'rgba(17,17,17,0.93)',
      backdropFilter: 'blur(28px)',
      WebkitBackdropFilter: 'blur(28px)',
      borderBottom: `1px solid ${BORDER}`,
    }}>
      <ArkLogo />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <NoticesBell />
        <Link href="/search">
        <button
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 12, fontWeight: 500, color: TEXT_SEC, cursor: 'pointer',
            padding: '7px 14px', borderRadius: 7,
            background: SURFACE, border: `1px solid ${BORDER}`,
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={e => {
            const el = e.currentTarget as HTMLElement;
            el.style.color = TEXT_PRIMARY;
            el.style.borderColor = 'rgba(229,41,42,0.28)';
          }}
          onMouseLeave={e => {
            const el = e.currentTarget as HTMLElement;
            el.style.color = TEXT_SEC;
            el.style.borderColor = BORDER;
          }}
        >
          <SearchIcon /> Search Anime
        </button>
        </Link>
      </div>
    </nav>
  );
}

// ── Hero ───────────────────────────────────────────────────────────────────────

function HeroSection({ anime }: { anime: AnimeItem | undefined }) {
  if (!anime) return <div style={{ height: 500, background: BG }} />;
  const title = anime.title.english ?? anime.title.romaji ?? '';

  return (
    <div style={{ position: 'relative', height: 500, minHeight: 380, overflow: 'hidden' }}>
      {anime.bannerImage ? (
        <img src={anime.bannerImage} alt={title} style={{
          position: 'absolute', inset: 0, width: '100%', height: '100%',
          objectFit: 'cover', filter: 'brightness(0.4) saturate(0.8)',
        }} />
      ) : anime.coverImage ? (
        <img src={anime.coverImage} alt={title} style={{
          position: 'absolute', inset: 0, width: '100%', height: '100%',
          objectFit: 'cover', transform: 'scale(1.1)',
          filter: 'brightness(0.28) blur(14px) saturate(0.6)',
        }} />
      ) : (
        <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(135deg, rgba(229,41,42,0.08), ${BG})` }} />
      )}

      {/* Gradients */}
      <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(to top, ${BG} 0%, rgba(17,17,17,0.45) 50%, transparent 100%)` }} />
      <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(to right, rgba(17,17,17,0.85) 0%, rgba(17,17,17,0.15) 55%, transparent 100%)` }} />

      {/* Content */}
      <div style={{
        position: 'absolute', bottom: 48, left: 0, right: 0,
        padding: '0 36px',
        maxWidth: 600, display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        {anime.genres.length > 0 && (
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {anime.genres.slice(0, 3).map(g => (
              <span key={g} style={{
                fontSize: 9, fontWeight: 600, padding: '3px 8px', borderRadius: 3,
                background: RED_DIM, border: '1px solid rgba(229,41,42,0.2)',
                color: '#FF7878', letterSpacing: '0.05em', textTransform: 'uppercase',
              }}>{g}</span>
            ))}
          </div>
        )}

        <h1 style={{
          fontSize: 'clamp(20px,3.2vw,42px)', fontWeight: 800,
          lineHeight: 1.08, color: '#fff', margin: 0, letterSpacing: '-0.02em',
        }}>
          {title}
        </h1>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {anime.averageScore && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: '#FDE68A' }}>
              <StarIcon /> {(anime.averageScore / 10).toFixed(1)}
            </span>
          )}
          {anime.seasonYear && <span style={{ fontSize: 12, color: TEXT_SEC }}>{anime.seasonYear}</span>}
          {anime.episodes && <span style={{ fontSize: 12, color: TEXT_SEC }}>{anime.episodes} eps</span>}
          {anime.status && (
            <span style={{
              fontSize: 10, padding: '2px 7px', borderRadius: 4, fontWeight: 600,
              background: anime.status === 'RELEASING' ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.05)',
              color: anime.status === 'RELEASING' ? '#4ADE80' : TEXT_SEC,
              border: `1px solid ${anime.status === 'RELEASING' ? 'rgba(34,197,94,0.2)' : BORDER}`,
              textTransform: 'capitalize',
            }}>
              {anime.status.toLowerCase().replace(/_/g, ' ')}
            </span>
          )}
        </div>

        {anime.description && (
          <p style={{
            fontSize: 12, color: 'rgba(200,200,200,0.6)', lineHeight: 1.65,
            margin: 0, maxWidth: 400,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {anime.description.replace(/<[^>]+>/g, '')}
          </p>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
          <Link href={`/anime/${anime.id}`}>
            <button
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                fontSize: 13, fontWeight: 700, padding: '10px 22px', borderRadius: 7,
                background: RED, color: '#fff', border: 'none', cursor: 'pointer',
                boxShadow: '0 4px 20px rgba(229,41,42,0.35)',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 28px rgba(229,41,42,0.5)';
                (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 20px rgba(229,41,42,0.35)';
                (e.currentTarget as HTMLElement).style.transform = '';
              }}
            >
              <PlayIcon /> Watch Now
            </button>
          </Link>
          <Link href={`/anime/${anime.id}`}>
            <button
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                fontSize: 13, fontWeight: 500, padding: '10px 18px', borderRadius: 7,
                background: 'rgba(255,255,255,0.07)', color: TEXT_PRIMARY,
                border: `1px solid rgba(255,255,255,0.1)`, cursor: 'pointer',
                backdropFilter: 'blur(12px)', transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.12)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)';
              }}
            >
              <InfoIcon /> Details
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── Section heading ────────────────────────────────────────────────────────────

function SectionTitle({ icon, label, count }: { icon: React.ReactNode; label: string; count?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
      {icon}
      <h2 style={{
        fontSize: 13, fontWeight: 700, letterSpacing: '0.07em',
        textTransform: 'uppercase', color: TEXT_PRIMARY, margin: 0,
        whiteSpace: 'nowrap',
      }}>
        {label}
      </h2>
      {count !== undefined && (
        <span style={{
          fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 3,
          background: RED_DIM, color: 'rgba(229,110,110,0.9)',
          border: '1px solid rgba(229,41,42,0.18)',
        }}>
          {count}
        </span>
      )}
      <div style={{
        flex: 1, height: 1,
        background: 'linear-gradient(to right, rgba(229,41,42,0.18), transparent)',
        marginLeft: 4,
      }} />
    </div>
  );
}

// ── Skeleton card ──────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div style={{
      width: '100%', borderRadius: 7,
      background: 'rgba(255,255,255,0.025)',
      border: '1px solid rgba(255,255,255,0.05)',
      overflow: 'hidden',
      animation: 'ark-skeleton 1.6s ease-in-out infinite',
    }}>
      <div style={{ paddingBottom: '138%', background: 'rgba(255,255,255,0.04)' }} />
      <div style={{ padding: '7px 8px 8px', display: 'flex', flexDirection: 'column', gap: 5 }}>
        <div style={{ height: 8, width: '78%', borderRadius: 3, background: 'rgba(255,255,255,0.05)' }} />
        <div style={{ height: 7, width: '48%', borderRadius: 3, background: 'rgba(255,255,255,0.035)' }} />
      </div>
    </div>
  );
}

// ── Anime section ──────────────────────────────────────────────────────────────

interface AnimeSectionProps {
  icon: React.ReactNode;
  title: string;
  animes: AnimeItem[];
  loading: boolean;
}

function AnimeSection({ icon, title, animes, loading }: AnimeSectionProps) {
  const items = animes.slice(0, 8);

  return (
    <section style={{ padding: '0 32px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SectionTitle icon={icon} label={title} />
      <div className="ark-section-grid">
        {loading
          ? Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
          : items.map(anime => <AnimeCard key={anime.id} anime={anime} />)
        }
      </div>
    </section>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function Home() {
  const { data: trending, isLoading: tLoading } = useGetTrendingAnime({ perPage: 8 });
  const { data: seasonal, isLoading: sLoading } = useGetSeasonalAnime({ perPage: 8 });
  const { data: popular,  isLoading: pLoading } = useGetPopularAnime({ perPage: 8 });

  // Signal preloader to dismiss once all three sections have resolved
  useEffect(() => {
    if (!tLoading && !sLoading && !pLoading) {
      markAppReady();
    }
  }, [tLoading, sLoading, pLoading]);

  const hero = trending?.data?.[0];

  return (
    <div style={{ minHeight: '100vh', background: BG, color: TEXT_PRIMARY }}>
      <NavBar />

      <div style={{ paddingTop: 60 }}>
        <HeroSection anime={hero} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 48, paddingTop: 48, paddingBottom: 16 }}>
          <AnimeSection icon={<TrendingIcon />} title="Trending Now"     animes={trending?.data ?? []} loading={tLoading} />
          <AnimeSection icon={<SeasonIcon />}   title="This Season"      animes={seasonal?.data ?? []} loading={sLoading} />
          <AnimeSection icon={<PopularIcon />}  title="All-Time Popular" animes={popular?.data ?? []}  loading={pLoading} />
        </div>
      </div>

      <Footer />
    </div>
  );
}
