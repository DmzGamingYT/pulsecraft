import { useId } from 'react';
import { formatMedium, formatWeekday, parseISODate } from '../lib/dates';
import { fmtNumber } from '../lib/format';

export interface ChartPoint {
  date: string;
  value: number | null;
}

const DEFAULT_FORMAT = (value: number) => fmtNumber(value);

interface LineChartProps {
  points: ChartPoint[];
  color: string;
  height?: number;
  goal?: number;
  formatValue?: (value: number) => string;
  emptyLabel?: string;
  label: string;
}

/** Courbe SVG, sans dépendance graphique. Les trous de données restent des
 *  trous : aucune interpolation inventée entre deux mesures. */
export function LineChart({
  points,
  color,
  height = 180,
  goal,
  formatValue = DEFAULT_FORMAT,
  emptyLabel = 'Pas encore de données',
  label,
}: LineChartProps) {
  const gradientId = useId().replace(/[:]/g, '');
  const values = points
    .map((point) => point.value)
    .filter((value): value is number => value !== null && Number.isFinite(value));

  if (values.length < 2) {
    return <ChartEmpty label={emptyLabel} height={height} />;
  }

  const allValues = goal !== undefined ? [...values, goal] : values;
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const padding = Math.max((max - min) * 0.12, max * 0.02, 0.5);
  const low = min - padding;
  const high = max + padding;
  const width = 640;
  const innerHeight = height - 26;
  const innerWidth = width - 16;

  const x = (index: number) =>
    8 + (points.length > 1 ? (index / (points.length - 1)) * innerWidth : innerWidth / 2);
  const y = (value: number) => 8 + (1 - (value - low) / (high - low)) * (innerHeight - 16);

  const segments: Array<{ x: number; y: number }[]> = [];
  let current: Array<{ x: number; y: number }> = [];
  points.forEach((point, index) => {
    if (point.value === null || !Number.isFinite(point.value)) {
      if (current.length > 0) segments.push(current);
      current = [];
      return;
    }
    current.push({ x: x(index), y: y(point.value) });
  });
  if (current.length > 0) segments.push(current);

  const last = points[points.length - 1];
  const lastValue = last?.value;

  return (
    <figure className="chart" aria-label={label}>
      <svg viewBox={`0 0 ${width} ${height}`} className="chart-svg" role="img">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {[0.25, 0.5, 0.75].map((ratio) => (
          <line
            key={ratio}
            x1="8"
            x2={width - 8}
            y1={8 + ratio * (innerHeight - 16)}
            y2={8 + ratio * (innerHeight - 16)}
            stroke="var(--line)"
            strokeDasharray="3 6"
          />
        ))}

        {goal !== undefined ? (
          <line
            x1="8"
            x2={width - 8}
            y1={y(goal)}
            y2={y(goal)}
            stroke="var(--ink-3)"
            strokeOpacity="0.55"
            strokeDasharray="5 5"
          />
        ) : null}

        {segments.map((segment, index) => {
          const first = segment[0];
          const end = segment[segment.length - 1];
          if (!first || !end) return null;
          const area = `${segment
            .map((point, pointIndex) => `${pointIndex === 0 ? 'M' : 'L'}${point.x},${point.y}`)
            .join(' ')} L${end.x},${innerHeight} L${first.x},${innerHeight} Z`;
          return (
            <g key={index}>
              {segment.length > 1 ? <path d={area} fill={`url(#${gradientId})`} /> : null}
              <path
                d={segment
                  .map((point, pointIndex) => `${pointIndex === 0 ? 'M' : 'L'}${point.x},${point.y}`)
                  .join(' ')}
                fill="none"
                stroke={color}
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          );
        })}

        {lastValue !== null && lastValue !== undefined && Number.isFinite(lastValue) ? (
          <circle
            cx={x(points.length - 1)}
            cy={y(lastValue)}
            r="4.2"
            fill={color}
            stroke="var(--surface)"
            strokeWidth="2"
          />
        ) : null}
      </svg>

      <div className="chart-axis">
        <span>{points[0] ? formatMedium(points[0].date) : ''}</span>
        <span className="chart-axis__mid">
          {goal !== undefined ? `objectif ${formatValue(goal)}` : ''}
        </span>
        <span>{last ? formatMedium(last.date) : ''}</span>
      </div>

      {lastValue !== null && lastValue !== undefined && Number.isFinite(lastValue) ? (
        <figcaption className="chart-caption">
          Dernière valeur&nbsp;: <strong>{formatValue(lastValue)}</strong>
        </figcaption>
      ) : null}
    </figure>
  );
}

interface BarChartProps {
  points: ChartPoint[];
  color: string;
  height?: number;
  goal?: number;
  formatValue?: (value: number) => string;
  emptyLabel?: string;
  label: string;
  /** met la dernière barre en avant (jour en cours) */
  highlightLast?: boolean;
}

export function BarChart({
  points,
  color,
  height = 160,
  goal,
  formatValue = DEFAULT_FORMAT,
  emptyLabel = 'Pas encore de données',
  label,
  highlightLast = false,
}: BarChartProps) {
  const values = points.map((point) => point.value ?? 0);
  const max = Math.max(goal ?? 0, ...values, 1);

  if (values.every((value) => value <= 0)) {
    return <ChartEmpty label={emptyLabel} height={height} />;
  }

  return (
    <figure className={`chart chart--bars${highlightLast ? ' chart--last' : ''}`} aria-label={label}>
      <div className="bars" style={{ height }}>
        {goal !== undefined && goal > 0 ? (
          <span
            className="bars__goal"
            style={{ bottom: `${(goal / max) * 100}%` }}
            title={`Objectif : ${formatValue(goal)}`}
          />
        ) : null}
        {points.map((point) => {
          const value = point.value ?? 0;
          const ratio = value / max;
          return (
            <div
              className="bars__slot"
              key={point.date}
              title={`${formatMedium(point.date)} · ${formatValue(value)}`}
            >
              <span
                className="bars__bar"
                style={{
                  height: ratio > 0 ? `max(3px, ${ratio * 100}%)` : '2px',
                  background: ratio > 0 ? color : 'var(--line)',
                  opacity: 0.45 + Math.min(0.55, ratio),
                }}
              />
            </div>
          );
        })}
      </div>
      <div className="bars__axis">
        {points.length <= 14
          ? points.map((point) => (
              <span key={point.date} className="bars__tick">
                {formatWeekday(point.date).slice(0, 1)}
              </span>
            ))
          : points
              .filter((_, index) => index % 7 === 0)
              .map((point) => (
                <span key={point.date} className="bars__tick">
                  {formatMedium(point.date)}
                </span>
              ))}
      </div>
      <figcaption className="chart-caption">
        Total&nbsp;:{' '}
        <strong>{formatValue(values.reduce((sum, value) => sum + value, 0))}</strong>
      </figcaption>
    </figure>
  );
}

export function ChartEmpty({ label, height }: { label: string; height: number }) {
  return (
    <div className="chart-empty" style={{ minHeight: height }}>
      <span className="chart-empty__line" aria-hidden />
      <p>{label}</p>
    </div>
  );
}

interface HeatmapDay {
  date: string;
  intensity: number;
  minutes: number;
}

/** Carte de chaleur 7 × N, lundi en haut. */
export function Heatmap({ days }: { days: HeatmapDay[] }) {
  const first = days[0];
  if (!first) return null;
  const offset = (parseISODate(first.date).getDay() + 6) % 7;
  const cells: Array<HeatmapDay | null> = [...Array<null>(offset).fill(null), ...days];
  const columns: Array<Array<HeatmapDay | null>> = [];
  for (let index = 0; index < cells.length; index += 7) {
    columns.push(cells.slice(index, index + 7));
  }

  return (
    <div className="heatmap" aria-label="Carte de chaleur de l’activité">
      <div className="heatmap__weekdays" aria-hidden>
        {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((day, index) => (
          <span key={`${day}-${index}`}>{day}</span>
        ))}
      </div>
      <div className="heatmap__grid">
        {columns.map((column, columnIndex) => (
          <div className="heatmap__col" key={columnIndex}>
            {Array.from({ length: 7 }, (_, rowIndex) => {
              const day = column[rowIndex];
              if (!day) return <span className="heatmap__cell is-empty" key={rowIndex} />;
              const alpha = day.intensity > 0 ? 0.18 + day.intensity * 0.82 : 0;
              return (
                <span
                  key={day.date}
                  className="heatmap__cell"
                  style={{
                    background:
                      alpha === 0
                        ? 'var(--surface-2)'
                        : `rgba(201, 255, 61, ${alpha.toFixed(2)})`,
                  }}
                  title={`${formatMedium(day.date)} · ${Math.round(day.minutes)} min`}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div className="heatmap__legend" aria-hidden>
        <span>moins</span>
        <i style={{ background: 'var(--surface-2)' }} />
        <i style={{ background: 'rgba(201,255,61,.25)' }} />
        <i style={{ background: 'rgba(201,255,61,.55)' }} />
        <i style={{ background: 'rgba(201,255,61,.85)' }} />
        <span>plus</span>
      </div>
    </div>
  );
}

export function StageBar({
  deep,
  rem,
  total,
}: {
  deep: number;
  rem: number;
  total: number;
}) {
  const safeTotal = Math.max(total, 1);
  const deepPct = Math.min(100, (deep / safeTotal) * 100);
  const remPct = Math.min(100 - deepPct, (rem / safeTotal) * 100);
  return (
    <div className="stagebar" aria-label={`Sommeil profond ${Math.round(deepPct)} %, REM ${Math.round(remPct)} %`}>
      <span style={{ width: `${deepPct}%`, background: '#7d8cff' }} />
      <span style={{ width: `${remPct}%`, background: '#b48cff' }} />
      <span style={{ width: `${Math.max(0, 100 - deepPct - remPct)}%`, background: 'rgba(56,217,255,.55)' }} />
    </div>
  );
}

export function ProgressBar({
  value,
  goal,
  color = 'var(--brand)',
  label,
}: {
  value: number;
  goal: number;
  color?: string;
  label: string;
}) {
  const ratio = goal > 0 ? Math.max(0, Math.min(1, value / goal)) : 0;
  return (
    <div
      className="progressbar"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={Math.round(goal)}
      aria-valuenow={Math.round(value)}
      aria-label={label}
    >
      <span style={{ width: `${ratio * 100}%`, background: color }} />
    </div>
  );
}
