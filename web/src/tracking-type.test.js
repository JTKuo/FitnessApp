import { describe, expect, it } from 'vitest';
import { formatDuration, normalizeDurationSec, normalizeTrackingType, TRACKING_TYPE } from './tracking-type.js';

describe('tracking type helpers', () => {
  it('unknown tracking types preserve legacy weight/reps semantics', () => {
    expect(normalizeTrackingType('duration')).toBe(TRACKING_TYPE.DURATION);
    expect(normalizeTrackingType('weight_reps')).toBe(TRACKING_TYPE.WEIGHT_REPS);
    expect(normalizeTrackingType('')).toBe(TRACKING_TYPE.WEIGHT_REPS);
    expect(normalizeTrackingType('future_type')).toBe(TRACKING_TYPE.WEIGHT_REPS);
  });

  it('duration seconds are positive rounded integers', () => {
    expect(normalizeDurationSec(45.4)).toBe(45);
    expect(normalizeDurationSec('90')).toBe(90);
    expect(normalizeDurationSec(0)).toBe(0);
    expect(normalizeDurationSec('x')).toBe(0);
  });

  it('formats short and minute-based duration clearly', () => {
    expect(formatDuration(45)).toBe('45 秒');
    expect(formatDuration(90)).toBe('1:30');
    expect(formatDuration(0)).toBe('0 秒');
  });
});
