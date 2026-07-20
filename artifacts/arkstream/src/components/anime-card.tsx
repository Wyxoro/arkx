import { useState } from 'react';
import { Link } from 'wouter';
import type { AnimeItem } from '@workspace/api-client-react';

interface AnimeCardProps {
  anime: AnimeItem;
}

function StarIcon() {
  return (
    <svg width="7" height="7" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7z"/>
    </svg>
  );
}

/**
 * Compact responsive anime card.
 * On hover: lifts slightly and pulls down to reveal the full anime title.
 */
export function AnimeCard({ anime }: AnimeCardProps) {
  const title = anime.title.english ?? anime.title.romaji ?? anime.title.native ?? 'Unknown';
  const score = anime.averageScore != null ? (anime.averageScore / 10).toFixed(1) : null;
  const [hovered, setHovered] = useState(false);

  return (
    <Link href={`/anime/${anime.id}`}>
      <div
        style={{
          width: '100%',
          borderRadius: 7,
          background: 'rgba(255,255,255,0.025)',
          border: `1px solid ${hovered ? 'rgba(229,41,42,0.4)' : 'rgba(255,255,255,0.07)'}`,
          cursor: 'pointer',
          transform: hovered ? 'translateY(-3px) scale(1.01)' : 'none',
          boxShadow: hovered ? '0 12px 32px rgba(0,0,0,0.55)' : 'none',
          transition: 'transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease',
          position: 'relative',
          zIndex: hovered ? 10 : 1,
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Cover — 2:3 aspect ratio */}
        <div style={{ position: 'relative', paddingBottom: '150%', background: 'rgba(255,255,255,0.04)', borderRadius: '7px 7px 0 0', overflow: 'hidden' }}>
          {anime.coverImage ? (
            <img
              src={anime.coverImage}
              alt={title}
              style={{
                position: 'absolute', inset: 0,
                width: '100%', height: '100%',
                objectFit: 'cover', display: 'block',
              }}
              loading="lazy"
            />
          ) : (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" style={{ opacity: 0.07, color: '#fff' }}>
                <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
              </svg>
            </div>
          )}

          {/* Score */}
          {score && (
            <div style={{
              position: 'absolute', top: 6, right: 6,
              background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(8px)',
              borderRadius: 4, padding: '2px 5px',
              display: 'flex', alignItems: 'center', gap: 3,
              fontSize: 9, fontWeight: 700, color: '#FDE68A',
            }}>
              <StarIcon /> {score}
            </div>
          )}

          {/* Format badge */}
          {anime.format && (
            <div style={{
              position: 'absolute', top: 6, left: 6,
              background: 'rgba(229,41,42,0.85)', backdropFilter: 'blur(4px)',
              borderRadius: 3, padding: '2px 5px',
              fontSize: 8, fontWeight: 700, color: '#fff',
              textTransform: 'uppercase', letterSpacing: '0.05em',
            }}>
              {anime.format.replace(/_/g, ' ')}
            </div>
          )}

          {/* Airing indicator */}
          {anime.status === 'RELEASING' && (
            <div style={{
              position: 'absolute', bottom: 6, left: 6,
              display: 'flex', alignItems: 'center', gap: 3,
              background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
              borderRadius: 4, padding: '2px 6px',
              fontSize: 8, fontWeight: 700, color: '#4ADE80',
            }}>
              <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#4ADE80', flexShrink: 0 }} />
              AIRING
            </div>
          )}

          {/* Hover play overlay */}
          <div
            style={{
              position: 'absolute', inset: 0,
              opacity: hovered ? 1 : 0,
              background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.25) 50%, transparent 100%)',
              display: 'flex', alignItems: 'flex-end', padding: '8px',
              transition: 'opacity 0.2s ease',
            }}
          >
            <span style={{
              display: 'flex', alignItems: 'center', gap: 4,
              background: '#E5292A', color: '#fff',
              fontSize: 8, fontWeight: 700,
              padding: '4px 8px', borderRadius: 4,
              letterSpacing: '0.06em',
            }}>
              <PlayIcon /> WATCH
            </span>
          </div>
        </div>

        {/* Info — strict fixed height so all cards bottom-align identically */}
        <div style={{
          padding: '7px 8px 8px',
          borderRadius: '0 0 7px 7px',
          height: 64,
          overflow: 'hidden',
          boxSizing: 'border-box',
        }}>
          <p style={{
            fontSize: 10, fontWeight: 600, color: '#E2E2E2',
            lineHeight: 1.45, margin: 0,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical' as const,
            overflow: 'hidden',
          }}>
            {title}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 5 }}>
            {anime.seasonYear && (
              <span style={{ fontSize: 9, color: '#555', fontWeight: 500 }}>{anime.seasonYear}</span>
            )}
            {anime.episodes != null && (
              <span style={{ fontSize: 9, color: '#494949' }}>{anime.episodes} ep</span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
