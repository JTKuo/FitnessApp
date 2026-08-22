import { describe, expect, it } from 'vitest';
import { normalizeSetType, SET_TYPE } from './set-type.js';

describe('set type', () => {
  it('defaults missing/legacy values to working', () => {
    expect(normalizeSetType()).toBe(SET_TYPE.WORKING);
    expect(normalizeSetType('')).toBe(SET_TYPE.WORKING);
    expect(normalizeSetType('unexpected')).toBe(SET_TYPE.WORKING);
  });

  it('accepts warmup case-insensitively', () => {
    expect(normalizeSetType('warmup')).toBe(SET_TYPE.WARMUP);
    expect(normalizeSetType(' WARMUP ')).toBe(SET_TYPE.WARMUP);
  });
});
