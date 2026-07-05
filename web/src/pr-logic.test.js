import { describe, it, expect } from 'vitest';
import { calcEst1RM, getRmCategory } from './pr-logic.js';

describe('calcEst1RM（Brzycki）', () => {
  it('1 下等於原重量', () => {
    expect(calcEst1RM(100, 1)).toBe(100);
  });
  it('多下用 Brzycki 公式：100kg x 5 -> 112.5', () => {
    expect(calcEst1RM(100, 5)).toBeCloseTo(112.5, 1);
  });
  it('無效輸入回 0', () => {
    expect(calcEst1RM(0, 5)).toBe(0);
    expect(calcEst1RM(100, 0)).toBe(0);
    expect(calcEst1RM(-10, 5)).toBe(0);
  });
  it('reps >= 37 時公式失效，回 0 而非負值', () => {
    expect(calcEst1RM(100, 37)).toBe(0);
    expect(calcEst1RM(100, 40)).toBe(0);
  });
});

describe('getRmCategory', () => {
  it('對應各 RM 區間', () => {
    expect(getRmCategory(1)).toBe(1);
    expect(getRmCategory(2)).toBe(1);
    expect(getRmCategory(3)).toBe(3);
    expect(getRmCategory(4)).toBe(3);
    expect(getRmCategory(5)).toBe(5);
    expect(getRmCategory(7)).toBe(5);
    expect(getRmCategory(8)).toBe(8);
    expect(getRmCategory(9)).toBe(8);
    expect(getRmCategory(10)).toBe(10);
    expect(getRmCategory(20)).toBe(10);
  });
  it('無效輸入回 null', () => {
    expect(getRmCategory(0)).toBeNull();
    expect(getRmCategory(-1)).toBeNull();
  });
});
