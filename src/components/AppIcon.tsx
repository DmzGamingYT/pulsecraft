import { useId } from 'react';

/**
 * Icône de l'application, en verre liquide.
 *
 * Le rendu est un SVG autonome : dégradés, réfraction, reflet spéculaire et
 * ombre douce, sans image ni police. L'animation est purement CSS (flottement,
 * balayage de lumière, anneau qui tourne) et se coupe avec
 * `prefers-reduced-motion`.
 *
 * Les identifiants de dégradés sont préfixés par `useId()` : plusieurs icônes
 * peuvent cohabiter sur la même page sans se voler leurs couleurs.
 */
export function AppIcon({
  size = 96,
  animated = true,
  className = '',
}: {
  size?: number;
  animated?: boolean;
  className?: string;
}) {
  const raw = useId();
  const id = `pc${raw.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const gradient = `${id}-grad`;
  const glass = `${id}-glass`;
  const sheen = `${id}-sheen`;
  const clip = `${id}-clip`;
  const glow = `${id}-glow`;
  const rim = `${id}-rim`;
  const coral = `${id}-coral`;
  const blur = `${id}-blur`;

  return (
    <svg
      className={`appicon${animated ? ' is-animated' : ''} ${className}`.trim()}
      width={size}
      height={size}
      viewBox="0 0 512 512"
      role="img"
      aria-label="Battement"
    >
      <defs>
        <linearGradient id={gradient} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#16241d" />
          <stop offset="0.48" stopColor="#0a1210" />
          <stop offset="1" stopColor="#050a08" />
        </linearGradient>

        <radialGradient id={glass} cx="0.32" cy="0.24" r="0.86">
          <stop offset="0" stopColor="#f4ffd6" stopOpacity="0.95" />
          <stop offset="0.34" stopColor="#c9ff3d" stopOpacity="0.82" />
          <stop offset="0.68" stopColor="#45d8b0" stopOpacity="0.5" />
          <stop offset="1" stopColor="#0e6f66" stopOpacity="0.18" />
        </radialGradient>

        <linearGradient id={rim} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.72" />
          <stop offset="0.42" stopColor="#ffffff" stopOpacity="0.06" />
          <stop offset="0.62" stopColor="#0b1a15" stopOpacity="0" />
          <stop offset="1" stopColor="#c9ff3d" stopOpacity="0.34" />
        </linearGradient>

        <linearGradient id={sheen} x1="0" y1="0" x2="1" y2="0.4">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.5" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>

        <radialGradient id={coral} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffd9e0" />
          <stop offset="0.45" stopColor="#ff4d6d" />
          <stop offset="1" stopColor="#ff4d6d" stopOpacity="0" />
        </radialGradient>

        <radialGradient id={glow} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#c9ff3d" stopOpacity="0.55" />
          <stop offset="1" stopColor="#c9ff3d" stopOpacity="0" />
        </radialGradient>

        <filter id={blur} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="18" />
        </filter>

        <clipPath id={clip}>
          <rect x="16" y="16" width="480" height="480" rx="118" />
        </clipPath>
      </defs>

      {/* Fond de verre teinté, bords chanfreinés */}
      <g clipPath={`url(#${clip})`}>
        <rect x="16" y="16" width="480" height="480" rx="118" fill={`url(#${gradient})`} />
        <ellipse className="appicon__glow" cx="256" cy="300" rx="230" ry="190" fill={`url(#${glow})`} />

        {/* Volume de verre : plusieurs calques translucides qui se réfractent */}
        <g filter={`url(#${blur})`} opacity="0.9">
          <ellipse cx="206" cy="214" rx="150" ry="142" fill={`url(#${glass})`} />
          <ellipse cx="330" cy="322" rx="104" ry="96" fill="#38d9ff" opacity="0.22" />
          <ellipse cx="300" cy="196" rx="74" ry="64" fill="#ffffff" opacity="0.16" />
        </g>

        {/* Anneau de pouls, en verre, qui tourne très lentement */}
        <g className="appicon__orbit" style={{ transformOrigin: '256px 256px' }}>
          <circle
            cx="256"
            cy="256"
            r="162"
            fill="none"
            stroke="#ffffff"
            strokeOpacity="0.22"
            strokeWidth="2"
          />
          <circle
            cx="256"
            cy="256"
            r="190"
            fill="none"
            stroke="#c9ff3d"
            strokeOpacity="0.32"
            strokeWidth="3"
            strokeDasharray="70 300"
            strokeLinecap="round"
          />
        </g>

        {/* Cœur lumineux, réfracté */}
        <circle cx="352" cy="332" r="72" fill={`url(#${coral})`} className="appicon__core" />

        {/* Trait de pouls */}
        <path
          d="M112 268h64l26-88 44 168 36-196 32 116h84"
          fill="none"
          stroke="#0a1712"
          strokeOpacity="0.35"
          strokeWidth="26"
          strokeLinecap="round"
          strokeLinejoin="round"
          transform="translate(0 8)"
        />
        <path
          d="M112 268h64l26-88 44 168 36-196 32 116h84"
          fill="none"
          stroke="#f7ffee"
          strokeWidth="20"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Reflet spéculaire, balayé lentement */}
        <g className="appicon__sheen">
          <rect x="-140" y="10" width="150" height="500" fill={`url(#${sheen})`} opacity="0.5" transform="rotate(18 0 256)" />
        </g>

        {/* Lumière de bord : c'est ce qui « fait » le verre */}
        <rect x="16" y="16" width="480" height="480" rx="118" fill="none" stroke={`url(#${rim})`} strokeWidth="3" />
        <path
          d="M96 60c34-22 84-34 138-34 68 0 130 20 170 54"
          fill="none"
          stroke="#ffffff"
          strokeOpacity="0.42"
          strokeWidth="6"
          strokeLinecap="round"
        />
        <ellipse cx="170" cy="128" rx="46" ry="22" fill="#ffffff" opacity="0.2" transform="rotate(-24 170 128)" />
        <ellipse cx="256" cy="480" rx="150" ry="26" fill="#000000" opacity="0.22" filter={`url(#${blur})`} />
      </g>

      {/* Ombre portée douce sous le carré */}
      <rect x="26" y="34" width="460" height="460" rx="110" fill="none" stroke="#000000" strokeOpacity="0.18" strokeWidth="2" />
    </svg>
  );
}
