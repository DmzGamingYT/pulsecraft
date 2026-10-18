import { describe, expect, it } from 'vitest';
import { parseGpx, parseTcx } from './activityFiles';

const GPX = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="test">
  <trk>
    <name>Sortie test</name>
    <trkseg>
      <trkpt lat="48.8566" lon="2.3522"><ele>35</ele><time>2026-05-01T08:00:00Z</time></trkpt>
      <trkpt lat="48.8576" lon="2.3522"><ele>40</ele><time>2026-05-01T08:10:00Z</time></trkpt>
    </trkseg>
  </trk>
</gpx>`;

const TCX = `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase>
  <Activities>
    <Activity Sport="Biking">
      <Notes>Parcours vallonné</Notes>
      <Lap>
        <Track>
          <Trackpoint>
            <Time>2026-05-01T08:00:00Z</Time>
            <DistanceMeters>0</DistanceMeters>
            <HeartRateBpm><Value>120</Value></HeartRateBpm>
          </Trackpoint>
          <Trackpoint>
            <Time>2026-05-01T08:30:00Z</Time>
            <DistanceMeters>10000</DistanceMeters>
            <HeartRateBpm><Value>160</Value></HeartRateBpm>
          </Trackpoint>
        </Track>
      </Lap>
    </Activity>
  </Activities>
</TrainingCenterDatabase>`;

describe('import GPX / TCX', () => {
  it('calcule distance, durée et dénivelé d’un GPX', () => {
    const workout = parseGpx(GPX).workouts?.[0];
    expect(workout?.type).toBe('Course');
    expect(workout?.durationMin).toBe(10);
    expect(workout?.distanceKm).toBeGreaterThan(0.1);
    expect(workout?.distanceKm).toBeLessThan(0.12);
    expect(workout?.elevationM).toBe(5);
    expect(workout?.notes).toContain('Sortie test');
    expect(workout?.source).toBe('gpx');
  });

  it('lit une activité TCX avec FC et distance', () => {
    const workout = parseTcx(TCX).workouts?.[0];
    expect(workout?.type).toBe('Vélo');
    expect(workout?.durationMin).toBe(30);
    expect(workout?.distanceKm).toBe(10);
    expect(workout?.avgHr).toBe(140);
    expect(workout?.maxHr).toBe(160);
    expect(workout?.notes).toContain('vallonné');
  });

  it('refuse une trace sans point ou sans horodatage', () => {
    expect(() => parseGpx('<gpx></gpx>')).toThrow(/trace/i);
    expect(() =>
      parseGpx(
        '<gpx><trkpt lat="1" lon="2"></trkpt><trkpt lat="1.1" lon="2.1"></trkpt></gpx>'
      )
    ).toThrow(/horodatage/i);
    expect(() => parseTcx('<TrainingCenterDatabase></TrainingCenterDatabase>')).toThrow(/point/i);
  });
});
