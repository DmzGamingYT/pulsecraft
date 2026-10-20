import { useEffect, useId, useState } from 'react';
import { fmtNumber } from '../lib/format';

interface Ring {
  label: string;
  value: number;
  goal: number;
  color: string;
  unit: string;
}

interface RingsProps {
  rings: Ring[];
  subtitle?: string;
}

/** Anneaux d'objectifs façon Apple Health, mais honnêtes : chaque anneau
 *  correspond à une donnée que Battement sait réellement mesurer. */
export function Rings({ rings, subtitle }: RingsProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const uid = useId().replace(/:/g, '');
  const size = 244;
  const center = size / 2;
  const thickness = 14;
  const gap = 6;
  const completed = rings.filter((ring) => ring.goal > 0 && ring.value >= ring.goal).length;

  return (
    <div className="rings-block">
      <div className="rings-visual">
        <svg
          viewBox={`0 0 ${size} ${size}`}
          className="rings-svg"
          role="img"
          aria-label={rings
            .map((ring) => `${ring.label} : ${Math.round(ring.value)} sur ${ring.goal} ${ring.unit}`)
            .join(', ')}
        >
          <defs>
            {rings.map((ring, index) => (
              <linearGradient
                key={`${ring.label}-gradient`}
                id={`${uid}-ring-${index}`}
                x1="0.1"
                y1="0"
                x2="0.9"
                y2="1"
              >
                <stop offset="0%" stopColor={ring.color} />
                <stop offset="100%" stopColor={ring.color} stopOpacity="0.7" />
              </linearGradient>
            ))}
          </defs>
          {rings.map((ring, index) => {
            const radius = center - thickness / 2 - index * (thickness + gap);
            const circumference = 2 * Math.PI * radius;
            const progress = ring.goal > 0 ? Math.max(0, Math.min(1, ring.value / ring.goal)) : 0;
            const offset = mounted ? circumference * (1 - progress) : circumference;
            return (
              <g key={ring.label} transform={`rotate(-90 ${center} ${center})`}>
                <circle
                  cx={center}
                  cy={center}
                  r={radius}
                  fill="none"
                  stroke="var(--ring-track)"
                  strokeWidth={thickness}
                />
                <circle
                  cx={center}
                  cy={center}
                  r={radius}
                  fill="none"
                  stroke={`url(#${uid}-ring-${index})`}
                  strokeWidth={thickness}
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={offset}
                  className="ring-arc"
                  style={{ transitionDelay: `${index * 90}ms` }}
                />
              </g>
            );
          })}
        </svg>
        <div className="rings-center" aria-hidden="true">
          <span className="rings-center__value">
            {completed}/{rings.length}
          </span>
          <span className="rings-center__label">objectifs</span>
        </div>
      </div>

      <ul className="rings-legend">
        {rings.map((ring) => {
          const progress = ring.goal > 0 ? Math.round((ring.value / ring.goal) * 100) : 0;
          return (
            <li key={ring.label} style={{ ['--ring-color' as string]: ring.color }}>
              <span className="rings-legend__dot" aria-hidden />
              <div className="rings-legend__body">
                <span className="rings-legend__label">{ring.label}</span>
                <span className="rings-legend__value">
                  <strong>{fmtNumber(ring.value)}</strong>
                  <span>
                    / {fmtNumber(ring.goal)} {ring.unit}
                  </span>
                </span>
              </div>
              <span className="rings-legend__pct">{Math.min(999, progress)} %</span>
            </li>
          );
        })}
      </ul>
      {subtitle ? <p className="rings-subtitle">{subtitle}</p> : null}
    </div>
  );
}
