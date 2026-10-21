/**
 * Petites icônes au trait, dessinées plutôt qu'importées.
 *
 * Chaque discipline a sa silhouette : coureur, marcheur, montagne, vélo,
 * nageur, haltère, posture de yoga. C'est plus lisible que des symboles
 * abstraits, et cela reste net à toutes les tailles.
 */

export type IconName =
  | 'today'
  | 'journal'
  | 'activity'
  | 'import'
  | 'trend'
  | 'plus'
  | 'close'
  | 'sun'
  | 'moon'
  | 'settings'
  | 'trash'
  | 'upload'
  | 'check'
  | 'heart'
  | 'steps'
  | 'flame'
  | 'clock'
  | 'route'
  | 'arrow'
  | 'file'
  | 'search'
  | 'pencil'
  | 'run'
  | 'walk'
  | 'hike'
  | 'bike'
  | 'swim'
  | 'strength'
  | 'yoga'
  | 'sparkle';

interface Shape {
  /** traits principaux, dans l'ordre de dessin */
  paths: string[];
  /** contours circulaires : centre x, centre y, rayon */
  circles?: [number, number, number][];
  /** points pleins : centre x, centre y, rayon */
  dots?: [number, number, number][];
}

const SHAPES: Record<IconName, Shape> = {
  today: {
    paths: [
      'M4.5 6.5A2.5 2.5 0 0 1 7 4h10a2.5 2.5 0 0 1 2.5 2.5V19a1 1 0 0 1-1 1H5.5a1 1 0 0 1-1-1Z',
      'M4.5 9.5h15',
      'M8 2.8V6',
      'M16 2.8V6',
    ],
    dots: [[12, 14.6, 1.7]],
  },
  journal: {
    paths: ['M8 6.2h11.5', 'M8 12h11.5', 'M8 17.8h7.5'],
    dots: [
      [4.6, 6.2, 1.3],
      [4.6, 12, 1.3],
      [4.6, 17.8, 1.3],
    ],
  },
  activity: {
    paths: ['M3 12h3.2l2.1-6 3.4 12 2.6-8 1.8 2h5'],
  },
  import: {
    paths: ['M12 3.5v9.5', 'm8.5 9 3.5 3.5L15.5 9', 'M4.5 15.5V20h15v-4.5'],
  },
  trend: {
    paths: ['M3.5 16.8 8.6 11l3.4 3.1 7.5-8.4', 'M14.6 5.7H20v5.3'],
  },
  plus: {
    paths: ['M12 5v14', 'M5 12h14'],
  },
  close: {
    paths: ['m6 6 12 12', 'M18 6 6 18'],
  },
  sun: {
    paths: [
      'M12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6Z',
      'M12 2.8v2M12 19.2v2M2.8 12h2M19.2 12h2M5.5 5.5 7 7M17 17l1.5 1.5M18.5 5.5 17 7M7 17l-1.5 1.5',
    ],
  },
  moon: {
    paths: ['M20 14.2A8.2 8.2 0 0 1 9.8 4a8.2 8.2 0 1 0 10.2 10.2Z'],
  },
  settings: {
    paths: ['M4 7h7.5', 'M16.5 7H20', 'M4 17h3.5', 'M12.5 17H20'],
    dots: [
      [14, 7, 1.8],
      [10, 17, 1.8],
    ],
  },
  trash: {
    paths: ['M4 7h16', 'M9 7V4h6v3', 'm6.5 7 1 13h9l1-13', 'M10 11v5', 'M14 11v5'],
  },
  upload: {
    paths: ['M12 16V4', 'm8 8 4-4 4 4', 'M4 16v4h16v-4'],
  },
  check: {
    paths: ['m5 12.5 4.2 4.2L19 7'],
  },
  heart: {
    paths: ['M12 20s-7-4.4-7-9.3A4 4 0 0 1 12 8a4 4 0 0 1 7 2.7C19 15.6 12 20 12 20Z'],
  },
  steps: {
    paths: [
      'M8.3 14.4c1.8 0 2.9 1.3 2.9 3.1 0 1.6-1.1 2.5-2.8 2.5-2 0-3.4-1-3.4-2.8 0-1.7 1.4-2.8 3.3-2.8Z',
      'M15.7 9.4c1.9 0 3 1.3 3 3.1 0 1.6-1.2 2.5-2.9 2.5-2 0-3.3-1-3.3-2.8 0-1.7 1.3-2.8 3.2-2.8Z',
      'M8.7 4.2c1.1 0 1.7.9 1.7 2 0 1-.6 1.7-1.6 1.7s-1.6-.8-1.6-1.9c0-1 .6-1.8 1.5-1.8Z',
    ],
  },
  flame: {
    paths: [
      'M12 21c4 0 6-2.6 6-6 0-4.5-4-6-4-9 0 0-2 1.5-2 4 0 1.7-1 2-1 2s-1.5-1-1.5-3C7 11 6 12.5 6 15c0 3.4 2 6 6 6Z',
    ],
  },
  clock: {
    paths: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z', 'M12 8v5l3 2'],
  },
  route: {
    paths: ['M6 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z', 'M18 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z', 'M8 18h7a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h7'],
  },
  arrow: {
    paths: ['M5 12h14', 'm14 7 5 5-5 5'],
  },
  file: {
    paths: ['M6 3h8l4 4v14H6Z', 'M14 3v5h4', 'M9 13h6', 'M9 17h4'],
  },
  search: {
    paths: ['M10.8 18.4a7.7 7.7 0 1 0 0-15.4 7.7 7.7 0 0 0 0 15.4Z', 'm16.4 16.3 4.6 4.6'],
  },
  pencil: {
    paths: ['M4 20h4.2L19.4 8.8a2.2 2.2 0 0 0-3.1-3.1L5 16.9Z', 'm14.8 6.9 2.9 2.9'],
  },
  run: {
    paths: [
      'M14.2 7.7 11.6 11l2.2 2.3-1.3 4.6',
      'M13.4 9 16.7 10.7 19.2 10.3',
      'M11.6 11 7.7 12.3',
      'M13.5 13.2 16.4 15.4 18 19',
    ],
    circles: [[15.3, 4.3, 1.9]],
  },
  walk: {
    paths: [
      'M12.5 7.6 11.1 11.3l1.8 2.1-.9 5.2',
      'M12.9 13.4 10.6 15.6 9.4 19',
      'M11.6 9 8.9 11.2',
      'M12 9.1 14.7 10.7 16.9 10.5',
    ],
    circles: [[13, 4.3, 1.9]],
  },
  hike: {
    paths: [
      'M3 19h18',
      'M4.5 19 9.6 9.8l3.2 5.6 2-3.2 4.7 6.8',
      'M16.2 6.8v6.6',
      'M16.2 6.8h3.2l-1.2 1.6 1.2 1.6h-3.2',
    ],
  },
  bike: {
    paths: [
      'M6.2 17 10.6 10.4H15L17.8 17',
      'M10.6 10.4 12.8 17',
      'M8.2 10.4h4.6',
      'M10.6 10.4 9.2 8.8',
      'M15 10.4 16.6 8.6',
      'M15 10.4h2.2',
    ],
    circles: [
      [6.2, 17, 3.2],
      [17.8, 17, 3.2],
    ],
  },
  swim: {
    paths: [
      'M4 16.5c2-1.7 3.9-1.7 5.9 0s3.9 1.7 5.9 0 3.9-1.7 5.9 0',
      'M4 20c2-1.4 3.9-1.4 5.9 0',
      'M9.2 12.4 6 10.1',
      'M11.4 10.9 14.6 9.8',
    ],
    circles: [[16, 7.4, 1.7]],
  },
  strength: {
    paths: ['M8.2 7.5v9', 'M15.8 7.5v9', 'M5 9.8v4.4', 'M19 9.8v4.4', 'M8.2 12h7.6'],
  },
  yoga: {
    paths: [
      'M12 7.4v4.2',
      'M12 9.4 8.7 11.6',
      'M12 9.4 15.3 11.6',
      'M4.8 17.2c2.4 0 4.3-1.4 7.2-1.4s4.8 1.4 7.2 1.4',
      'M8.5 13.4 5.6 16.9',
      'M15.5 13.4 18.4 16.9',
    ],
    circles: [[12, 4.8, 1.9]],
  },
  sparkle: {
    paths: [
      'M12 3.2 13.8 8.7 19.3 10.5 13.8 12.3 12 17.8 10.2 12.3 4.7 10.5 10.2 8.7Z',
      'M18.5 16.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7Z',
    ],
  },
};

export function Icon({
  name,
  size = 18,
  className,
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  const shape = SHAPES[name];
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {shape.paths.map((d, index) => (
        <path d={d} key={`p${index}`} />
      ))}
      {shape.circles?.map(([cx, cy, r], index) => (
        <circle cx={cx} cy={cy} r={r} key={`c${index}`} />
      ))}
      {shape.dots?.map(([cx, cy, r], index) => (
        <circle cx={cx} cy={cy} r={r} fill="currentColor" stroke="none" key={`d${index}`} />
      ))}
    </svg>
  );
}

/** La marque : un battement de cœur qui devient une ligne de journal. */
export function BattementMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="currentColor" />
      <path
        d="M5 17h5l2.2-6 3.4 12 3-8 1.7 2H27"
        stroke="#fffaf2"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
