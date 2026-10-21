import { formatDuration } from '../lib/dates';
import type { DayBar } from '../lib/analytics';

/** Jauge circulaire : minutes actives de la semaine. */
export function GoalRing({
  value,
  goal,
  size = 148,
}: {
  value: number;
  goal: number;
  size?: number;
}) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const ratio = goal > 0 ? value / goal : 0;
  const pct = Math.min(1, ratio);
  const offset = circumference * (1 - pct);
  const realPct = Math.round(ratio * 100);

  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg viewBox="0 0 128 128" aria-hidden="true">
        <circle className="ring__track" cx="64" cy="64" r={radius} />
        <circle
          className="ring__value"
          cx="64"
          cy="64"
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="ring__label">
        <strong>{realPct}%</strong>
        <span>{formatDuration(value)}</span>
      </div>
    </div>
  );
}

/** Sept barres : les minutes de chaque jour de la semaine. */
export function WeekBars({ bars, goal }: { bars: DayBar[]; goal: number }) {
  const max = Math.max(goal, ...bars.map((bar) => bar.minutes), 30);
  return (
    <div className="bars-wrap">
      <div className="bars" role="img" aria-label="Minutes actives des sept derniers jours">
        {bars.map((bar) => (
          <div className="bars__item" key={bar.day}>
            <span className="bars__value">{bar.minutes > 0 ? Math.round(bar.minutes) : ''}</span>
            <span className="bars__track">
              {bar.minutes > 0 ? (
                <i style={{ height: `${Math.max(4, (bar.minutes / max) * 100)}%` }} />
              ) : null}
              {goal > 0 ? (
                <span
                  className="bars__goal"
                  style={{ bottom: `${Math.min(100, (goal / max) * 100)}%` }}
                />
              ) : null}
            </span>
            <span className="bars__label">{bar.label}</span>
          </div>
        ))}
      </div>
      <p className="bars__caption">
        <span>Minutes par jour</span>
        {goal > 0 ? (
          <span className="bars__caption-goal">
            <i aria-hidden="true" /> objectif {Math.round(goal)} min
          </span>
        ) : null}
      </p>
    </div>
  );
}

/** Répartition par sport : une barre horizontale par discipline. */
export function SplitBars({
  slices,
  total,
}: {
  slices: { label: string; minutes: number; sessions: number; glyph: string }[];
  total: number;
}) {
  return (
    <ul className="split">
      {slices.map((slice) => (
        <li key={slice.label} className="split__row">
          <span className="split__glyph" aria-hidden="true">
            {slice.glyph}
          </span>
          <span className="split__label">{slice.label}</span>
          <span className="split__track">
            <i style={{ width: `${total > 0 ? (slice.minutes / total) * 100 : 0}%` }} />
          </span>
          <span className="split__value">
            {formatDuration(slice.minutes)}
            <em>{slice.sessions} séance{slice.sessions > 1 ? 's' : ''}</em>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** La constance sur huit semaines, une ligne par semaine. */
export function Consistency({
  weeks,
  goal,
}: {
  weeks: { start: string; end: string; minutes: number; sessions: number }[];
  goal?: number;
}) {
  const best = Math.max(...weeks.map((week) => week.minutes), goal ?? 0, 1);
  return (
    <div className="weeks" role="img" aria-label="Minutes actives par semaine">
      {weeks.map((week) => {
        const level = week.minutes === 0 ? 0 : week.minutes < 60 ? 1 : week.minutes < 120 ? 2 : 3;
        return (
          <div className="weeks__row" key={week.start}>
            <span className="weeks__label">
              {new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' })
                .format(new Date(`${week.start}T12:00:00`))
                .replace('.', '')}
            </span>
            <span className="weeks__track">
              <i
                data-level={level}
                style={{ width: `${week.minutes > 0 ? Math.max(2, (week.minutes / best) * 100) : 0}%` }}
              />
              {goal && goal > 0 ? (
                <span
                  className="weeks__goal"
                  style={{ left: `${Math.min(100, (goal / best) * 100)}%` }}
                />
              ) : null}
            </span>
            <span className="weeks__value">
              {week.minutes > 0 ? formatDuration(week.minutes) : '—'}
            </span>
          </div>
        );
      })}
    </div>
  );
}
