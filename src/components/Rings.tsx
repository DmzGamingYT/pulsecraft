import { useEffect, useState } from 'react';
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
 *  correspond à une donnée que PulseCraft sait réellement mesurer. */
export function Rings({ rings, subtitle }: RingsProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const size = 236;
  const center = size / 2;
  const thickness = 15;
  const gap = 5;

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
                  stroke={ring.color}
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
            {rings.filter((ring) => ring.value >= ring.goal && ring.goal > 0).length}/3
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
