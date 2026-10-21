import { describe, expect, it } from 'vitest';
import { isDemoRequest } from './demoEntry';

describe('isDemoRequest', () => {
  it('reconnaît le paramètre de la vitrine', () => {
    expect(isDemoRequest('?demo=1')).toBe(true);
    expect(isDemoRequest('?demo')).toBe(true);
    expect(isDemoRequest('demo=1')).toBe(true);
  });

  it('ignore une visite normale', () => {
    expect(isDemoRequest('')).toBe(false);
    expect(isDemoRequest('?theme=dark')).toBe(false);
    expect(isDemoRequest('?demo=0')).toBe(false);
    expect(isDemoRequest('?demo=false')).toBe(false);
  });
});
