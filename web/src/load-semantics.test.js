import { describe, expect, it } from 'vitest';
import {
  LOAD_MODE, LATERALITY, SIDE,
  normalizeLoadMode, normalizeLaterality, resolveSide,
  getLoadMultiplier, calculateSetVolumeKg,
} from './load-semantics.js';

describe('load semantics', () => {
  it('未知 metadata 維持舊 total + bilateral 語意', () => {
    expect(normalizeLoadMode('')).toBe(LOAD_MODE.TOTAL);
    expect(normalizeLaterality('')).toBe(LATERALITY.BILATERAL);
    expect(resolveSide('', '')).toBe(SIDE.BOTH);
  });

  it('unilateral 空白 side 安全預設左側', () => {
    expect(resolveSide('unilateral', '')).toBe(SIDE.LEFT);
    expect(resolveSide('unilateral', 'right')).toBe(SIDE.RIGHT);
  });

  it('bilateral 永遠解析成 both', () => {
    expect(resolveSide('bilateral', 'left')).toBe(SIDE.BOTH);
  });

  it('per-hand bilateral 容量乘二', () => {
    expect(getLoadMultiplier('per_hand', 'both')).toBe(2);
    expect(calculateSetVolumeKg(10, 12, 'per_hand', 'both')).toBe(240);
  });

  it('per-hand unilateral 單側列不重複乘二', () => {
    expect(getLoadMultiplier('per_hand', 'left')).toBe(1);
    expect(calculateSetVolumeKg(10, 12, 'per_hand', 'left')).toBe(120);
  });

  it('total 維持舊 weight × reps', () => {
    expect(calculateSetVolumeKg(15, 10, 'total', 'both')).toBe(150);
  });
});
